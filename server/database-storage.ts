import { users, partners, files, transmissions, presignedLinks } from "@shared/schema";
import type { 
  User, InsertUser, Partner, InsertPartner, File, InsertFile, 
  Transmission, InsertTransmission, PresignedLink, InsertPresignedLink 
} from "@shared/schema";
import session from "express-session";
import { db } from "./db";
import { eq, and, or, gte, lte, desc } from "drizzle-orm";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import crypto from "crypto";
import { v4 as uuidv4 } from 'uuid';
import { IStorage } from "./storage";

const PostgresSessionStore = connectPg(session);

// Database storage implementation
export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;
  private fileDataStorage: Map<number, Buffer>; // We'll keep this in-memory for now
  
  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
    
    this.fileDataStorage = new Map();
    
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
    return crypto.createHash('sha256').update(password).digest('hex');
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
    if (activeOnly) {
      return db.select().from(partners).where(eq(partners.isActive, true));
    }
    return db.select().from(partners);
  }
  
  async deletePartner(id: number): Promise<boolean> {
    // Soft delete - just mark as inactive
    const [partner] = await db.update(partners)
      .set({ isActive: false })
      .where(eq(partners.id, id))
      .returning();
    
    return !!partner;
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
    return this.fileDataStorage.get(fileId);
  }
}