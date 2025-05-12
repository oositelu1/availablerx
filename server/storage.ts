import { users, partners, files, transmissions } from "@shared/schema";
import type { User, InsertUser, Partner, InsertPartner, File, InsertFile, Transmission, InsertTransmission } from "@shared/schema";
import session from "express-session";
import { db } from "./db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import crypto from "crypto";

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

  // Storage for file data (raw files)
  storeFileData(data: Buffer, fileId: number): Promise<string>;
  retrieveFileData(fileId: number): Promise<Buffer | undefined>;
  
  // Session store
  sessionStore: session.Store;
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private partners: Map<number, Partner>;
  private files: Map<number, File>;
  private transmissions: Map<number, Transmission>;
  private fileDataStorage: Map<number, Buffer>;
  sessionStore: session.Store;
  
  private userIdCounter: number;
  private partnerIdCounter: number;
  private fileIdCounter: number;
  private transmissionIdCounter: number;

  constructor() {
    this.users = new Map();
    this.partners = new Map();
    this.files = new Map();
    this.transmissions = new Map();
    this.fileDataStorage = new Map();
    
    this.userIdCounter = 1;
    this.partnerIdCounter = 1;
    this.fileIdCounter = 1;
    this.transmissionIdCounter = 1;
    
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
}

// We're now using the DatabaseStorage implementation
import { DatabaseStorage } from './database-storage';
export const storage = new DatabaseStorage();
