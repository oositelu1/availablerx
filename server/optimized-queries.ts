// Optimized query patterns to replace N+1 queries in the application

import { db } from "./db";
import { 
  purchaseOrders, purchaseOrderItems, productItems, files, 
  epcisPoAssociations, partners, inventory, inventoryTransactions 
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

// Example: Get purchase order with all related data in one query
export async function getPurchaseOrderWithDetails(poId: number) {
  // Instead of multiple queries, use joins
  const result = await db
    .select({
      po: purchaseOrders,
      items: sql<any>`
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', ${purchaseOrderItems.id},
              'productName', ${purchaseOrderItems.productName},
              'quantity', ${purchaseOrderItems.quantity},
              'gtin', ${purchaseOrderItems.gtin}
            )
          ) FILTER (WHERE ${purchaseOrderItems.id} IS NOT NULL),
          '[]'::json
        )
      `,
      productItems: sql<any>`
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', ${productItems.id},
              'gtin', ${productItems.gtin},
              'serialNumber', ${productItems.serialNumber},
              'lotNumber', ${productItems.lotNumber},
              'expirationDate', ${productItems.expirationDate}
            )
          ) FILTER (WHERE ${productItems.id} IS NOT NULL),
          '[]'::json
        )
      `,
      associatedFiles: sql<any>`
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'fileId', ${files.id},
              'fileName', ${files.originalName},
              'status', ${files.status}
            )
          ) FILTER (WHERE ${files.id} IS NOT NULL),
          '[]'::json
        )
      `
    })
    .from(purchaseOrders)
    .leftJoin(purchaseOrderItems, eq(purchaseOrderItems.poId, purchaseOrders.id))
    .leftJoin(productItems, eq(productItems.poId, purchaseOrders.id))
    .leftJoin(epcisPoAssociations, eq(epcisPoAssociations.poId, purchaseOrders.id))
    .leftJoin(files, eq(files.id, epcisPoAssociations.fileId))
    .where(eq(purchaseOrders.id, poId))
    .groupBy(purchaseOrders.id);

  return result[0];
}

// Batch load inventory with transactions
export async function getInventoryWithTransactions(gtins: string[]) {
  if (gtins.length === 0) return [];
  
  const result = await db
    .select({
      inventory: inventory,
      lastTransaction: sql<any>`
        (
          SELECT jsonb_build_object(
            'id', t.id,
            'type', t.transaction_type,
            'quantity', t.quantity,
            'date', t.transaction_date
          )
          FROM ${inventoryTransactions} t
          WHERE t.gtin = ${inventory.gtin} 
            AND t.serial_number = ${inventory.serialNumber}
          ORDER BY t.transaction_date DESC
          LIMIT 1
        )
      `,
      transactionCount: sql<number>`
        (
          SELECT COUNT(*)::int
          FROM ${inventoryTransactions} t
          WHERE t.gtin = ${inventory.gtin} 
            AND t.serial_number = ${inventory.serialNumber}
        )
      `
    })
    .from(inventory)
    .where(sql`${inventory.gtin} = ANY(${gtins})`);
    
  return result;
}

// Efficient file listing with metadata
export async function listFilesOptimized(options: {
  status?: string;
  partnerId?: number;
  limit: number;
  offset: number;
}) {
  const conditions = [];
  
  if (options.status) {
    conditions.push(eq(files.status, options.status));
  }
  
  const result = await db
    .select({
      file: files,
      transmissionCount: sql<number>`
        (SELECT COUNT(*)::int FROM transmissions t WHERE t.file_id = ${files.id})
      `,
      productItemCount: sql<number>`
        (SELECT COUNT(*)::int FROM product_items pi WHERE pi.file_id = ${files.id})
      `,
      lastTransmission: sql<any>`
        (
          SELECT jsonb_build_object(
            'id', t.id,
            'status', t.status,
            'sentAt', t.sent_at,
            'partnerName', p.name
          )
          FROM transmissions t
          LEFT JOIN partners p ON p.id = t.partner_id
          WHERE t.file_id = ${files.id}
          ORDER BY t.sent_at DESC
          LIMIT 1
        )
      `
    })
    .from(files)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(files.createdAt))
    .limit(options.limit)
    .offset(options.offset);
    
  // Get total count
  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(files)
    .where(conditions.length > 0 ? and(...conditions) : undefined);
    
  return {
    files: result,
    total: count
  };
}

// Cache wrapper for frequently accessed data
class QueryCache {
  private cache = new Map<string, { data: any; expires: number }>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  
  async get<T>(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = this.cache.get(key);
    
    if (cached && cached.expires > Date.now()) {
      return cached.data as T;
    }
    
    const data = await fetcher();
    this.cache.set(key, {
      data,
      expires: Date.now() + (ttl || this.DEFAULT_TTL)
    });
    
    return data;
  }
  
  invalidate(pattern: string) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

export const queryCache = new QueryCache();