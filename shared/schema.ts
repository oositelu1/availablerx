import { pgTable, text, serial, timestamp, integer, boolean, jsonb, date, varchar, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User table schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("operator"), // operator or administrator
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true, 
  createdAt: true
});

// Trading partner schema
export const partners = pgTable("partners", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  partnerType: text("partner_type").notNull(),
  contactEmail: text("contact_email").notNull(),
  notes: text("notes"),
  endpointUrl: text("endpoint_url"),
  as2Id: text("as2_id"),
  certificate: text("certificate"),
  authToken: text("auth_token"),
  transportType: text("transport_type").default("AS2"), // AS2 or HTTPS
  isActive: boolean("is_active").default(true),
  gln: varchar("gln", { length: 50 }), // Global Location Number
  licenseNumber: varchar("license_number", { length: 100 }),
  licenseExpirationDate: date("license_expiration_date"),
  stateOfLicense: varchar("state_of_license", { length: 2 }),
  complianceStatus: varchar("compliance_status", { length: 20 }).default("active"), // active, suspended, expired, pending
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").notNull(), // references users.id
});

// Create the base partner schema
const basePartnerSchema = createInsertSchema(partners).omit({
  id: true,
  createdAt: true
});

// Extend it with custom validation for Pre-Signed URL partners
export const insertPartnerSchema = z.object({
  ...basePartnerSchema.shape,
  transportType: z.enum(["AS2", "HTTPS", "PRESIGNED"]),
  endpointUrl: z.string().nullable().transform(val => {
    // If transport type is PRESIGNED, allow empty endpoint URL
    if (!val || val === "") {
      return null;
    }
    return val;
  }),
  gln: z.string().nullable().optional(),
  licenseNumber: z.string().nullable().optional(),
  licenseExpirationDate: z.date().nullable().optional(),
  stateOfLicense: z.string().nullable().optional(),
  complianceStatus: z.enum(["active", "suspended", "expired", "pending"]).optional(),
});

// Partner locations schema (addresses)
export const partnerLocations = pgTable("partner_locations", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id").notNull().references(() => partners.id),
  locationType: varchar("location_type", { length: 20 }).notNull(), // ship_from, ship_to, billing, headquarters
  name: varchar("name", { length: 200 }).notNull(),
  addressLine1: varchar("address_line1", { length: 200 }).notNull(),
  addressLine2: varchar("address_line2", { length: 200 }),
  city: varchar("city", { length: 100 }).notNull(),
  state: varchar("state", { length: 50 }).notNull(),
  postalCode: varchar("postal_code", { length: 20 }).notNull(),
  country: varchar("country", { length: 50 }).notNull().default("US"),
  gln: varchar("gln", { length: 50 }), // Location-specific GLN
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").notNull().references(() => users.id),
});

// EPCIS files schema
export const files = pgTable("files", {
  id: serial("id").primaryKey(),
  originalName: text("original_name").notNull(),
  storagePath: text("storage_path").notNull(),
  fileSize: integer("file_size").notNull(),
  fileType: text("file_type").notNull(), // ZIP or XML
  sha256: text("sha256").notNull(),
  status: text("status").notNull(), // validated, failed, sending, sent
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"), // Store extracted metadata like event counts, sender GLN, etc.
  uploadedBy: integer("uploaded_by").notNull(), // references users.id
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const insertFileSchema = createInsertSchema(files).omit({
  id: true,
  uploadedAt: true
});

// File transmissions schema
export const transmissions = pgTable("transmissions", {
  id: serial("id").primaryKey(),
  fileId: integer("file_id").notNull(), // references files.id
  partnerId: integer("partner_id").notNull(), // references partners.id
  status: text("status").notNull(), // queued, sent, failed, retrying
  transportType: text("transport_type").notNull(), // AS2 or HTTPS
  sentBy: integer("sent_by").notNull(), // references users.id
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  deliveryConfirmation: text("delivery_confirmation"), // Store MDN or HTTP response
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),
  nextRetryAt: timestamp("next_retry_at"),
});

export const insertTransmissionSchema = createInsertSchema(transmissions).omit({
  id: true,
  sentAt: true,
  retryCount: true,
  nextRetryAt: true
});

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export const insertPartnerLocationSchema = createInsertSchema(partnerLocations).omit({
  id: true,
  createdAt: true
});

export type Partner = typeof partners.$inferSelect;
export type InsertPartner = z.infer<typeof insertPartnerSchema>;

export type PartnerLocation = typeof partnerLocations.$inferSelect;
export type InsertPartnerLocation = z.infer<typeof insertPartnerLocationSchema>;

export type File = typeof files.$inferSelect;
export type InsertFile = z.infer<typeof insertFileSchema>;

export type Transmission = typeof transmissions.$inferSelect;
export type InsertTransmission = z.infer<typeof insertTransmissionSchema>;

// Pre-signed URL links for partner file sharing
export const presignedLinks = pgTable("presigned_links", {
  id: serial("id").primaryKey(),
  uuid: text("uuid").notNull(),
  fileId: integer("file_id").notNull().references(() => files.id),
  partnerId: integer("partner_id").notNull().references(() => partners.id),
  urlHash: text("url_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  firstClickedAt: timestamp("first_clicked_at"),
  downloadedAt: timestamp("downloaded_at"),
  isOneTimeUse: boolean("is_one_time_use").notNull().default(false),
  ipRestriction: text("ip_restriction"),
  createdBy: integer("created_by").notNull().references(() => users.id),
});

export const insertPresignedLinkSchema = createInsertSchema(presignedLinks);

export type PresignedLink = typeof presignedLinks.$inferSelect;
export type InsertPresignedLink = z.infer<typeof insertPresignedLinkSchema>;

// Purchase Orders schema
export const purchaseOrders = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  poNumber: varchar("po_number", { length: 50 }).notNull().unique(),
  partnerId: integer("partner_id").notNull().references(() => partners.id), // Link to supplier partner
  supplierGln: varchar("supplier_gln", { length: 50 }).notNull(),
  customer: varchar("customer", { length: 200 }), // Customer name field
  shipToLocationId: integer("ship_to_location_id").references(() => partnerLocations.id), // Optional specific ship-to location
  orderDate: date("order_date").notNull(),
  expectedShipDate: date("expected_ship_date"),
  expectedDeliveryDate: date("expected_delivery_date"),
  status: varchar("status", { length: 20 }).notNull().default("open"), // open, shipped, received, closed, cancelled
  totalItems: integer("total_items").default(0), // Total number of individual items on the PO
  receivedItems: integer("received_items").default(0), // Number of items received
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").notNull().references(() => users.id),
  lastUpdatedAt: timestamp("last_updated_at"),
  lastUpdatedBy: integer("last_updated_by").references(() => users.id),
  notes: text("notes"),
  metadata: jsonb("metadata"), // Additional PO data like line items, etc.
  erpReference: varchar("erp_reference", { length: 100 }), // Reference number in external ERP system
});

export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders).omit({
  id: true,
  createdAt: true,
  lastUpdatedAt: true,
  lastUpdatedBy: true,
  totalItems: true,
  receivedItems: true
});

// Purchase Order Line Items
export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: serial("id").primaryKey(),
  poId: integer("po_id").notNull().references(() => purchaseOrders.id),
  lineNumber: integer("line_number").notNull(),
  gtin: varchar("gtin", { length: 50 }).notNull(),
  ndc: varchar("ndc", { length: 50 }),
  productName: varchar("product_name", { length: 200 }).notNull(),
  manufacturer: varchar("manufacturer", { length: 200 }),
  quantity: integer("quantity").notNull(),
  quantityReceived: integer("quantity_received").default(0),
  packageSize: varchar("package_size", { length: 50 }),
  packageType: varchar("package_type", { length: 50 }), // e.g., "case", "each", "box"
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, partial, received, backordered, cancelled
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
  notes: text("notes"),
  erpLineReference: varchar("erp_line_reference", { length: 100 }),
});

// EPCIS-to-PO associations
export const epcisPoAssociations = pgTable("epcis_po_associations", {
  id: serial("id").primaryKey(),
  fileId: integer("file_id").notNull().references(() => files.id),
  poId: integer("po_id").notNull().references(() => purchaseOrders.id),
  associationMethod: varchar("association_method", { length: 30 }).notNull(), // direct, inferred_date, inferred_gtin, manual
  confidence: integer("confidence"), // 0-100 confidence score for non-manual associations
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").notNull().references(() => users.id),
  notes: text("notes"),
});

export const insertEpcisPoAssociationSchema = createInsertSchema(epcisPoAssociations).omit({
  id: true,
  createdAt: true
});

export const insertPurchaseOrderItemSchema = createInsertSchema(purchaseOrderItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  quantityReceived: true
});

// Product items from EPCIS files
export const productItems = pgTable("product_items", {
  id: serial("id").primaryKey(),
  fileId: integer("file_id").notNull().references(() => files.id),
  gtin: varchar("gtin", { length: 50 }).notNull(),
  serialNumber: varchar("serial_number", { length: 100 }).notNull(),
  lotNumber: varchar("lot_number", { length: 50 }).notNull(),
  expirationDate: date("expiration_date").notNull(),
  eventTime: timestamp("event_time").notNull(),
  sourceGln: varchar("source_gln", { length: 50 }),
  destinationGln: varchar("destination_gln", { length: 50 }),
  bizTransactionList: jsonb("biz_transaction_list"), // Store PO references and other transaction identifiers
  poId: integer("po_id").references(() => purchaseOrders.id), // Link to PO if known
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProductItemSchema = createInsertSchema(productItems).omit({
  id: true,
  createdAt: true
});

// Scanned QR/DataMatrix codes
export const scannedItems = pgTable("scanned_items", {
  id: serial("id").primaryKey(),
  gtin: varchar("gtin", { length: 50 }).notNull(),
  serialNumber: varchar("serial_number", { length: 100 }).notNull(),
  lotNumber: varchar("lot_number", { length: 50 }).notNull(),
  expirationDate: date("expiration_date").notNull(),
  rawData: text("raw_data").notNull(), // Raw barcode data
  scannedBy: integer("scanned_by").notNull().references(() => users.id),
  scannedAt: timestamp("scanned_at").defaultNow().notNull(),
  scannedVia: varchar("scanned_via", { length: 30 }).notNull(), // mobile, dedicated_scanner, manual
  productItemId: integer("product_item_id").references(() => productItems.id), // Link to matched product item if found
  matchResult: varchar("match_result", { length: 20 }).notNull(), // matched, mismatch, not_found
  mismatchReason: text("mismatch_reason"), // Reason for mismatch if any
  poId: integer("po_id").references(() => purchaseOrders.id), // Link to PO if known
});

export const insertScannedItemSchema = createInsertSchema(scannedItems).omit({
  id: true,
  scannedAt: true
});

// Validation/scan session for batch validation
export const validationSessions = pgTable("validation_sessions", {
  id: serial("id").primaryKey(),
  poId: integer("po_id").references(() => purchaseOrders.id),
  fileId: integer("file_id").references(() => files.id),
  startedBy: integer("started_by").notNull().references(() => users.id),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  status: varchar("status", { length: 20 }).notNull().default("in_progress"), // in_progress, completed, aborted
  totalScanned: integer("total_scanned").default(0),
  totalMatched: integer("total_matched").default(0),
  totalMismatched: integer("total_mismatched").default(0),
  notes: text("notes"),
});

export const insertValidationSessionSchema = createInsertSchema(validationSessions).omit({
  id: true,
  startedAt: true,
  completedAt: true,
  totalScanned: true,
  totalMatched: true, 
  totalMismatched: true
});

// Audit trail
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entity_type", { length: 50 }).notNull(), // po, file, scan, product_item, etc.
  entityId: integer("entity_id").notNull(),
  userId: integer("user_id").notNull().references(() => users.id),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  details: jsonb("details"), // Additional details about the action
  ipAddress: varchar("ip_address", { length: 50 }),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  timestamp: true
});

// Export new types
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;

export type EpcisPoAssociation = typeof epcisPoAssociations.$inferSelect;
export type InsertEpcisPoAssociation = z.infer<typeof insertEpcisPoAssociationSchema>;

export type ProductItem = typeof productItems.$inferSelect;
export type InsertProductItem = z.infer<typeof insertProductItemSchema>;

export type ScannedItem = typeof scannedItems.$inferSelect;
export type InsertScannedItem = z.infer<typeof insertScannedItemSchema>;

export type ValidationSession = typeof validationSessions.$inferSelect;
export type InsertValidationSession = z.infer<typeof insertValidationSessionSchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

// Sales Orders Schema
export const salesOrders = pgTable("sales_orders", {
  id: serial("id").primaryKey(),
  soNumber: varchar("so_number", { length: 50 }).notNull().unique(),
  customerId: integer("customer_id").notNull().references(() => partners.id), // Link to customer partner
  customerGln: varchar("customer_gln", { length: 50 }),
  shipFromLocationId: integer("ship_from_location_id").references(() => partnerLocations.id), // Optional specific ship-from location
  shipToLocationId: integer("ship_to_location_id").references(() => partnerLocations.id), // Optional specific ship-to location
  orderDate: date("order_date").notNull(),
  requestedShipDate: date("requested_ship_date"),
  actualShipDate: date("actual_ship_date"),
  status: varchar("status", { length: 20 }).notNull().default("draft"), // draft, approved, picking, shipped, delivered, cancelled
  totalItems: integer("total_items").default(0),
  totalShipped: integer("total_shipped").default(0),
  outboundEpcisId: integer("outbound_epcis_id").references(() => files.id), // Link to generated EPCIS file
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").notNull().references(() => users.id),
  lastUpdatedAt: timestamp("last_updated_at"),
  lastUpdatedBy: integer("last_updated_by").references(() => users.id),
  notes: text("notes"),
  erpReference: varchar("erp_reference", { length: 100 }), // Reference number in external ERP system
});

export const insertSalesOrderSchema = createInsertSchema(salesOrders).omit({
  id: true,
  createdAt: true,
  lastUpdatedAt: true,
  lastUpdatedBy: true,
  totalItems: true,
  totalShipped: true,
  outboundEpcisId: true
});

// Sales Order Line Items
export const salesOrderItems = pgTable("sales_order_items", {
  id: serial("id").primaryKey(),
  soId: integer("so_id").notNull().references(() => salesOrders.id),
  lineNumber: integer("line_number").notNull(),
  gtin: varchar("gtin", { length: 50 }).notNull(),
  ndc: varchar("ndc", { length: 50 }),
  productName: varchar("product_name", { length: 200 }).notNull(),
  manufacturer: varchar("manufacturer", { length: 200 }),
  quantity: integer("quantity").notNull(),
  quantityShipped: integer("quantity_shipped").default(0),
  packageSize: varchar("package_size", { length: 50 }),
  packageType: varchar("package_type", { length: 50 }), // e.g., "case", "each", "box"
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, partial, shipped, backordered, cancelled
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
  notes: text("notes"),
  erpLineReference: varchar("erp_line_reference", { length: 100 }),
});

export const insertSalesOrderItemSchema = createInsertSchema(salesOrderItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  quantityShipped: true
});

// Serialized Inventory Schema
export const inventory = pgTable("inventory", {
  id: serial("id").primaryKey(),
  gtin: varchar("gtin", { length: 50 }).notNull(),
  serialNumber: varchar("serial_number", { length: 100 }).notNull(),
  lotNumber: varchar("lot_number", { length: 50 }).notNull(),
  expirationDate: date("expiration_date").notNull(),
  ndc: varchar("ndc", { length: 50 }),
  productName: varchar("product_name", { length: 200 }),
  manufacturer: varchar("manufacturer", { length: 200 }),
  status: varchar("status", { length: 20 }).notNull().default("available"), // available, allocated, shipped, damaged, expired, quarantined
  packageType: varchar("package_type", { length: 20 }).notNull().default("each"), // each, case
  receivedVia: varchar("received_via", { length: 20 }).notNull(), // epcis, manual, transfer
  receivedAt: timestamp("received_at").notNull(),
  sourceFileId: integer("source_file_id").references(() => files.id),
  sourcePoId: integer("source_po_id").references(() => purchaseOrders.id),
  shippedVia: varchar("shipped_via", { length: 20 }), // epcis, manual, transfer
  shippedAt: timestamp("shipped_at"),
  destinationSoId: integer("destination_so_id").references(() => salesOrders.id),
  warehouse: varchar("warehouse", { length: 100 }).notNull().default("default"),
  location: varchar("location", { length: 100 }), // Physical location in warehouse
  lastScannedAt: timestamp("last_scanned_at"),
  lastScannedBy: integer("last_scanned_by").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").notNull().references(() => users.id),
});

export const insertInventorySchema = createInsertSchema(inventory).omit({
  id: true,
  createdAt: true,
  lastScannedAt: true,
  lastScannedBy: true,
  shippedAt: true,
});

// Inventory Transaction History
export const inventoryTransactions = pgTable("inventory_transactions", {
  id: serial("id").primaryKey(),
  inventoryId: integer("inventory_id").notNull().references(() => inventory.id),
  transactionType: varchar("transaction_type", { length: 20 }).notNull(), // receive, ship, transfer, return, status_change
  fromStatus: varchar("from_status", { length: 20 }),
  toStatus: varchar("to_status", { length: 20 }),
  fromLocation: varchar("from_location", { length: 100 }),
  toLocation: varchar("to_location", { length: 100 }),
  transactionDate: timestamp("transaction_date").defaultNow().notNull(),
  reference: varchar("reference", { length: 100 }), // PO number, SO number, etc.
  referenceId: integer("reference_id"), // ID of related PO, SO, etc.
  referenceType: varchar("reference_type", { length: 20 }), // po, so, transfer, etc.
  performedBy: integer("performed_by").notNull().references(() => users.id),
  notes: text("notes"),
});

export const insertInventoryTransactionSchema = createInsertSchema(inventoryTransactions).omit({
  id: true,
  transactionDate: true
});

// Export Sales Order types
export type SalesOrder = typeof salesOrders.$inferSelect;
export type InsertSalesOrder = z.infer<typeof insertSalesOrderSchema>;

export type SalesOrderItem = typeof salesOrderItems.$inferSelect;
export type InsertSalesOrderItem = z.infer<typeof insertSalesOrderItemSchema>;

export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type InsertPurchaseOrderItem = z.infer<typeof insertPurchaseOrderItemSchema>;

// Export Inventory types
export type Inventory = typeof inventory.$inferSelect;
export type InsertInventory = z.infer<typeof insertInventorySchema>;

export type InventoryTransaction = typeof inventoryTransactions.$inferSelect;
export type InsertInventoryTransaction = z.infer<typeof insertInventoryTransactionSchema>;
