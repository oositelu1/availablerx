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
import { eq, and, gte, lte, desc } from "drizzle-orm";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import crypto from "crypto";
import { v4 as uuidv4 } from 'uuid';
import createMemoryStore from "memorystore";

const PostgresSessionStore = connectPg(session);

// Storage interface
export interface IStorage {
  // User management
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  listUsers(): Promise<User[]>;
  
  // Partner management
  createPartner(partner: InsertPartner): Promise<Partner>;
  getPartner(id: number): Promise<Partner | undefined>;
  updatePartner(id: number, partner: Partial<Partner>): Promise<Partner | undefined>;
  listPartners(activeOnly?: boolean): Promise<Partner[]>;
  deletePartner(id: number): Promise<boolean>;
  getPartnerByGLN(gln: string): Promise<Partner | null>;
  getAllActiveAS2Receivers(): Promise<Partner[]>;
  
  // Inventory management
  getInventoryStats(): Promise<{
    total: number;
    available: number;
    allocated: number;
    shipped: number;
    expired: number;
    damaged: number;
  }>;
  getInventoryItems(): Promise<Inventory[]>;
  getInventoryItem(id: number): Promise<Inventory | undefined>;
  getInventoryItemBySerial(serialNumber: string): Promise<Inventory | undefined>;
  addInventoryItem(item: InsertInventory): Promise<Inventory>;
  updateInventoryItem(id: number, updates: Partial<Inventory>): Promise<Inventory | undefined>;
  deleteInventoryItem(id: number): Promise<boolean>;
  
  // Inventory transaction management
  getInventoryTransactions(): Promise<InventoryTransaction[]>;
  getInventoryTransaction(id: number): Promise<InventoryTransaction | undefined>;
  addInventoryTransaction(transaction: InsertInventoryTransaction): Promise<InventoryTransaction>;
  
  // Partner Location management
  createPartnerLocation(location: InsertPartnerLocation): Promise<PartnerLocation>;
  getPartnerLocation(id: number): Promise<PartnerLocation | undefined>;
  updatePartnerLocation(id: number, updates: Partial<PartnerLocation>): Promise<PartnerLocation | undefined>;
  listPartnerLocations(partnerId: number, locationType?: string): Promise<PartnerLocation[]>;
  deletePartnerLocation(id: number): Promise<boolean>;
  
  // File management
  createFile(file: InsertFile): Promise<File>;
  getFile(id: number): Promise<File | undefined>;
  updateFile(id: number, updates: Partial<File>): Promise<File | undefined>;
  listFiles(filters?: {
    status?: string;
    partnerId?: number;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ files: File[], total: number }>;

  // Transmission management
  createTransmission(transmission: InsertTransmission): Promise<Transmission>;
  getTransmission(id: number): Promise<Transmission | undefined>;
  updateTransmission(id: number, updates: Partial<Transmission>): Promise<Transmission | undefined>;
  listTransmissionsForFile(fileId: number): Promise<Transmission[]>;
  getFileTransmissionHistory(fileId: number): Promise<(Transmission & { partner: Partner })[]>;

  // Pre-signed URL management
  createPresignedLink(link: InsertPresignedLink): Promise<PresignedLink>;
  getPresignedLinkByUuid(uuid: string): Promise<PresignedLink | undefined>;
  updatePresignedLink(id: number, updates: Partial<PresignedLink>): Promise<PresignedLink | undefined>;
  listPresignedLinksForPartner(partnerId: number, includeExpired?: boolean): Promise<(PresignedLink & { file: File })[]>;
  listPresignedLinksForFile(fileId: number): Promise<(PresignedLink & { partner: Partner })[]>;
  generatePresignedUrl(fileId: number, expirationSeconds?: number): Promise<string>;

  // Invoice management
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  getInvoice(id: number): Promise<Invoice | undefined>;
  updateInvoice(id: number, updates: Partial<Invoice>): Promise<Invoice | undefined>;
  listInvoices(filters?: {
    status?: string;
    purchaseOrderId?: number;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ invoices: Invoice[], total: number }>;
  
  // Invoice Item management
  createInvoiceItem(item: InsertInvoiceItem): Promise<InvoiceItem>;
  getInvoiceItem(id: number): Promise<InvoiceItem | undefined>;
  updateInvoiceItem(id: number, updates: Partial<InvoiceItem>): Promise<InvoiceItem | undefined>;
  listInvoiceItems(invoiceId: number): Promise<InvoiceItem[]>;
  
  // EPCIS matching
  findMatchingEpcisFiles(criteria: {
    lotNumbers?: string[];
    ndcCodes?: string[];
    gtins?: string[];
    poId?: number;
  }): Promise<File[]>;
  
  // Purchase Order management
  createPurchaseOrder(order: InsertPurchaseOrder): Promise<PurchaseOrder>;
  getPurchaseOrder(id: number): Promise<PurchaseOrder | undefined>;
  getPurchaseOrderByPoNumber(poNumber: string): Promise<PurchaseOrder | undefined>;
  updatePurchaseOrder(id: number, updates: Partial<PurchaseOrder>): Promise<PurchaseOrder | undefined>;
  listPurchaseOrders(filters?: {
    status?: string;
    supplierGln?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ orders: PurchaseOrder[], total: number }>;
  
  // Purchase Order Items management
  createPurchaseOrderItem(item: InsertPurchaseOrderItem): Promise<PurchaseOrderItem>;
  getPurchaseOrderItem(id: number): Promise<PurchaseOrderItem | undefined>;
  updatePurchaseOrderItem(id: number, updates: Partial<PurchaseOrderItem>): Promise<PurchaseOrderItem | undefined>;
  listPurchaseOrderItems(poId: number): Promise<PurchaseOrderItem[]>;
  deletePurchaseOrderItem(id: number): Promise<boolean>;
  
  // EPCIS-PO Association management
  createEpcisPoAssociation(association: InsertEpcisPoAssociation): Promise<EpcisPoAssociation>;
  getEpcisPoAssociation(id: number): Promise<EpcisPoAssociation | undefined>;
  updateEpcisPoAssociation(id: number, updates: Partial<EpcisPoAssociation>): Promise<EpcisPoAssociation | undefined>;
  listEpcisPoAssociationsForFile(fileId: number): Promise<(EpcisPoAssociation & { po: PurchaseOrder })[]>;
  listEpcisPoAssociationsForPO(poId: number): Promise<(EpcisPoAssociation & { file: File })[]>;
  
  // Product Item management
  createProductItem(item: InsertProductItem): Promise<ProductItem>;
  getProductItem(id: number): Promise<ProductItem | undefined>;
  findProductItemBySGTIN(gtin: string, serialNumber: string): Promise<ProductItem | undefined>;
  findProductItemsByLot(gtin: string, lotNumber: string): Promise<ProductItem[]>;
  listProductItemsForFile(fileId: number): Promise<ProductItem[]>;
  listProductItemsForPO(poId: number): Promise<ProductItem[]>;
  
  // Scanned Item management
  createScannedItem(item: InsertScannedItem): Promise<ScannedItem>;
  getScannedItem(id: number): Promise<ScannedItem | undefined>;
  updateScannedItem(id: number, updates: Partial<ScannedItem>): Promise<ScannedItem | undefined>;
  listScannedItemsForSession(sessionId: number): Promise<ScannedItem[]>;
  
  // Validation Session management
  createValidationSession(session: InsertValidationSession): Promise<ValidationSession>;
  getValidationSession(id: number): Promise<ValidationSession | undefined>;
  updateValidationSession(id: number, updates: Partial<ValidationSession>): Promise<ValidationSession | undefined>;
  listValidationSessionsForPO(poId: number): Promise<ValidationSession[]>;
  
  // Sales Order management
  createSalesOrder(order: InsertSalesOrder): Promise<SalesOrder>;
  getSalesOrder(id: number): Promise<SalesOrder | undefined>;
  getSalesOrderBySoNumber(soNumber: string): Promise<SalesOrder | undefined>;
  updateSalesOrder(id: number, updates: Partial<SalesOrder>): Promise<SalesOrder | undefined>;
  listSalesOrders(filters?: {
    status?: string;
    customerId?: number;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ orders: SalesOrder[], total: number }>;
  
  // Sales Order Items management
  createSalesOrderItem(item: InsertSalesOrderItem): Promise<SalesOrderItem>;
  getSalesOrderItem(id: number): Promise<SalesOrderItem | undefined>;
  updateSalesOrderItem(id: number, updates: Partial<SalesOrderItem>): Promise<SalesOrderItem | undefined>;
  listSalesOrderItems(soId: number): Promise<SalesOrderItem[]>;
  deleteSalesOrderItem(id: number): Promise<boolean>;
  
  // Inventory management
  createInventoryItem(item: InsertInventory): Promise<Inventory>;
  getInventoryItem(id: number): Promise<Inventory | undefined>;
  getInventoryBySGTIN(gtin: string, serialNumber: string): Promise<Inventory | undefined>;
  updateInventoryItem(id: number, updates: Partial<Inventory>): Promise<Inventory | undefined>;
  createInventoryFromFile(fileId: number, userId: number): Promise<number>; // Returns count of items created
  listInventory(filters?: {
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
    limit?: number;
    offset?: number;
  }): Promise<{ items: Inventory[], total: number }>;
  
  // Inventory Transaction management
  createInventoryTransaction(transaction: InsertInventoryTransaction): Promise<InventoryTransaction>;
  getInventoryTransaction(id: number): Promise<InventoryTransaction | undefined>;
  listInventoryTransactions(inventoryId: number): Promise<InventoryTransaction[]>;
  
  // Audit Log management
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  listAuditLogs(entityType?: string, entityId?: number, limit?: number, offset?: number): Promise<{ logs: AuditLog[], total: number }>;
  
  // Storage for file data (raw files)
  storeFileData(data: Buffer, fileId: number): Promise<string>;
  retrieveFileData(fileId: number): Promise<Buffer | undefined>;
  generatePresignedUrl(fileId: number, expirationSeconds: number): Promise<string>;
  
  // Session store
  sessionStore: session.Store;
  
  // Files API
  getFilesCount(): Promise<number>;
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private partners: Map<number, Partner>;
  private partnerLocations: Map<number, PartnerLocation>;
  private files: Map<number, File>;
  private transmissions: Map<number, Transmission>;
  private presignedLinks: Map<number, PresignedLink>;
  private fileDataStorage: Map<number, Buffer>;
  private purchaseOrders: Map<number, PurchaseOrder>;
  private purchaseOrderItems: Map<number, PurchaseOrderItem>;
  private salesOrders: Map<number, SalesOrder>;
  private salesOrderItems: Map<number, SalesOrderItem>;
  private inventoryItems: Map<number, Inventory>;
  private inventoryTransactions: Map<number, InventoryTransaction>;
  sessionStore: session.Store;
  private baseDownloadUrl: string;
  
  private userIdCounter: number;
  private partnerIdCounter: number;
  private partnerLocationIdCounter: number;
  private fileIdCounter: number;
  private transmissionIdCounter: number;
  private presignedLinkIdCounter: number;
  private purchaseOrderIdCounter: number;
  private purchaseOrderItemIdCounter: number;
  private salesOrderIdCounter: number;
  private salesOrderItemIdCounter: number;
  private inventoryItemIdCounter: number;
  private inventoryTransactionIdCounter: number;

  constructor() {
    this.users = new Map();
    this.partners = new Map();
    this.partnerLocations = new Map();
    this.files = new Map();
    this.transmissions = new Map();
    this.presignedLinks = new Map();
    this.fileDataStorage = new Map();
    this.purchaseOrders = new Map();
    this.purchaseOrderItems = new Map();
    this.salesOrders = new Map();
    this.salesOrderItems = new Map();
    this.inventoryItems = new Map();
    this.inventoryTransactions = new Map();
    
    // Set the base URL for downloads
    this.baseDownloadUrl = process.env.BASE_DOWNLOAD_URL || 'http://localhost:5000';
    
    this.userIdCounter = 1;
    this.partnerIdCounter = 1;
    this.partnerLocationIdCounter = 1;
    this.purchaseOrderIdCounter = 1;
    this.purchaseOrderItemIdCounter = 1;
    this.fileIdCounter = 1;
    this.transmissionIdCounter = 1;
    this.presignedLinkIdCounter = 1;
    this.salesOrderIdCounter = 1;
    this.salesOrderItemIdCounter = 1;
    this.inventoryItemIdCounter = 1;
    this.inventoryTransactionIdCounter = 1;
    
    const MemoryStore = createMemoryStore(session);
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // Prune expired entries every 24h
    });

    // Create default admin user
    this.createUser({
      username: "admin",
      password: this.hashPassword("admin123"),
      fullName: "Administrator",
      role: "administrator"
    });
    
    // Create default operator user
    this.createUser({
      username: "operator",
      password: this.hashPassword("operator123"),
      fullName: "Operator User",
      role: "operator"
    });
  }

  private hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }
  
  // User management
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username.toLowerCase() === username.toLowerCase()
    );
  }

  async createUser(data: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = {
      ...data,
      id,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }
  
  async listUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }
  
  // Partner management
  async createPartner(data: InsertPartner): Promise<Partner> {
    const id = this.partnerIdCounter++;
    const partner: Partner = {
      ...data,
      id,
      createdAt: new Date(),
      isActive: true
    };
    this.partners.set(id, partner);
    return partner;
  }
  
  async getPartner(id: number): Promise<Partner | undefined> {
    return this.partners.get(id);
  }
  
  async updatePartner(id: number, updates: Partial<Partner>): Promise<Partner | undefined> {
    const partner = this.partners.get(id);
    if (!partner) return undefined;
    
    const updatedPartner = {
      ...partner,
      ...updates
    };
    this.partners.set(id, updatedPartner);
    return updatedPartner;
  }
  
  async listPartners(activeOnly: boolean = false): Promise<Partner[]> {
    const allPartners = Array.from(this.partners.values());
    if (activeOnly) {
      return allPartners.filter(partner => partner.isActive);
    }
    return allPartners;
  }
  
  async deletePartner(id: number): Promise<boolean> {
    return this.partners.delete(id);
  }
  
  // Partner Location methods
  async createPartnerLocation(location: InsertPartnerLocation): Promise<PartnerLocation> {
    const id = this.partnerLocationIdCounter++;
    
    // If this is set as default, clear default flag from other locations of same type
    if (location.isDefault) {
      for (const [existingId, existingLocation] of this.partnerLocations.entries()) {
        if (existingLocation.partnerId === location.partnerId &&
            existingLocation.locationType === location.locationType &&
            existingLocation.isDefault) {
          existingLocation.isDefault = false;
          this.partnerLocations.set(existingId, existingLocation);
        }
      }
    }
    
    const newLocation: PartnerLocation = {
      id,
      createdAt: new Date(),
      partnerId: location.partnerId,
      name: location.name,
      locationType: location.locationType,
      streetAddress: location.streetAddress,
      city: location.city,
      state: location.state,
      postalCode: location.postalCode,
      country: location.country || 'US',
      gln: location.gln || null,
      isActive: location.isActive ?? true,
      isDefault: location.isDefault ?? false,
      contactName: location.contactName || null,
      contactEmail: location.contactEmail || null,
      contactPhone: location.contactPhone || null,
      notes: location.notes || null,
      createdBy: location.createdBy
    };
    
    this.partnerLocations.set(id, newLocation);
    return newLocation;
  }
  
  async getPartnerLocation(id: number): Promise<PartnerLocation | undefined> {
    return this.partnerLocations.get(id);
  }
  
  async updatePartnerLocation(id: number, updates: Partial<PartnerLocation>): Promise<PartnerLocation | undefined> {
    const location = this.partnerLocations.get(id);
    if (!location) {
      return undefined;
    }
    
    // Handle default location logic if isDefault is being updated to true
    if (updates.isDefault === true && !location.isDefault) {
      for (const [existingId, existingLocation] of this.partnerLocations.entries()) {
        if (existingId !== id &&
            existingLocation.partnerId === location.partnerId &&
            existingLocation.locationType === location.locationType &&
            existingLocation.isDefault) {
          existingLocation.isDefault = false;
          this.partnerLocations.set(existingId, existingLocation);
        }
      }
    }
    
    const updatedLocation = { ...location, ...updates };
    this.partnerLocations.set(id, updatedLocation);
    
    return updatedLocation;
  }
  
  async listPartnerLocations(partnerId: number, locationType?: string): Promise<PartnerLocation[]> {
    const locations: PartnerLocation[] = [];
    
    for (const location of this.partnerLocations.values()) {
      if (location.partnerId === partnerId) {
        if (!locationType || location.locationType === locationType) {
          locations.push(location);
        }
      }
    }
    
    // Order by isDefault (true first) and then by name
    return locations.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return a.name.localeCompare(b.name);
    });
  }
  
  async deletePartnerLocation(id: number): Promise<boolean> {
    return this.partnerLocations.delete(id);
  }
  
  // File management
  async createFile(data: InsertFile): Promise<File> {
    const id = this.fileIdCounter++;
    const file: File = {
      ...data,
      id,
      uploadedAt: new Date()
    };
    this.files.set(id, file);
    return file;
  }
  
  async getFile(id: number): Promise<File | undefined> {
    return this.files.get(id);
  }
  
  async updateFile(id: number, updates: Partial<File>): Promise<File | undefined> {
    const file = this.files.get(id);
    if (!file) return undefined;
    
    const updatedFile = {
      ...file,
      ...updates
    };
    this.files.set(id, updatedFile);
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
    let allFiles = Array.from(this.files.values());
    
    // Apply filters
    if (filters) {
      if (filters.status) {
        allFiles = allFiles.filter(file => file.status === filters.status);
      }
      
      if (filters.partnerId) {
        // Find transmissions for this partner
        const fileIdsForPartner = Array.from(this.transmissions.values())
          .filter(t => t.partnerId === filters.partnerId)
          .map(t => t.fileId);
        
        // Unique file IDs
        const uniqueFileIds = [...new Set(fileIdsForPartner)];
        allFiles = allFiles.filter(file => uniqueFileIds.includes(file.id));
      }
      
      if (filters.startDate) {
        allFiles = allFiles.filter(file => file.uploadedAt >= filters.startDate!);
      }
      
      if (filters.endDate) {
        allFiles = allFiles.filter(file => file.uploadedAt <= filters.endDate!);
      }
    }
    
    // Sort by uploadedAt desc
    allFiles.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
    
    const total = allFiles.length;
    
    // Apply pagination
    if (filters?.limit && filters?.offset !== undefined) {
      allFiles = allFiles.slice(filters.offset, filters.offset + filters.limit);
    }
    
    return { files: allFiles, total };
  }
  
  // Transmission management
  async createTransmission(data: InsertTransmission): Promise<Transmission> {
    const id = this.transmissionIdCounter++;
    const transmission: Transmission = {
      ...data,
      id,
      sentAt: new Date(),
      retryCount: 0
    };
    this.transmissions.set(id, transmission);
    return transmission;
  }
  
  async getTransmission(id: number): Promise<Transmission | undefined> {
    return this.transmissions.get(id);
  }
  
  async updateTransmission(id: number, updates: Partial<Transmission>): Promise<Transmission | undefined> {
    const transmission = this.transmissions.get(id);
    if (!transmission) return undefined;
    
    const updatedTransmission = {
      ...transmission,
      ...updates
    };
    this.transmissions.set(id, updatedTransmission);
    return updatedTransmission;
  }
  
  async listTransmissionsForFile(fileId: number): Promise<Transmission[]> {
    return Array.from(this.transmissions.values())
      .filter(transmission => transmission.fileId === fileId)
      .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
  }
  
  async getFileTransmissionHistory(fileId: number): Promise<(Transmission & { partner: Partner })[]> {
    const transmissions = await this.listTransmissionsForFile(fileId);
    return transmissions.map(transmission => {
      const partner = this.partners.get(transmission.partnerId);
      return {
        ...transmission,
        partner: partner!
      };
    });
  }
  
  // Storage for file data
  async storeFileData(data: Buffer, fileId: number): Promise<string> {
    this.fileDataStorage.set(fileId, data);
    return `file:${fileId}`;
  }
  
  async retrieveFileData(fileId: number): Promise<Buffer | undefined> {
    return this.fileDataStorage.get(fileId);
  }
  
  // Get all product items for a file
  async getProductItemsByFileId(fileId: number): Promise<ProductItem[]> {
    // Mock product items for development
    // When actually connected to database, this would query the product_items table
    // For now, generate mock items based on file ID to simulate different products
    const mockItems: ProductItem[] = [];
    
    // Generate different serial numbers based on the file ID
    const fileIdOffset = (fileId - 1) * 100;
    const baseSerialNum = 10000000000000 + fileIdOffset;
    
    // Add mock items for file ID 45
    if (fileId === 45) {
      // This matches the console log data we saw
      for (let i = 0; i < 10; i++) {
        mockItems.push({
          id: 1288 + i,
          fileId: 45,
          gtin: '00301430957010',
          serialNumber: (10016550749981 + i).toString(),
          lotNumber: '24052241',
          expirationDate: '2026-09-30',
          eventTime: new Date('2024-11-11T12:20:34.827Z'),
          sourceGln: 'urn:epc:id:sgln:56009069.0001.0',
          destinationGln: null,
          bizTransactionList: ['41067'],
          poId: null,
          createdAt: new Date('2025-05-16T17:36:51.435Z')
        });
      }
    } 
    // Add mock items for file ID 47
    else if (fileId === 47) {
      for (let i = 0; i < 5; i++) {
        mockItems.push({
          id: baseSerialNum + i,
          fileId: 47,
          gtin: '10373123456789',
          serialNumber: 'SN' + (902497 + i).toString(),
          lotNumber: 'LOT5890',
          expirationDate: '2026-12-31',
          eventTime: new Date(),
          sourceGln: 'urn:epc:id:sgln:0373123.00000.0',
          destinationGln: null,
          bizTransactionList: ['PO-2025-001'],
          poId: null,
          createdAt: new Date()
        });
      }
    }
    // Generic mock items for any other file
    else {
      for (let i = 0; i < 5; i++) {
        mockItems.push({
          id: baseSerialNum + i,
          fileId: fileId,
          gtin: '00301430957010',
          serialNumber: (baseSerialNum + i).toString(),
          lotNumber: 'LOT' + (1000 + i).toString(),
          expirationDate: '2026-12-31',
          eventTime: new Date(),
          sourceGln: 'urn:epc:id:sgln:0373123.00000.0',
          destinationGln: null,
          bizTransactionList: [],
          poId: null,
          createdAt: new Date()
        });
      }
    }
    
    return mockItems;
  }
  
  // Pre-signed URL management implementations
  
  async createPresignedLink(link: InsertPresignedLink): Promise<PresignedLink> {
    // This is a simplified in-memory implementation
    const id = ++this.presignedLinkIdCounter;
    const createdAt = new Date();
    
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
    
    const newLink: PresignedLink = {
      id,
      createdAt,
      ...link,
    };
    
    this.presignedLinks.set(id, newLink);
    return newLink;
  }
  
  async getPresignedLinkByUuid(uuid: string): Promise<PresignedLink | undefined> {
    for (const link of this.presignedLinks.values()) {
      if (link.uuid === uuid) {
        return link;
      }
    }
    return undefined;
  }
  
  async updatePresignedLink(id: number, updates: Partial<PresignedLink>): Promise<PresignedLink | undefined> {
    const link = this.presignedLinks.get(id);
    if (!link) return undefined;
    
    const updatedLink = { ...link, ...updates };
    this.presignedLinks.set(id, updatedLink);
    return updatedLink;
  }
  
  async listPresignedLinksForPartner(partnerId: number, includeExpired: boolean = false): Promise<(PresignedLink & { file: File })[]> {
    const now = new Date();
    const links: (PresignedLink & { file: File })[] = [];
    
    for (const link of this.presignedLinks.values()) {
      if (link.partnerId === partnerId) {
        // Skip expired links unless explicitly asked to include them
        if (!includeExpired && link.expiresAt < now) {
          continue;
        }
        
        const file = this.files.get(link.fileId);
        if (file) {
          links.push({ ...link, file });
        }
      }
    }
    
    // Sort by createdAt in descending order
    return links.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  async listPresignedLinksForFile(fileId: number): Promise<(PresignedLink & { partner: Partner })[]> {
    const links: (PresignedLink & { partner: Partner })[] = [];
    
    for (const link of this.presignedLinks.values()) {
      if (link.fileId === fileId) {
        const partner = this.partners.get(link.partnerId);
        if (partner) {
          links.push({ ...link, partner });
        }
      }
    }
    
    // Sort by createdAt in descending order
    return links.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  async generatePresignedUrl(fileId: number, expirationSeconds: number = 172800): Promise<string> {
    const uuid = uuidv4();
    
    // Generate a download URL with the correct domain based on environment
    let protocol = 'https';
    let host = 'localhost:3000';
    
    console.log("Generating download URL with environment variables:");
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
    } else {
      // Local development fallback
      protocol = 'http';
      console.log(`Using local development URL: ${protocol}://${host}`);
    }
    
    const url = `${protocol}://${host}/api/download/${uuid}`;
    console.log(`Generated pre-signed URL: ${url}`);
    return url;
  }
  
  // Purchase Order Item methods
  async createPurchaseOrderItem(item: InsertPurchaseOrderItem): Promise<PurchaseOrderItem> {
    const id = this.purchaseOrderItemIdCounter++;
    
    const newItem: PurchaseOrderItem = {
      id,
      poId: item.poId,
      lineNumber: item.lineNumber,
      gtin: item.gtin,
      ndc: item.ndc || null,
      productName: item.productName,
      packageType: item.packageType || 'Unit',
      lotNumber: item.lotNumber || null,
      quantity: item.quantity,
      expirationDate: item.expirationDate || null,
      unitPrice: item.unitPrice || null,
      extendedPrice: item.extendedPrice || null,
      receivedQuantity: item.receivedQuantity || 0,
      receivingStatus: item.receivingStatus || 'pending',
      requiresScan: item.requiresScan ?? true,
      notes: item.notes || null,
      createdAt: new Date()
    };
    
    this.purchaseOrderItems.set(id, newItem);
    return newItem;
  }
  
  async getPurchaseOrderItem(id: number): Promise<PurchaseOrderItem | undefined> {
    return this.purchaseOrderItems.get(id);
  }
  
  async updatePurchaseOrderItem(id: number, updates: Partial<PurchaseOrderItem>): Promise<PurchaseOrderItem | undefined> {
    const item = this.purchaseOrderItems.get(id);
    if (!item) {
      return undefined;
    }
    
    const updatedItem = { ...item, ...updates };
    this.purchaseOrderItems.set(id, updatedItem);
    
    return updatedItem;
  }
  
  async listPurchaseOrderItems(poId: number): Promise<PurchaseOrderItem[]> {
    const items: PurchaseOrderItem[] = [];
    
    for (const item of this.purchaseOrderItems.values()) {
      if (item.poId === poId) {
        items.push(item);
      }
    }
    
    // Order by line number
    return items.sort((a, b) => a.lineNumber - b.lineNumber);
  }
  
  async deletePurchaseOrderItem(id: number): Promise<boolean> {
    return this.purchaseOrderItems.delete(id);
  }

  // Sales Order Management
  async createSalesOrder(order: InsertSalesOrder): Promise<SalesOrder> {
    const id = this.salesOrderIdCounter++;
    
    const newOrder: SalesOrder = {
      id,
      customerId: order.customerId,
      soNumber: order.soNumber,
      orderDate: order.orderDate || new Date(),
      requestedDeliveryDate: order.requestedDeliveryDate || null,
      status: order.status || "pending",
      totalAmount: order.totalAmount || 0,
      shippingAddress: order.shippingAddress || null,
      billingAddress: order.billingAddress || null,
      customerPurchaseOrderNum: order.customerPurchaseOrderNum || null,
      notes: order.notes || null,
      createdAt: new Date(),
      createdBy: order.createdBy,
      customerGln: order.customerGln || null,
      locationId: order.locationId || null,
      paymentTerms: order.paymentTerms || null,
      shippingMethod: order.shippingMethod || null,
      erpReference: order.erpReference || null
    };
    
    this.salesOrders.set(id, newOrder);
    return newOrder;
  }
  
  async getSalesOrder(id: number): Promise<SalesOrder | undefined> {
    return this.salesOrders.get(id);
  }
  
  async getSalesOrderBySoNumber(soNumber: string): Promise<SalesOrder | undefined> {
    for (const order of this.salesOrders.values()) {
      if (order.soNumber === soNumber) {
        return order;
      }
    }
    return undefined;
  }
  
  async updateSalesOrder(id: number, updates: Partial<SalesOrder>): Promise<SalesOrder | undefined> {
    const order = this.salesOrders.get(id);
    if (!order) {
      return undefined;
    }
    
    const updatedOrder = { ...order, ...updates };
    this.salesOrders.set(id, updatedOrder);
    
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
    let orders = Array.from(this.salesOrders.values());
    
    // Apply filters
    if (filters?.status) {
      orders = orders.filter(order => order.status === filters.status);
    }
    
    if (filters?.customerId) {
      orders = orders.filter(order => order.customerId === filters.customerId);
    }
    
    if (filters?.startDate) {
      orders = orders.filter(order => order.orderDate >= filters.startDate);
    }
    
    if (filters?.endDate) {
      orders = orders.filter(order => order.orderDate <= filters.endDate);
    }
    
    // Sort by orderDate (newest first)
    orders.sort((a, b) => b.orderDate.getTime() - a.orderDate.getTime());
    
    const total = orders.length;
    
    // Apply pagination
    if (filters?.offset !== undefined && filters?.limit !== undefined) {
      orders = orders.slice(filters.offset, filters.offset + filters.limit);
    } else if (filters?.limit !== undefined) {
      orders = orders.slice(0, filters.limit);
    }
    
    return { orders, total };
  }
  
  // Sales Order Items Management
  async createSalesOrderItem(item: InsertSalesOrderItem): Promise<SalesOrderItem> {
    const id = this.salesOrderItemIdCounter++;
    
    const newItem: SalesOrderItem = {
      id,
      salesOrderId: item.salesOrderId,
      lineNumber: item.lineNumber,
      gtin: item.gtin,
      productName: item.productName,
      quantity: item.quantity,
      quantityUnit: item.quantityUnit || "EA",
      quantityShipped: item.quantityShipped || 0,
      ndc: item.ndc || null,
      manufacturer: item.manufacturer || null,
      price: item.price || null,
      packageSize: item.packageSize || null,
      packageType: item.packageType || null,
      packageLevelId: item.packageLevelId || "0",
      serialNumbersAllocated: item.serialNumbersAllocated || 0,
      serialNumbersShipped: item.serialNumbersShipped || 0,
      status: item.status || "pending",
      lotNumber: item.lotNumber || null,
      expirationDate: item.expirationDate || null,
      discount: item.discount || null,
      taxRate: item.taxRate || null,
      notes: item.notes || null,
      createdAt: new Date()
    };
    
    this.salesOrderItems.set(id, newItem);
    return newItem;
  }
  
  async getSalesOrderItem(id: number): Promise<SalesOrderItem | undefined> {
    return this.salesOrderItems.get(id);
  }
  
  async updateSalesOrderItem(id: number, updates: Partial<SalesOrderItem>): Promise<SalesOrderItem | undefined> {
    const item = this.salesOrderItems.get(id);
    if (!item) {
      return undefined;
    }
    
    const updatedItem = { ...item, ...updates };
    this.salesOrderItems.set(id, updatedItem);
    
    return updatedItem;
  }
  
  async listSalesOrderItems(soId: number): Promise<SalesOrderItem[]> {
    const items: SalesOrderItem[] = [];
    
    for (const item of this.salesOrderItems.values()) {
      if (item.salesOrderId === soId) {
        items.push(item);
      }
    }
    
    // Order by line number
    return items.sort((a, b) => a.lineNumber - b.lineNumber);
  }
  
  async deleteSalesOrderItem(id: number): Promise<boolean> {
    return this.salesOrderItems.delete(id);
  }
  
  // Inventory Management
  async createInventoryItem(item: InsertInventory): Promise<Inventory> {
    const id = this.inventoryItemIdCounter++;
    
    const newItem: Inventory = {
      id,
      gtin: item.gtin,
      serialNumber: item.serialNumber,
      lotNumber: item.lotNumber || null,
      expirationDate: item.expirationDate || null,
      status: item.status || "available",
      locationId: item.locationId || null,
      receivedDate: item.receivedDate || new Date(),
      poItemId: item.poItemId || null,
      soItemId: item.soItemId || null,
      productItemId: item.productItemId || null,
      quantity: item.quantity || 1,
      createdAt: new Date(),
      createdBy: item.createdBy,
      notes: item.notes || null,
      lastMovementDate: item.lastMovementDate || new Date()
    };
    
    this.inventoryItems.set(id, newItem);
    return newItem;
  }
  
  async getInventoryItem(id: number): Promise<Inventory | undefined> {
    return this.inventoryItems.get(id);
  }
  
  async getInventoryBySGTIN(gtin: string, serialNumber: string): Promise<Inventory | undefined> {
    for (const item of this.inventoryItems.values()) {
      if (item.gtin === gtin && item.serialNumber === serialNumber) {
        return item;
      }
    }
    return undefined;
  }
  
  async updateInventoryItem(id: number, updates: Partial<Inventory>): Promise<Inventory | undefined> {
    const item = this.inventoryItems.get(id);
    if (!item) {
      return undefined;
    }
    
    // If updating status, set lastMovementDate to current date
    if (updates.status) {
      updates.lastMovementDate = new Date();
    }
    
    const updatedItem = { ...item, ...updates };
    this.inventoryItems.set(id, updatedItem);
    
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
    limit?: number;
    offset?: number;
  }): Promise<{ items: Inventory[], total: number }> {
    let items = Array.from(this.inventoryItems.values());
    
    // Apply filters
    if (filters?.status) {
      items = items.filter(item => item.status === filters.status);
    }
    
    if (filters?.gtin) {
      items = items.filter(item => item.gtin === filters.gtin);
    }
    
    if (filters?.lotNumber) {
      items = items.filter(item => item.lotNumber === filters.lotNumber);
    }
    
    if (filters?.expirationStart) {
      items = items.filter(item => item.expirationDate && item.expirationDate >= filters.expirationStart);
    }
    
    if (filters?.expirationEnd) {
      items = items.filter(item => item.expirationDate && item.expirationDate <= filters.expirationEnd);
    }
    
    if (filters?.poId) {
      // Find all PO items associated with this PO
      const poItems = Array.from(this.purchaseOrderItems.values())
        .filter(poItem => poItem.poId === filters.poId)
        .map(poItem => poItem.id);
      
      items = items.filter(item => item.poItemId !== null && poItems.includes(item.poItemId));
    }
    
    if (filters?.soId) {
      // Find all SO items associated with this SO
      const soItems = Array.from(this.salesOrderItems.values())
        .filter(soItem => soItem.salesOrderId === filters.soId)
        .map(soItem => soItem.id);
      
      items = items.filter(item => item.soItemId !== null && soItems.includes(item.soItemId));
    }
    
    // Sort by receivedDate (newest first)
    items.sort((a, b) => b.receivedDate.getTime() - a.receivedDate.getTime());
    
    const total = items.length;
    
    // Apply pagination
    if (filters?.offset !== undefined && filters?.limit !== undefined) {
      items = items.slice(filters.offset, filters.offset + filters.limit);
    } else if (filters?.limit !== undefined) {
      items = items.slice(0, filters.limit);
    }
    
    return { items, total };
  }
  
  // Inventory Transaction Management
  async createInventoryTransaction(transaction: InsertInventoryTransaction): Promise<InventoryTransaction> {
    const id = this.inventoryTransactionIdCounter++;
    
    const newTransaction: InventoryTransaction = {
      id,
      inventoryId: transaction.inventoryId,
      transactionType: transaction.transactionType,
      quantity: transaction.quantity,
      fromStatus: transaction.fromStatus,
      toStatus: transaction.toStatus,
      fromLocationId: transaction.fromLocationId,
      toLocationId: transaction.toLocationId,
      createdBy: transaction.createdBy,
      timestamp: new Date(),
      referenceId: transaction.referenceId || null,
      referenceType: transaction.referenceType || null,
      notes: transaction.notes || null
    };
    
    this.inventoryTransactions.set(id, newTransaction);
    return newTransaction;
  }
  
  async getInventoryTransaction(id: number): Promise<InventoryTransaction | undefined> {
    return this.inventoryTransactions.get(id);
  }
  
  async listInventoryTransactions(inventoryId: number): Promise<InventoryTransaction[]> {
    const transactions: InventoryTransaction[] = [];
    
    for (const transaction of this.inventoryTransactions.values()) {
      if (transaction.inventoryId === inventoryId) {
        transactions.push(transaction);
      }
    }
    
    // Order by timestamp (newest first)
    return transactions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}

// We're now using the DatabaseStorage implementation
import { DatabaseStorage } from './database-storage';
export const storage = new DatabaseStorage();
