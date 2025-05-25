import { 
  users, partners, partnerLocations, files, transmissions, presignedLinks,
  purchaseOrders, purchaseOrderItems, salesOrders, salesOrderItems, 
  epcisPoAssociations, productItems, scannedItems,
  inventory, inventoryTransactions,
  validationSessions, auditLogs
} from "@shared/schema";
import type { 
  User, InsertUser, Partner, InsertPartner, PartnerLocation, InsertPartnerLocation,
  File, InsertFile, Transmission, InsertTransmission, PresignedLink, InsertPresignedLink,
  PurchaseOrder, InsertPurchaseOrder, PurchaseOrderItem, InsertPurchaseOrderItem,
  SalesOrder, InsertSalesOrder, SalesOrderItem, InsertSalesOrderItem,
  EpcisPoAssociation, InsertEpcisPoAssociation,
  ProductItem, InsertProductItem, ScannedItem, InsertScannedItem,
  Inventory, InsertInventory, InventoryTransaction, InsertInventoryTransaction,
  ValidationSession, InsertValidationSession, AuditLog, InsertAuditLog
} from "@shared/schema";
import session from "express-session";
import { db } from "./db";
import { eq, and, or, gte, lte, desc, sql, like, isNotNull } from "drizzle-orm";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import crypto from "crypto";
import { v4 as uuidv4 } from 'uuid';
import { IStorage } from "./storage";
import * as fs from 'fs/promises';
import * as path from 'path';

const PostgresSessionStore = connectPg(session);

// Database storage implementation
export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;
  private fileDataStorage: Map<number, Buffer>; // We'll keep this in-memory for now
  private baseDownloadUrl: string;
  
  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
    
    this.fileDataStorage = new Map();
    
    // Set the base URL for downloads
    // This will be overridden by the actual host in the request when generating URLs
    this.baseDownloadUrl = process.env.BASE_DOWNLOAD_URL || '';
    
    // Create a default admin user if none exists
    this.ensureAdminUser();
  }
  
  private async ensureAdminUser() {
    const adminUser = await this.getUserByUsername("admin");
    if (!adminUser) {
      await this.createUser({
        username: "admin",
        password: this.hashPassword("admin123"),
        fullName: "System Administrator",
        role: "administrator"
      });
      console.log("Created default admin user");
    }
  }
  
  private hashPassword(password: string): string {
    // Generate a 16-byte random salt
    const salt = crypto.randomBytes(16).toString('hex');
    // Hash the password using PBKDF2
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    // Return in salt:hash format
    return `${salt}:${hash}`;
  }
  
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  
  async createUser(data: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values({
      username: data.username,
      password: data.password,
      fullName: data.fullName,
      role: data.role || "operator"
    }).returning();
    
    return user;
  }
  
  async listUsers(): Promise<User[]> {
    return db.select().from(users);
  }
  
  async createPartner(data: InsertPartner): Promise<Partner> {
    const [partner] = await db.insert(partners).values({
      name: data.name,
      partnerType: data.partnerType,
      contactEmail: data.contactEmail,
      createdBy: data.createdBy,
      transportType: data.transportType || null,
      notes: data.notes || null,
      endpointUrl: data.endpointUrl || null,
      as2Id: data.as2Id || null,
      certificate: data.certificate || null,
      authToken: data.authToken || null,
      isActive: true
    }).returning();
    
    return partner;
  }
  
  async getPartner(id: number): Promise<Partner | undefined> {
    const [partner] = await db.select().from(partners).where(eq(partners.id, id));
    return partner;
  }
  
  async updatePartner(id: number, updates: Partial<Partner>): Promise<Partner | undefined> {
    const [updatedPartner] = await db.update(partners)
      .set(updates)
      .where(eq(partners.id, id))
      .returning();
    
    return updatedPartner;
  }
  
  async listPartners(activeOnly: boolean = false): Promise<Partner[]> {
    // Use a simplified query that doesn't rely on the AS2 fields
    // This is a temporary workaround until we can sync the database schema
    try {
      const query = activeOnly 
        ? `SELECT id, name, partner_type, contact_email, notes, endpoint_url, 
            auth_token, transport_type, is_active, gln, license_number, 
            license_expiration_date, state_of_license, compliance_status, 
            created_at, created_by 
          FROM partners 
          WHERE is_active = true`
        : `SELECT id, name, partner_type, contact_email, notes, endpoint_url, 
            auth_token, transport_type, is_active, gln, license_number, 
            license_expiration_date, state_of_license, compliance_status, 
            created_at, created_by 
          FROM partners`;
            
      const result = await db.execute(query);
      
      // Map the raw results to the Partner type
      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        partnerType: row.partner_type,
        contactEmail: row.contact_email,
        notes: row.notes,
        endpointUrl: row.endpoint_url,
        authToken: row.auth_token,
        transportType: row.transport_type || 'PRESIGNED',
        isActive: row.is_active,
        gln: row.gln,
        licenseNumber: row.license_number,
        licenseExpirationDate: row.license_expiration_date ? new Date(row.license_expiration_date) : null,
        stateOfLicense: row.state_of_license,
        complianceStatus: row.compliance_status || 'active',
        createdAt: new Date(row.created_at),
        createdBy: row.created_by,
        // Add empty values for AS2 fields that might not exist in the database yet
        as2Id: null,
        as2From: null,
        as2To: null,
        as2Url: null,
        as2ConnectorId: null,
        signingCertificate: null,
        encryptionCertificate: null,
        partnerSigningCertificate: null,
        partnerEncryptionCertificate: null,
        enableEncryption: true,
        enableSigning: true,
        enableCompression: false,
        mdn: 'sync',
        mdnOptions: null,
        certificate: null
      }));
    } catch (error) {
      console.error('Error in listPartners:', error);
      // Fallback to an empty array to prevent app crashes
      return [];
    }
  }
  
  async deletePartner(id: number): Promise<boolean> {
    // Soft delete - just mark as inactive
    const [partner] = await db.update(partners)
      .set({ isActive: false })
      .where(eq(partners.id, id))
      .returning();
    
    return !!partner;
  }
  
  async getPartnerByGLN(gln: string): Promise<Partner | null> {
    const [partner] = await db
      .select()
      .from(partners)
      .where(eq(partners.gln, gln))
      .limit(1);
    
    return partner || null;
  }
  
  async getAllActiveAS2Receivers(): Promise<Partner[]> {
    const receivers = await db
      .select()
      .from(partners)
      .where(
        and(
          eq(partners.isActive, true),
          eq(partners.transportType, 'AS2'),
          isNotNull(partners.as2ServerId)
        )
      );
    
    return receivers;
  }
  
  // Partner Location methods
  async createPartnerLocation(location: InsertPartnerLocation): Promise<PartnerLocation> {
    const [newLocation] = await db
      .insert(partnerLocations)
      .values(location)
      .returning();
    return newLocation;
  }
  
  async getPartnerLocation(id: number): Promise<PartnerLocation | undefined> {
    const [location] = await db
      .select()
      .from(partnerLocations)
      .where(eq(partnerLocations.id, id));
    return location;
  }
  
  async updatePartnerLocation(id: number, updates: Partial<PartnerLocation>): Promise<PartnerLocation | undefined> {
    const [updatedLocation] = await db
      .update(partnerLocations)
      .set(updates)
      .where(eq(partnerLocations.id, id))
      .returning();
    return updatedLocation;
  }
  
  async listPartnerLocations(partnerId: number, locationType?: string): Promise<PartnerLocation[]> {
    let query = db
      .select()
      .from(partnerLocations)
      .where(eq(partnerLocations.partnerId, partnerId));
      
    if (locationType) {
      query = query.where(eq(partnerLocations.locationType, locationType));
    }
    
    // Order by isDefault (true first) and then by name
    return await query.orderBy(desc(partnerLocations.isDefault), partnerLocations.name);
  }
  
  async deletePartnerLocation(id: number): Promise<boolean> {
    const result = await db
      .delete(partnerLocations)
      .where(eq(partnerLocations.id, id))
      .returning();
    return result.length > 0;
  }
  
  async createFile(data: InsertFile): Promise<File> {
    const [file] = await db.insert(files).values({
      originalName: data.originalName,
      storagePath: data.storagePath,
      fileSize: data.fileSize,
      fileType: data.fileType,
      sha256: data.sha256,
      status: data.status,
      uploadedBy: data.uploadedBy,
      metadata: data.metadata || null,
      errorCode: data.errorCode || null,
      errorMessage: data.errorMessage || null
    }).returning();
    
    return file;
  }
  
  async getFile(id: number): Promise<File | undefined> {
    const [file] = await db.select().from(files).where(eq(files.id, id));
    return file;
  }
  
  async updateFile(id: number, updates: Partial<File>): Promise<File | undefined> {
    const [updatedFile] = await db.update(files)
      .set(updates)
      .where(eq(files.id, id))
      .returning();
    
    return updatedFile;
  }
  
  async listFiles(filters?: {
    status?: string;
    partnerId?: number;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ files: File[], total: number }> {
    // Create a base query for files
    let filesQuery = db.select().from(files);
    let countQuery = db.select().from(files);
    
    // Create a filter array to hold conditions
    let conditions = [];
    
    // Add conditions based on filters
    if (filters?.status) {
      conditions.push(eq(files.status, filters.status));
    }
    
    if (filters?.startDate) {
      conditions.push(gte(files.uploadedAt, filters.startDate));
    }
    
    if (filters?.endDate) {
      conditions.push(lte(files.uploadedAt, filters.endDate));
    }
    
    // Apply the conditions to both queries
    if (conditions.length > 0) {
      filesQuery = filesQuery.where(and(...conditions));
      countQuery = countQuery.where(and(...conditions));
    }
    
    // Handle partner filtering if requested
    if (filters?.partnerId) {
      // First get the fileIds associated with this partner
      const fileIdsResult = await db.select({ fileId: transmissions.fileId })
        .from(transmissions)
        .where(eq(transmissions.partnerId, filters.partnerId));
      
      if (fileIdsResult.length === 0) {
        // No transmissions for this partner, return empty result
        return { files: [], total: 0 };
      }
      
      // Get all file IDs for this partner
      const partnerFileIds = fileIdsResult.map(r => r.fileId);
      
      // Get the files that match both the filter conditions and are in the partner's files
      const allFiles = await filesQuery.orderBy(desc(files.uploadedAt));
      const filteredFiles = allFiles.filter(file => partnerFileIds.includes(file.id));
      
      // Apply pagination
      const start = filters?.offset || 0;
      const end = start + (filters?.limit || filteredFiles.length);
      const paginatedFiles = filteredFiles.slice(start, end);
      
      return { 
        files: paginatedFiles, 
        total: filteredFiles.length 
      };
    }
    
    // Get count - this is now simpler
    const [countResult] = await countQuery;
    const total = countResult ? Object.keys(countResult).length : 0;
    
    // Apply sorting and pagination for the standard case
    filesQuery = filesQuery.orderBy(desc(files.uploadedAt));
    
    if (filters?.limit !== undefined) {
      filesQuery = filesQuery.limit(filters.limit);
    }
    
    if (filters?.offset !== undefined) {
      filesQuery = filesQuery.offset(filters.offset);
    }
    
    // Execute the query
    const filesResult = await filesQuery;
    
    return { 
      files: filesResult, 
      total: total || filesResult.length 
    };
  }
  
  async createTransmission(data: InsertTransmission): Promise<Transmission> {
    const [transmission] = await db.insert(transmissions).values({
      status: data.status,
      partnerId: data.partnerId,
      fileId: data.fileId,
      transportType: data.transportType,
      sentBy: data.sentBy,
      errorMessage: data.errorMessage || null,
      deliveryConfirmation: data.deliveryConfirmation || null,
      retryCount: 0,
      nextRetryAt: null
    }).returning();
    
    return transmission;
  }
  
  async getTransmission(id: number): Promise<Transmission | undefined> {
    const [transmission] = await db.select().from(transmissions).where(eq(transmissions.id, id));
    return transmission;
  }
  
  async updateTransmission(id: number, updates: Partial<Transmission>): Promise<Transmission | undefined> {
    const [updatedTransmission] = await db.update(transmissions)
      .set(updates)
      .where(eq(transmissions.id, id))
      .returning();
    
    return updatedTransmission;
  }
  
  async listTransmissionsForFile(fileId: number): Promise<Transmission[]> {
    return db.select()
      .from(transmissions)
      .where(eq(transmissions.fileId, fileId))
      .orderBy(desc(transmissions.sentAt));
  }
  
  async getFileTransmissionHistory(fileId: number): Promise<(Transmission & { partner: Partner })[]> {
    // First get all transmissions for this file
    const transmissionsList = await this.listTransmissionsForFile(fileId);
    
    if (transmissionsList.length === 0) {
      return [];
    }
    
    // Build the result by fetching each partner individually
    const result: (Transmission & { partner: Partner })[] = [];
    
    for (const transmission of transmissionsList) {
      // Get the partner for this transmission
      const partner = await this.getPartner(transmission.partnerId);
      
      if (partner) {
        result.push({
          ...transmission,
          partner
        });
      }
    }
    
    return result;
  }
  
  async storeFileData(data: Buffer, fileId: number): Promise<string> {
    // For now, we'll keep file data in memory
    // In production, this would store in a file system or object storage
    this.fileDataStorage.set(fileId, data);
    return fileId.toString();
  }
  
  async retrieveFileData(fileId: number): Promise<Buffer | undefined> {
    // First try to get from memory cache
    const fileDataFromMemory = this.fileDataStorage.get(fileId);
    if (fileDataFromMemory) {
      return fileDataFromMemory;
    }
    
    // If not in memory, try to load from the file system
    try {
      // Get file info to determine original name
      const file = await this.getFile(fileId);
      if (!file) {
        return undefined;
      }
      
      // Check if this is one of our sample files in attached_assets
      if (file.originalName.startsWith('shipment_')) {
        const samplePath = path.join(process.cwd(), 'attached_assets', file.originalName);
        console.log(`File data not in memory, trying to load from: ${samplePath}`);
        
        try {
          // Try to read the file
          const fileContent = await fs.readFile(samplePath);
          console.log(`Successfully loaded file data for ${file.originalName} from disk`);
          
          // Store in memory for future use
          this.fileDataStorage.set(fileId, fileContent);
          return fileContent;
        } catch (err) {
          console.error(`Error loading file from ${samplePath}:`, err);
        }
      }
    } catch (err) {
      console.error(`Error in retrieveFileData fallback for fileId ${fileId}:`, err);
    }
    
    // If we get here, we couldn't find the file data
    return undefined;
  }
  
  // Pre-signed URL management
  
  /**
   * Create a new pre-signed link for a file to share with a partner
   */
  async createPresignedLink(link: InsertPresignedLink): Promise<PresignedLink> {
    // Generate UUID if not provided
    if (!link.uuid) {
      link.uuid = uuidv4();
    }
    
    // Hash the URL for security
    if (!link.urlHash) {
      const hash = crypto.createHash('sha256');
      hash.update(link.uuid);
      link.urlHash = hash.digest('hex');
    }
    
    // Insert the link record
    const [newLink] = await db
      .insert(presignedLinks)
      .values(link)
      .returning();
      
    return newLink;
  }
  
  /**
   * Get a pre-signed link by its UUID
   */
  async getPresignedLinkByUuid(uuid: string): Promise<PresignedLink | undefined> {
    const [link] = await db
      .select()
      .from(presignedLinks)
      .where(eq(presignedLinks.uuid, uuid));
      
    return link;
  }
  
  /**
   * Update a pre-signed link's properties
   */
  async updatePresignedLink(id: number, updates: Partial<PresignedLink>): Promise<PresignedLink | undefined> {
    const [updatedLink] = await db
      .update(presignedLinks)
      .set(updates)
      .where(eq(presignedLinks.id, id))
      .returning();
      
    return updatedLink;
  }
  
  /**
   * List all pre-signed links for a partner, with file details
   */
  async listPresignedLinksForPartner(partnerId: number, includeExpired: boolean = false): Promise<(PresignedLink & { file: File })[]> {
    const now = new Date();
    
    // Build query conditions
    const conditions = [
      eq(presignedLinks.partnerId, partnerId),
    ];
    
    // Only include active links unless explicitly asked for expired ones
    if (!includeExpired) {
      conditions.push(gte(presignedLinks.expiresAt, now));
    }
    
    // Get links with file information
    const links = await db
      .select({
        ...presignedLinks,
        file: files,
      })
      .from(presignedLinks)
      .where(and(...conditions))
      .innerJoin(files, eq(presignedLinks.fileId, files.id))
      .orderBy(desc(presignedLinks.createdAt));
      
    return links;
  }
  
  /**
   * List all pre-signed links created for a specific file
   */
  async listPresignedLinksForFile(fileId: number): Promise<(PresignedLink & { partner: Partner })[]> {
    const links = await db
      .select({
        ...presignedLinks,
        partner: partners,
      })
      .from(presignedLinks)
      .where(eq(presignedLinks.fileId, fileId))
      .innerJoin(partners, eq(presignedLinks.partnerId, partners.id))
      .orderBy(desc(presignedLinks.createdAt));
      
    return links;
  }
  
  /**
   * Generate a pre-signed URL for downloading a file
   * For simplicity, we're just creating a URL with a UUID that our server will validate
   * In production, you would use S3 pre-signed URLs or similar technology
   */
  async generatePresignedUrl(fileId: number, expirationSeconds: number = 172800, requestHost?: string): Promise<string> {
    const uuid = uuidv4();
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expirationSeconds);
    
    // Create the hash for validation
    const hash = crypto.createHash('sha256');
    hash.update(uuid);
    const urlHash = hash.digest('hex');
    
    // Create the pre-signed link in the database
    await this.createPresignedLink({
      fileId,
      partnerId: 0, // This will be updated later when sending to a specific partner
      uuid,
      urlHash,
      expiresAt,
      createdBy: 1, // Default to admin user for system-generated URLs
      isOneTimeUse: false,
      ipRestriction: null
    });
    
    // Generate the URL using the host from the request if available
    // This ensures the URL will work in any environment (localhost, Replit, etc.)
    let protocol = 'https';
    let host = requestHost || 'localhost:3000';
    
    console.log("Generating presigned URL with environment:");
    console.log(`REPLIT_DOMAINS: ${process.env.REPLIT_DOMAINS}`);
    
    // Force Replit domain for all URLs if in Replit environment
    if (process.env.REPLIT_DOMAINS) {
      protocol = 'https';
      host = process.env.REPLIT_DOMAINS;
      console.log(`Using REPLIT_DOMAINS: ${host}`);
    } else if (process.env.REPLIT_DEV_DOMAIN) {
      protocol = 'https';
      host = process.env.REPLIT_DEV_DOMAIN;
      console.log(`Using REPLIT_DEV_DOMAIN: ${host}`);
    } else if (host.includes('localhost')) {
      protocol = 'http';
      console.log(`Using localhost URL`);
    }
    
    const downloadUrl = `${protocol}://${host}/api/download/${uuid}`;
    console.log(`Generated pre-signed URL: ${downloadUrl}`);
    
    return downloadUrl;
  }

  // Purchase Order Management

  async createPurchaseOrder(order: InsertPurchaseOrder): Promise<PurchaseOrder> {
    const [purchaseOrder] = await db.insert(purchaseOrders).values({
      poNumber: order.poNumber,
      supplierGln: order.supplierGln,
      customer: order.customer || null,
      orderDate: order.orderDate,
      expectedDeliveryDate: order.expectedDeliveryDate || null,
      status: order.status || 'open',
      createdBy: order.createdBy,
      partnerId: order.partnerId,
      metadata: order.metadata || null
    }).returning();
    
    return purchaseOrder;
  }

  async getPurchaseOrder(id: number): Promise<PurchaseOrder | undefined> {
    const [purchaseOrder] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
    return purchaseOrder;
  }

  async getPurchaseOrderByPoNumber(poNumber: string): Promise<PurchaseOrder | undefined> {
    const [purchaseOrder] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.poNumber, poNumber));
    return purchaseOrder;
  }

  async updatePurchaseOrder(id: number, updates: Partial<PurchaseOrder>): Promise<PurchaseOrder | undefined> {
    const [updatedOrder] = await db.update(purchaseOrders)
      .set(updates)
      .where(eq(purchaseOrders.id, id))
      .returning();
    
    return updatedOrder;
  }

  async listPurchaseOrders(filters?: {
    status?: string;
    supplierGln?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ orders: PurchaseOrder[], total: number }> {
    try {
      // Build the where conditions
      const conditions = [];
      
      if (filters?.status) {
        conditions.push(eq(purchaseOrders.status, filters.status));
      }
      
      if (filters?.supplierGln) {
        conditions.push(eq(purchaseOrders.supplierGln, filters.supplierGln));
      }
      
      if (filters?.startDate) {
        conditions.push(gte(purchaseOrders.orderDate, filters.startDate));
      }
      
      if (filters?.endDate) {
        conditions.push(lte(purchaseOrders.orderDate, filters.endDate));
      }
      
      // Build the base query
      let query = db.select().from(purchaseOrders);
      
      // Apply conditions if any
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      // Apply sorting
      query = query.orderBy(desc(purchaseOrders.orderDate));
      
      // Get all results for counting
      const allResults = await query;
      const total = allResults.length;
      
      // Apply pagination manually
      const start = filters?.offset || 0;
      const limit = filters?.limit || 50;
      const paginatedResults = allResults.slice(start, start + limit);
      
      return { 
        orders: paginatedResults, 
        total 
      };
    } catch (error) {
      console.error('Error in listPurchaseOrders:', error);
      return { orders: [], total: 0 };
    }
  }

  // Purchase Order Items management
  
  async createPurchaseOrderItem(item: InsertPurchaseOrderItem): Promise<PurchaseOrderItem> {
    const [newItem] = await db
      .insert(purchaseOrderItems)
      .values({
        poId: item.poId,
        lineNumber: item.lineNumber,
        gtin: item.gtin,
        ndc: item.ndc || null,
        productCode: item.productCode || null,
        productName: item.productName,
        packageType: item.packageType || null,
        quantity: item.quantity,
        quantityReceived: item.quantityReceived || 0,
        quantityRejected: item.quantityRejected || 0,
        lotNumber: item.lotNumber || null,
        expirationDate: item.expirationDate || null,
        unitPrice: item.unitPrice || null,
        notes: item.notes || null,
        productType: item.productType || "finished_good"
      })
      .returning();
    return newItem;
  }
  
  async getPurchaseOrderItem(id: number): Promise<PurchaseOrderItem | undefined> {
    const [item] = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.id, id));
    return item;
  }
  
  async updatePurchaseOrderItem(id: number, updates: Partial<PurchaseOrderItem>): Promise<PurchaseOrderItem | undefined> {
    const [updatedItem] = await db
      .update(purchaseOrderItems)
      .set(updates)
      .where(eq(purchaseOrderItems.id, id))
      .returning();
    return updatedItem;
  }
  
  async listPurchaseOrderItems(poId: number): Promise<PurchaseOrderItem[]> {
    return db
      .select()
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.poId, poId))
      .orderBy(purchaseOrderItems.lineNumber);
  }
  
  async deletePurchaseOrderItem(id: number): Promise<boolean> {
    const result = await db
      .delete(purchaseOrderItems)
      .where(eq(purchaseOrderItems.id, id))
      .returning();
    return result.length > 0;
  }

  // Sales Order methods
  async createSalesOrder(order: InsertSalesOrder): Promise<SalesOrder> {
    const [newOrder] = await db.insert(salesOrders)
      .values({
        customerId: order.customerId,
        soNumber: order.soNumber,
        orderDate: order.orderDate || new Date(),
        requestedShipDate: order.requestedShipDate,
        status: order.status || "draft",
        notes: order.notes,
        createdBy: order.createdBy,
        customerGln: order.customerGln,
        shipFromLocationId: order.shipFromLocationId,
        shipToLocationId: order.shipToLocationId,
        erpReference: order.erpReference
      })
      .returning();
    return newOrder;
  }
  
  async getSalesOrder(id: number): Promise<SalesOrder | undefined> {
    const [order] = await db.select()
      .from(salesOrders)
      .where(eq(salesOrders.id, id));
    return order;
  }
  
  async getSalesOrderBySoNumber(soNumber: string): Promise<SalesOrder | undefined> {
    const [order] = await db.select()
      .from(salesOrders)
      .where(eq(salesOrders.soNumber, soNumber));
    return order;
  }
  
  async updateSalesOrder(id: number, updates: Partial<SalesOrder>): Promise<SalesOrder | undefined> {
    const [updatedOrder] = await db.update(salesOrders)
      .set(updates)
      .where(eq(salesOrders.id, id))
      .returning();
    return updatedOrder;
  }
  
  async listSalesOrders(filters?: {
    status?: string;
    customerId?: number;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ orders: SalesOrder[], total: number }> {
    const whereConditions = [];
    
    if (filters?.status) {
      whereConditions.push(eq(salesOrders.status, filters.status));
    }
    
    if (filters?.customerId) {
      whereConditions.push(eq(salesOrders.customerId, filters.customerId));
    }
    
    if (filters?.startDate) {
      whereConditions.push(gte(salesOrders.orderDate, filters.startDate));
    }
    
    if (filters?.endDate) {
      whereConditions.push(lte(salesOrders.orderDate, filters.endDate));
    }
    
    // Build the query
    let query = db.select().from(salesOrders);
    if (whereConditions.length > 0) {
      query = query.where(and(...whereConditions));
    }
    
    // Sort by orderDate in descending order (newest first)
    query = query.orderBy(desc(salesOrders.orderDate));
    
    // Apply limit and offset if provided
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    
    if (filters?.offset) {
      query = query.offset(filters.offset);
    }
    
    const orders = await query;
    
    // Count total rows for pagination
    let countQuery = db.select({ count: sql`count(*)` }).from(salesOrders);
    if (whereConditions.length > 0) {
      countQuery = countQuery.where(and(...whereConditions));
    }
    const [result] = await countQuery;
    const total = result && result.count ? Number(result.count) : 0;
    
    // Enhance orders with customer information
    const enhancedOrders = await Promise.all(orders.map(async (order) => {
      const customer = await this.getPartner(order.customerId);
      return {
        ...order,
        customer: customer ? customer.name : "Unknown Customer"
      };
    }));

    return { orders: enhancedOrders, total };
  }
  
  // Sales Order Items methods
  async createSalesOrderItem(item: InsertSalesOrderItem): Promise<SalesOrderItem> {
    const [newItem] = await db.insert(salesOrderItems)
      .values({
        salesOrderId: item.salesOrderId,
        lineNumber: item.lineNumber,
        gtin: item.gtin,
        productName: item.productName,
        quantity: item.quantity,
        quantityUnit: item.quantityUnit || "EA",
        quantityShipped: item.quantityShipped || 0,
        ndc: item.ndc,
        manufacturer: item.manufacturer,
        price: item.price,
        packageSize: item.packageSize,
        packageType: item.packageType,
        packageLevelId: item.packageLevelId || "0",
        serialNumbersAllocated: item.serialNumbersAllocated || 0,
        serialNumbersShipped: item.serialNumbersShipped || 0,
        status: item.status || "pending",
        lotNumber: item.lotNumber,
        expirationDate: item.expirationDate,
        discount: item.discount,
        taxRate: item.taxRate,
        notes: item.notes,
      })
      .returning();
    return newItem;
  }
  
  async getSalesOrderItem(id: number): Promise<SalesOrderItem | undefined> {
    const [item] = await db.select()
      .from(salesOrderItems)
      .where(eq(salesOrderItems.id, id));
    return item;
  }
  
  async updateSalesOrderItem(id: number, updates: Partial<SalesOrderItem>): Promise<SalesOrderItem | undefined> {
    const [updatedItem] = await db.update(salesOrderItems)
      .set(updates)
      .where(eq(salesOrderItems.id, id))
      .returning();
    return updatedItem;
  }
  
  async listSalesOrderItems(soId: number): Promise<SalesOrderItem[]> {
    const items = await db.select()
      .from(salesOrderItems)
      .where(eq(salesOrderItems.salesOrderId, soId))
      .orderBy(salesOrderItems.lineNumber);
    return items;
  }
  
  async deleteSalesOrderItem(id: number): Promise<boolean> {
    const result = await db.delete(salesOrderItems)
      .where(eq(salesOrderItems.id, id))
      .returning();
    return result.length > 0;
  }

  // EPCIS-PO Association management

  async createEpcisPoAssociation(association: InsertEpcisPoAssociation): Promise<EpcisPoAssociation> {
    const [newAssociation] = await db.insert(epcisPoAssociations).values({
      fileId: association.fileId,
      poId: association.poId,
      associationMethod: association.associationMethod,
      confidence: association.confidence || null,
      createdBy: association.createdBy,
      notes: association.notes || null
    }).returning();
    
    return newAssociation;
  }

  async getEpcisPoAssociation(id: number): Promise<EpcisPoAssociation | undefined> {
    const [association] = await db.select().from(epcisPoAssociations).where(eq(epcisPoAssociations.id, id));
    return association;
  }

  async updateEpcisPoAssociation(id: number, updates: Partial<EpcisPoAssociation>): Promise<EpcisPoAssociation | undefined> {
    const [updatedAssociation] = await db.update(epcisPoAssociations)
      .set(updates)
      .where(eq(epcisPoAssociations.id, id))
      .returning();
    
    return updatedAssociation;
  }

  async listEpcisPoAssociationsForFile(fileId: number): Promise<(EpcisPoAssociation & { po: PurchaseOrder })[]> {
    const associations = await db
      .select({
        ...epcisPoAssociations,
        po: purchaseOrders,
      })
      .from(epcisPoAssociations)
      .where(eq(epcisPoAssociations.fileId, fileId))
      .innerJoin(purchaseOrders, eq(epcisPoAssociations.poId, purchaseOrders.id))
      .orderBy(desc(epcisPoAssociations.createdAt));
      
    return associations;
  }

  async listEpcisPoAssociationsForPO(poId: number): Promise<(EpcisPoAssociation & { file: File })[]> {
    const associations = await db
      .select({
        ...epcisPoAssociations,
        file: files,
      })
      .from(epcisPoAssociations)
      .where(eq(epcisPoAssociations.poId, poId))
      .innerJoin(files, eq(epcisPoAssociations.fileId, files.id))
      .orderBy(desc(epcisPoAssociations.createdAt));
      
    return associations;
  }

  // Product Item Management

  async createProductItem(item: InsertProductItem): Promise<ProductItem> {
    const [productItem] = await db.insert(productItems).values({
      fileId: item.fileId,
      gtin: item.gtin,
      serialNumber: item.serialNumber,
      lotNumber: item.lotNumber,
      expirationDate: item.expirationDate,
      eventTime: item.eventTime,
      sourceGln: item.sourceGln || null,
      destinationGln: item.destinationGln || null,
      bizTransactionList: item.bizTransactionList || null,
      poId: item.poId || null
    }).returning();
    
    return productItem;
  }

  async getProductItem(id: number): Promise<ProductItem | undefined> {
    const [item] = await db.select().from(productItems).where(eq(productItems.id, id));
    return item;
  }

  async findProductItemBySGTIN(gtin: string, serialNumber: string): Promise<ProductItem | undefined> {
    const [item] = await db.select()
      .from(productItems)
      .where(and(
        eq(productItems.gtin, gtin),
        eq(productItems.serialNumber, serialNumber)
      ));
    return item;
  }

  async findProductItemsByLot(gtin: string, lotNumber: string): Promise<ProductItem[]> {
    return db.select()
      .from(productItems)
      .where(and(
        eq(productItems.gtin, gtin),
        eq(productItems.lotNumber, lotNumber)
      ));
  }

  async listProductItemsForFile(fileId: number): Promise<ProductItem[]> {
    return db.select()
      .from(productItems)
      .where(eq(productItems.fileId, fileId))
      .orderBy(desc(productItems.eventTime));
  }

  async listProductItemsForPO(poId: number): Promise<ProductItem[]> {
    return db.select()
      .from(productItems)
      .where(eq(productItems.poId, poId))
      .orderBy(desc(productItems.eventTime));
  }

  // Scanned Item Management

  async createScannedItem(item: InsertScannedItem): Promise<ScannedItem> {
    const [scannedItem] = await db.insert(scannedItems).values({
      gtin: item.gtin,
      serialNumber: item.serialNumber,
      lotNumber: item.lotNumber,
      expirationDate: item.expirationDate,
      rawData: item.rawData,
      scannedBy: item.scannedBy,
      scannedVia: item.scannedVia,
      productItemId: item.productItemId || null,
      matchResult: item.matchResult,
      mismatchReason: item.mismatchReason || null,
      poId: item.poId || null
    }).returning();
    
    return scannedItem;
  }

  async getScannedItem(id: number): Promise<ScannedItem | undefined> {
    const [item] = await db.select().from(scannedItems).where(eq(scannedItems.id, id));
    return item;
  }

  async updateScannedItem(id: number, updates: Partial<ScannedItem>): Promise<ScannedItem | undefined> {
    const [updatedItem] = await db.update(scannedItems)
      .set(updates)
      .where(eq(scannedItems.id, id))
      .returning();
    
    return updatedItem;
  }

  async listScannedItemsForSession(sessionId: number): Promise<ScannedItem[]> {
    // We need to join with validation_sessions and get items scanned within the session timeframe
    const session = await this.getValidationSession(sessionId);
    
    if (!session) {
      return [];
    }
    
    let query = db.select()
      .from(scannedItems)
      .where(
        and(
          eq(scannedItems.scannedBy, session.startedBy),
          gte(scannedItems.scannedAt, session.startedAt)
        )
      );
    
    // If session is completed, add end time boundary
    if (session.completedAt) {
      query = query.where(lte(scannedItems.scannedAt, session.completedAt));
    }
    
    // If session has PO associated, filter by that PO
    if (session.poId) {
      query = query.where(eq(scannedItems.poId, session.poId));
    }
    
    return query.orderBy(desc(scannedItems.scannedAt));
  }

  // Validation Session Management

  async createValidationSession(session: InsertValidationSession): Promise<ValidationSession> {
    const [validationSession] = await db.insert(validationSessions).values({
      poId: session.poId || null,
      fileId: session.fileId || null,
      startedBy: session.startedBy,
      status: session.status || 'in_progress',
      notes: session.notes || null
    }).returning();
    
    return validationSession;
  }

  async getValidationSession(id: number): Promise<ValidationSession | undefined> {
    const [session] = await db.select().from(validationSessions).where(eq(validationSessions.id, id));
    return session;
  }

  async updateValidationSession(id: number, updates: Partial<ValidationSession>): Promise<ValidationSession | undefined> {
    const [updatedSession] = await db.update(validationSessions)
      .set(updates)
      .where(eq(validationSessions.id, id))
      .returning();
    
    return updatedSession;
  }

  async listValidationSessionsForPO(poId: number): Promise<ValidationSession[]> {
    return db.select()
      .from(validationSessions)
      .where(eq(validationSessions.poId, poId))
      .orderBy(desc(validationSessions.startedAt));
  }

  // Audit Log Management

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [auditLog] = await db.insert(auditLogs).values({
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      userId: log.userId,
      details: log.details || null,
      ipAddress: log.ipAddress || null
    }).returning();
    
    return auditLog;
  }

  async listAuditLogs(entityType?: string, entityId?: number, limit?: number, offset?: number): Promise<{ logs: AuditLog[], total: number }> {
    // Create base queries
    let logsQuery = db.select().from(auditLogs);
    let countQuery = db.select().from(auditLogs);
    
    // Apply entity filtering if specified
    if (entityType && entityId) {
      logsQuery = logsQuery.where(
        and(
          eq(auditLogs.entityType, entityType),
          eq(auditLogs.entityId, entityId)
        )
      );
      
      countQuery = countQuery.where(
        and(
          eq(auditLogs.entityType, entityType),
          eq(auditLogs.entityId, entityId)
        )
      );
    } else if (entityType) {
      logsQuery = logsQuery.where(eq(auditLogs.entityType, entityType));
      countQuery = countQuery.where(eq(auditLogs.entityType, entityType));
    } else if (entityId) {
      logsQuery = logsQuery.where(eq(auditLogs.entityId, entityId));
      countQuery = countQuery.where(eq(auditLogs.entityId, entityId));
    }
    
    // Get total count
    const [countResult] = await countQuery;
    const total = countResult ? Object.keys(countResult).length : 0;
    
    // Apply sorting and pagination
    logsQuery = logsQuery.orderBy(desc(auditLogs.timestamp));
    
    if (limit !== undefined) {
      logsQuery = logsQuery.limit(limit);
    }
    
    if (offset !== undefined) {
      logsQuery = logsQuery.offset(offset);
    }
    
    // Execute the query
    const logsResult = await logsQuery;
    
    return { 
      logs: logsResult, 
      total: total || logsResult.length 
    };
  }

  // Inventory Management
  
  async createInventoryItem(item: InsertInventory): Promise<Inventory> {
    const [newItem] = await db.insert(inventory)
      .values({
        gtin: item.gtin,
        serialNumber: item.serialNumber,
        lotNumber: item.lotNumber,
        expirationDate: item.expirationDate,
        ndc: item.ndc,
        productName: item.productName,
        manufacturer: item.manufacturer,
        status: item.status || "available",
        packageType: item.packageType || "each",
        receivedVia: item.receivedVia || "epcis",
        receivedAt: item.receivedAt || new Date(),
        sourceFileId: item.sourceFileId,
        sourcePoId: item.sourcePoId,
        warehouse: item.warehouse || "default",
        location: item.location,
        notes: item.notes,
        createdBy: item.createdBy
      })
      .returning();
    return newItem;
  }
  
  async getInventoryItem(id: number): Promise<Inventory | undefined> {
    const [item] = await db.select()
      .from(inventory)
      .where(eq(inventory.id, id));
    return item;
  }
  
  async getInventoryBySGTIN(gtin: string, serialNumber: string): Promise<Inventory | undefined> {
    const [item] = await db.select()
      .from(inventory)
      .where(and(
        eq(inventory.gtin, gtin),
        eq(inventory.serialNumber, serialNumber)
      ));
    return item;
  }
  
  async createInventoryFromFile(fileId: number, userId: number): Promise<number> {
    // Get file and its metadata
    const file = await this.getFile(fileId);
    if (!file) {
      throw new Error(`File with ID ${fileId} not found`);
    }
    
    // Get all product items for this file
    const productItems = await this.listProductItemsForFile(fileId);
    if (productItems.length === 0) {
      return 0;
    }
    
    // Get product details from file metadata
    const metadata = file.metadata as any;
    const productName = metadata?.productInfo?.name || "";
    const manufacturer = metadata?.productInfo?.manufacturer || "";
    const ndc = metadata?.productInfo?.ndc || "";
    
    // Process each product item and create inventory item
    let createdCount = 0;
    
    for (const item of productItems) {
      // Check if this item already exists in inventory
      const existing = await this.getInventoryBySGTIN(item.gtin, item.serialNumber);
      if (existing) {
        continue; // Skip if already in inventory
      }
      
      // Determine package type based on GTIN indicator digit (position 7)
      // '0' is item/each, '5' is case
      const packageType = item.gtin.charAt(7) === '5' ? 'case' : 'each';
      
      // Create inventory item
      const inventoryItem: InsertInventory = {
        gtin: item.gtin,
        serialNumber: item.serialNumber,
        lotNumber: item.lotNumber,
        expirationDate: new Date(item.expirationDate),
        ndc: ndc,
        productName: productName,
        manufacturer: manufacturer,
        status: 'available',
        packageType: packageType,
        receivedVia: 'epcis',
        receivedAt: new Date(),
        sourceFileId: fileId,
        sourcePoId: item.poId,
        warehouse: 'default',
        location: null,
        notes: `Created from EPCIS file ${file.originalName}`,
        createdBy: userId
      };
      
      await this.createInventoryItem(inventoryItem);
      createdCount++;
      
      // Create an audit log entry
      await this.createAuditLog({
        action: 'create_inventory_from_epcis',
        entityType: 'inventory',
        entityId: createdCount, // This is not the actual ID but we don't have it yet
        userId: userId,
        details: { 
          fileId: fileId,
          fileName: file.originalName,
          gtin: item.gtin,
          serialNumber: item.serialNumber
        },
        ipAddress: null
      });
    }
    
    return createdCount;
  }
  
  async updateInventoryItem(id: number, updates: Partial<Inventory>): Promise<Inventory | undefined> {
    // If updating status, set lastMovementDate to current date
    if (updates.status) {
      updates.lastMovementDate = new Date();
    }
    
    const [updatedItem] = await db.update(inventory)
      .set(updates)
      .where(eq(inventory.id, id))
      .returning();
    return updatedItem;
  }
  
  async listInventory(filters?: {
    status?: string;
    gtin?: string;
    lotNumber?: string;
    productName?: string;
    packageType?: string;
    warehouse?: string;
    poId?: number;
    soId?: number;
    expirationStart?: Date;
    expirationEnd?: Date;
    limit?: number | string;
    offset?: number | string;
  }): Promise<{ items: Inventory[], total: number }> {
    const whereConditions = [];
    
    if (filters?.status) {
      whereConditions.push(eq(inventory.status, filters.status));
    }
    
    if (filters?.warehouse) {
      whereConditions.push(eq(inventory.locationId, parseInt(filters.warehouse as string)));
    }
    
    if (filters?.poId) {
      whereConditions.push(eq(inventory.poItemId, filters.poId));
    }
    
    if (filters?.soId) {
      whereConditions.push(eq(inventory.soItemId, filters.soId));
    }
    
    if (filters?.productName) {
      whereConditions.push(like(inventory.productName, `%${filters.productName}%`));
    }
    
    if (filters?.packageType) {
      whereConditions.push(eq(inventory.packageType, filters.packageType));
    }
    
    if (filters?.gtin) {
      whereConditions.push(eq(inventory.gtin, filters.gtin));
    }
    
    if (filters?.lotNumber) {
      whereConditions.push(eq(inventory.lotNumber, filters.lotNumber));
    }
    
    if (filters?.expirationEnd) {
      whereConditions.push(lte(inventory.expirationDate, filters.expirationEnd));
    }
    
    if (filters?.expirationStart) {
      whereConditions.push(gte(inventory.expirationDate, filters.expirationStart));
    }
    
    // Build the query
    let query = db.select().from(inventory);
    if (whereConditions.length > 0) {
      query = query.where(and(...whereConditions));
    }
    
    // Sort by inventory ID (default) or receivedDate in descending order
    query = query.orderBy(desc(inventory.receivedAt));
    
    // Apply limit and offset if provided - convert to numbers to ensure proper SQL formatting
    if (filters?.limit !== undefined) {
      const limitValue = typeof filters.limit === 'string' ? 
                         parseInt(filters.limit) : 
                         filters.limit;
      query = query.limit(limitValue);
    }
    
    if (filters?.offset !== undefined) {
      const offsetValue = typeof filters.offset === 'string' ? 
                          parseInt(filters.offset) : 
                          filters.offset;
      query = query.offset(offsetValue);
    }
    
    const items = await query;
    
    // Count total rows for pagination
    let countQuery = db.select({ count: sql`count(*)` }).from(inventory);
    if (whereConditions.length > 0) {
      countQuery = countQuery.where(and(...whereConditions));
    }
    const [result] = await countQuery;
    const total = result ? Number(result.count) || 0 : 0;
    
    return { items, total };
  }
  
  async getInventorySummary(gtin?: string, locationId?: number): Promise<{ 
    gtin: string; 
    productName: string | null;
    totalQuantity: number; 
    availableQuantity: number;
    allocatedQuantity: number;
    shippedQuantity: number;
    locationId: number | null;
    earliestExpirationDate: Date | null;
  }[]> {
    // This is a complex query that summarizes inventory by product (GTIN)
    // We'll simplify by just doing separate queries
    
    const whereConditions = [];
    
    if (gtin) {
      whereConditions.push(eq(inventory.gtin, gtin));
    }
    
    if (locationId) {
      whereConditions.push(eq(inventory.locationId, locationId));
    }
    
    const items = await db.select().from(inventory);
    if (whereConditions.length > 0) {
      whereConditions.push(and(...whereConditions));
    }
    
    // Group by GTIN
    const summaryMap = new Map<string, {
      gtin: string;
      productName: string | null;
      totalQuantity: number;
      availableQuantity: number;
      allocatedQuantity: number;
      shippedQuantity: number;
      locationId: number | null;
      earliestExpirationDate: Date | null;
    }>();
    
    for (const item of items) {
      const locationKey = item.locationId ? `${item.gtin}-${item.locationId}` : item.gtin;
      
      if (!summaryMap.has(locationKey)) {
        summaryMap.set(locationKey, {
          gtin: item.gtin,
          productName: null, // We could join with product info, but we don't have that table
          totalQuantity: 0,
          availableQuantity: 0,
          allocatedQuantity: 0,
          shippedQuantity: 0,
          locationId: item.locationId,
          earliestExpirationDate: item.expirationDate
        });
      }
      
      const summary = summaryMap.get(locationKey)!;
      
      // Update quantities based on status
      summary.totalQuantity += item.quantity;
      
      if (item.status === 'available') {
        summary.availableQuantity += item.quantity;
      } else if (item.status === 'allocated') {
        summary.allocatedQuantity += item.quantity;
      } else if (item.status === 'shipped') {
        summary.shippedQuantity += item.quantity;
      }
      
      // Update earliest expiration date
      if (item.expirationDate && summary.earliestExpirationDate) {
        if (item.expirationDate < summary.earliestExpirationDate) {
          summary.earliestExpirationDate = item.expirationDate;
        }
      } else if (item.expirationDate) {
        summary.earliestExpirationDate = item.expirationDate;
      }
    }
    
    return Array.from(summaryMap.values());
  }
  
  async createInventoryTransaction(transaction: InsertInventoryTransaction): Promise<InventoryTransaction> {
    const [newTransaction] = await db.insert(inventoryTransactions)
      .values({
        inventoryId: transaction.inventoryId,
        transactionType: transaction.transactionType,
        quantity: transaction.quantity,
        fromStatus: transaction.fromStatus,
        toStatus: transaction.toStatus,
        fromLocationId: transaction.fromLocationId,
        toLocationId: transaction.toLocationId,
        createdBy: transaction.createdBy,
        referenceId: transaction.referenceId,
        referenceType: transaction.referenceType,
        notes: transaction.notes,
      })
      .returning();
    return newTransaction;
  }
  
  async getInventoryTransaction(id: number): Promise<InventoryTransaction | undefined> {
    const [transaction] = await db.select()
      .from(inventoryTransactions)
      .where(eq(inventoryTransactions.id, id));
    return transaction;
  }
  
  async listInventoryTransactions(inventoryId: number): Promise<InventoryTransaction[]> {
    return db.select()
      .from(inventoryTransactions)
      .where(eq(inventoryTransactions.inventoryId, inventoryId))
      .orderBy(desc(inventoryTransactions.timestamp));
  }
  
  async allocateInventoryToSalesOrder(soItemId: number, inventoryIds: number[]): Promise<boolean> {
    // This is a complex operation that should be done within a transaction
    
    try {
      // First, get the sales order item to know what we're allocating
      const [soItem] = await db.select()
        .from(salesOrderItems)
        .where(eq(salesOrderItems.id, soItemId));
        
      if (!soItem) {
        return false;
      }
      
      // Get inventory items
      const inventoryItems = await db.select()
        .from(inventory)
        .where(and(
          eq(inventory.gtin, soItem.gtin),
          eq(inventory.status, 'available')
        ));
        
      // Check if we have enough inventory to allocate
      const totalAvailable = inventoryItems.reduce((sum, item) => sum + item.quantity, 0);
      if (totalAvailable < soItem.quantity) {
        return false;
      }
      
      // Update inventory status to 'allocated'
      for (const id of inventoryIds) {
        await db.update(inventory)
          .set({ 
            status: 'allocated', 
            soItemId: soItemId,
            lastMovementDate: new Date()
          })
          .where(eq(inventory.id, id));
          
        // Create transaction record
        await this.createInventoryTransaction({
          inventoryId: id,
          transactionType: 'allocation',
          quantity: 1, // Assuming each inventory item is 1 unit
          fromStatus: 'available',
          toStatus: 'allocated',
          fromLocationId: null,
          toLocationId: null,
          createdBy: 1, // Should be passed in from the calling function
          referenceId: soItemId,
          referenceType: 'sales_order_item',
          notes: `Allocated to sales order item #${soItemId}`
        });
      }
      
      // Update the sales order item to reflect the allocation
      await db.update(salesOrderItems)
        .set({ 
          serialNumbersAllocated: inventoryIds.length,
          status: inventoryIds.length >= soItem.quantity ? 'allocated' : 'partially_allocated'
        })
        .where(eq(salesOrderItems.id, soItemId));
        
      return true;
    } catch (error) {
      console.error('Error allocating inventory:', error);
      return false;
    }
  }
  
  async shipInventoryForSalesOrder(soId: number): Promise<boolean> {
    // This updates inventory records associated with a sales order to 'shipped' status
    try {
      // Get all items in this sales order
      const soItems = await db.select()
        .from(salesOrderItems)
        .where(eq(salesOrderItems.salesOrderId, soId));
      
      for (const item of soItems) {
        // Get all inventory allocated to this sales order item
        const inventoryItems = await db.select()
          .from(inventory)
          .where(and(
            eq(inventory.soItemId, item.id),
            eq(inventory.status, 'allocated')
          ));
          
        // Update each inventory item to shipped
        for (const invItem of inventoryItems) {
          await db.update(inventory)
            .set({ 
              status: 'shipped',
              lastMovementDate: new Date()
            })
            .where(eq(inventory.id, invItem.id));
            
          // Create transaction record
          await this.createInventoryTransaction({
            inventoryId: invItem.id,
            transactionType: 'shipment',
            quantity: invItem.quantity,
            fromStatus: 'allocated',
            toStatus: 'shipped',
            fromLocationId: invItem.locationId,
            toLocationId: null, // No longer at any of our locations
            createdBy: 1, // Should be passed in from the calling function
            referenceId: soId,
            referenceType: 'sales_order',
            notes: `Shipped with sales order #${soId}`
          });
        }
        
        // Update the sales order item
        await db.update(salesOrderItems)
          .set({ 
            serialNumbersShipped: inventoryItems.length,
            quantityShipped: inventoryItems.length,
            status: 'shipped'
          })
          .where(eq(salesOrderItems.id, item.id));
      }
      
      // Update the sales order status
      await db.update(salesOrders)
        .set({ status: 'shipped' })
        .where(eq(salesOrders.id, soId));
        
      return true;
    } catch (error) {
      console.error('Error shipping inventory:', error);
      return false;
    }
  }
  
  // Invoice management
  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    try {
      // Convert any date strings to Date objects
      const processedInvoice = {
        ...invoice,
        invoiceDate: invoice.invoiceDate instanceof Date ? invoice.invoiceDate : new Date(invoice.invoiceDate),
        dueDate: invoice.dueDate instanceof Date ? invoice.dueDate : (invoice.dueDate ? new Date(invoice.dueDate) : null),
      };
      
      // Insert into invoices table
      const [newInvoice] = await db.insert(invoices).values(processedInvoice).returning();
      return newInvoice;
    } catch (error) {
      console.error('Error creating invoice:', error);
      throw error;
    }
  }
  
  async getInvoice(id: number): Promise<Invoice | undefined> {
    try {
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
      return invoice;
    } catch (error) {
      console.error('Error getting invoice:', error);
      throw error;
    }
  }
  
  async updateInvoice(id: number, updates: Partial<Invoice>): Promise<Invoice | undefined> {
    try {
      const [updatedInvoice] = await db
        .update(invoices)
        .set(updates)
        .where(eq(invoices.id, id))
        .returning();
      return updatedInvoice;
    } catch (error) {
      console.error('Error updating invoice:', error);
      throw error;
    }
  }
  
  async listInvoices(filters?: {
    status?: string;
    purchaseOrderId?: number;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ invoices: Invoice[], total: number }> {
    try {
      let query = db.select().from(invoices);
      
      // Apply filters
      if (filters?.status) {
        query = query.where(eq(invoices.status, filters.status));
      }
      
      if (filters?.purchaseOrderId) {
        query = query.where(eq(invoices.purchaseOrderId, filters.purchaseOrderId));
      }
      
      if (filters?.startDate) {
        query = query.where(gte(invoices.invoiceDate, filters.startDate));
      }
      
      if (filters?.endDate) {
        query = query.where(lte(invoices.invoiceDate, filters.endDate));
      }
      
      // Get total count (simplified for now)
      const countResult = await db.select({ count: sql`count(*)` }).from(invoices);
      const total = Number(countResult[0]?.count || 0);
      
      // Order by uploaded date (newest first)
      query = query.orderBy(desc(invoices.uploadedAt));
      
      // Apply pagination
      if (filters?.limit !== undefined) {
        query = query.limit(filters.limit);
      }
      
      if (filters?.offset !== undefined) {
        query = query.offset(filters.offset);
      }
      
      const invoiceList = await query;
      
      return { 
        invoices: invoiceList, 
        total 
      };
    } catch (error) {
      console.error('Error listing invoices:', error);
      return { invoices: [], total: 0 };
    }
  }
  
  // Invoice Item management
  async createInvoiceItem(item: InsertInvoiceItem): Promise<InvoiceItem> {
    try {
      // Convert any date strings to Date objects
      const processedItem = {
        ...item,
        expiryDate: item.expiryDate instanceof Date ? item.expiryDate : new Date(item.expiryDate),
      };
      
      const [newItem] = await db.insert(invoiceItems).values(processedItem).returning();
      return newItem;
    } catch (error) {
      console.error('Error creating invoice item:', error);
      throw error;
    }
  }
  
  async getInvoiceItem(id: number): Promise<InvoiceItem | undefined> {
    try {
      const [item] = await db.select().from(invoiceItems).where(eq(invoiceItems.id, id));
      return item;
    } catch (error) {
      console.error('Error getting invoice item:', error);
      throw error;
    }
  }
  
  async updateInvoiceItem(id: number, updates: Partial<InvoiceItem>): Promise<InvoiceItem | undefined> {
    try {
      const [updatedItem] = await db
        .update(invoiceItems)
        .set(updates)
        .where(eq(invoiceItems.id, id))
        .returning();
      return updatedItem;
    } catch (error) {
      console.error('Error updating invoice item:', error);
      throw error;
    }
  }
  
  async listInvoiceItems(invoiceId: number): Promise<InvoiceItem[]> {
    try {
      return await db.select()
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, invoiceId));
    } catch (error) {
      console.error('Error listing invoice items:', error);
      return [];
    }
  }
  
  // EPCIS matching
  async findMatchingEpcisFiles(criteria: {
    lotNumbers?: string[];
    ndcCodes?: string[];
    gtins?: string[];
    poId?: number;
    invoiceNumber?: string;
  }): Promise<File[]> {
    try {
      // If no criteria provided, return empty array
      if (!criteria.lotNumbers?.length && !criteria.ndcCodes?.length && !criteria.gtins?.length && !criteria.poId && !criteria.invoiceNumber) {
        return [];
      }
      
      // Start with base query for product items
      let fileIds = new Set<number>();
      
      // If we have lot numbers, find matching files
      if (criteria.lotNumbers?.length) {
        // Use product items to match by lot number
        const matchingItems = await db.select()
          .from(productItems)
          .where(or(...criteria.lotNumbers.map(lot => eq(productItems.lotNumber, lot))));
        
        // Add file IDs to our set
        matchingItems.forEach(item => fileIds.add(item.fileId));
      }
      
      // If we have NDC codes, find matching files
      if (criteria.ndcCodes?.length) {
        // First convert NDC codes to GTIN format if needed
        const possibleGtins = await this.convertNdcToGtin(criteria.ndcCodes);
        
        // Add these to our GTIN criteria if we got results
        if (possibleGtins.length > 0) {
          criteria.gtins = [...(criteria.gtins || []), ...possibleGtins];
        }
      }
      
      // If we have GTIN codes, find matching files
      if (criteria.gtins?.length) {
        const gtinMatches = await db.select()
          .from(productItems)
          .where(or(...criteria.gtins.map(gtin => eq(productItems.gtin, gtin))));
        
        gtinMatches.forEach(item => fileIds.add(item.fileId));
      }
      
      // If we have a PO ID, find files associated with this PO
      if (criteria.poId) {
        const poMatches = await db.select()
          .from(epcisPoAssociations)
          .where(eq(epcisPoAssociations.poId, criteria.poId));
        
        poMatches.forEach(assoc => fileIds.add(assoc.fileId));
        
        // If we didn't find any direct associations, try to find files that might match
        // based on product data (GTIN, lot, etc.) and other metadata
        if (poMatches.length === 0) {
          // Get PO details
          const po = await this.getPurchaseOrder(criteria.poId);
          if (po) {
            // Get all items in this PO
            const poItems = await this.listPurchaseOrderItems(criteria.poId);
            
            // Extract GTINs from PO items
            const poGtins = poItems.map(item => item.gtin);
            
            // Find product items with matching GTINs
            if (poGtins.length > 0) {
              const productMatches = await db.select()
                .from(productItems)
                .where(or(...poGtins.map(gtin => eq(productItems.gtin, gtin))));
              
              productMatches.forEach(item => fileIds.add(item.fileId));
            }
          }
        }
      }
      
      // If we have an invoice number, try to find related files
      if (criteria.invoiceNumber) {
        // First try to find the invoice record
        const [invoice] = await db.select()
          .from(invoices)
          .where(eq(invoices.invoiceNumber, criteria.invoiceNumber));
        
        if (invoice) {
          // If we have a PO ID, use that to find related files
          if (invoice.purchaseOrderId) {
            const poMatches = await db.select()
              .from(epcisPoAssociations)
              .where(eq(epcisPoAssociations.poId, invoice.purchaseOrderId));
            
            poMatches.forEach(assoc => fileIds.add(assoc.fileId));
          }
          
          // Get all invoice items
          const invoiceItems = await this.listInvoiceItems(invoice.id);
          
          // Extract lot numbers from invoice items
          const lotNumbers = invoiceItems.map(item => item.lotNumber);
          
          // Find product items with matching lot numbers
          if (lotNumbers.length > 0) {
            const lotMatches = await db.select()
              .from(productItems)
              .where(or(...lotNumbers.map(lot => eq(productItems.lotNumber, lot))));
            
            lotMatches.forEach(item => fileIds.add(item.fileId));
          }
        }
      }
      
      // If we found any matching files, retrieve them
      if (fileIds.size === 0) {
        return [];
      }
      
      // Convert Set to array for our query
      const fileIdArray = Array.from(fileIds);
      
      // Retrieve the matching files
      return await db.select()
        .from(files)
        .where(or(...fileIdArray.map(id => eq(files.id, id))));
    } catch (error) {
      console.error('Error finding matching EPCIS files:', error);
      return [];
    }
  }
  
  // Helper method to convert NDC codes to GTIN format
  private async convertNdcToGtin(ndcCodes: string[]): Promise<string[]> {
    const gtins: string[] = [];
    
    for (const ndc of ndcCodes) {
      // Remove dashes or spaces if present
      const cleanNdc = ndc.replace(/[-\s]/g, '');
      
      // FDA NDC codes are 10 or 11 digits
      if (cleanNdc.length >= 10 && cleanNdc.length <= 11) {
        // Convert to GTIN-14 format by adding prefix and calculating check digit
        // For pharmaceuticals, the prefix is usually 03
        const prefix = '03';
        
        // Pad NDC to 11 digits if it's 10
        const paddedNdc = cleanNdc.length === 10 ? '0' + cleanNdc : cleanNdc;
        
        // Combine prefix and NDC to form GTIN-14 without check digit
        const gtin13 = prefix + paddedNdc;
        
        // Calculate check digit
        let sum = 0;
        for (let i = 0; i < gtin13.length; i++) {
          const digit = parseInt(gtin13[i]);
          // Apply GTIN check digit algorithm (odd positions x 3, even positions x 1)
          sum += (i % 2 === 0) ? digit : digit * 3;
        }
        
        const checkDigit = (10 - (sum % 10)) % 10;
        
        // Form the complete GTIN-14
        const gtin14 = gtin13 + checkDigit;
        gtins.push(gtin14);
      }
    }
    
    return gtins;
  }
}