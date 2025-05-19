import AWS from 'aws-sdk';
import { storage } from './storage';
import { processFile } from './file-processor';
import { sendFileShareNotification } from './email-service';
import { Partner } from '@shared/schema';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';

/**
 * Service to monitor an S3 bucket for new files from AS2 transfers
 * and process them automatically
 */
export class S3MonitorService {
  private static instance: S3MonitorService;
  private s3: AWS.S3;
  private interval: NodeJS.Timeout | null = null;
  private _isRunning: boolean = false;
  private processedFiles: Set<string> = new Set();
  private readonly tempDir: string;
  private lastCheckTime: Date = new Date();
  
  private constructor() {
    // Initialize AWS S3 client if credentials are available
    if (process.env.AWS_REGION) {
      AWS.config.update({ region: process.env.AWS_REGION });
      this.s3 = new AWS.S3();
    } else {
      // Create a dummy S3 client that will be configured later
      this.s3 = new AWS.S3();
    }
    
    // Create temp directory for file processing
    this.tempDir = path.join(os.tmpdir(), 'epcis-as2-processing');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
    
    console.log('S3 Monitor Service initialized');
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): S3MonitorService {
    if (!S3MonitorService.instance) {
      S3MonitorService.instance = new S3MonitorService();
    }
    return S3MonitorService.instance;
  }
  
  /**
   * Start monitoring the S3 bucket
   * @param intervalMinutes How often to check for new files (in minutes)
   */
  public start(intervalMinutes: number = 5): void {
    if (this._isRunning) {
      console.log('S3 Monitor Service is already running');
      return;
    }
    
    console.log(`Starting S3 Monitor Service with ${intervalMinutes} minute interval`);
    this._isRunning = true;
    
    // Check immediately on start
    this.checkForNewFiles();
    
    // Set up interval for regular checks
    this.interval = setInterval(() => {
      this.checkForNewFiles();
    }, intervalMinutes * 60 * 1000);
  }
  
  /**
   * Stop monitoring the S3 bucket
   */
  public stop(): void {
    if (!this._isRunning || !this.interval) {
      console.log('S3 Monitor Service is not running');
      return;
    }
    
    clearInterval(this.interval);
    this.interval = null;
    this._isRunning = false;
    console.log('S3 Monitor Service stopped');
  }
  
  /**
   * Check if the monitoring service is running
   */
  public isRunning(): boolean {
    return this._isRunning;
  }
  
  /**
   * Get the time of the last S3 bucket check
   */
  public getLastCheckTime(): Date {
    return this.lastCheckTime;
  }
  
  /**
   * Get the count of processed files
   */
  public getProcessedFileCount(): number {
    return this.processedFiles.size;
  }
  
  /**
   * Trigger an immediate check for new files
   */
  public async checkNow(): Promise<void> {
    console.log('Manual check for new AS2 files triggered');
    this.lastCheckTime = new Date();
    await this.checkForNewFiles();
  }
  
  /**
   * Check for new files in the S3 bucket
   */
  private async checkForNewFiles(): Promise<void> {
    try {
      console.log('Checking for new AS2 files in S3 bucket');
      
      // Make sure the bucket name is available
      const bucketName = process.env.AWS_S3_BUCKET || '';
      if (!bucketName) {
        console.error('AWS_S3_BUCKET environment variable not set');
        return;
      }
      
      const params = {
        Bucket: bucketName,
        Prefix: 'as2-incoming/', // The folder configured in the AS2 agreement
      };
      
      const data = await this.s3.listObjectsV2(params).promise();
      
      if (!data.Contents || data.Contents.length === 0) {
        console.log('No files found in the AS2 incoming folder');
        return;
      }
      
      console.log(`Found ${data.Contents.length} files in the AS2 incoming folder`);
      
      // Process each file that we haven't seen before
      for (const object of data.Contents) {
        if (!object.Key) continue;
        
        // Skip if we've already processed this file
        if (this.processedFiles.has(object.Key)) {
          continue;
        }
        
        // Make sure we have a valid key string
        if (typeof object.Key === 'string') {
          await this.processS3File(object.Key);
        }
        
        // Add to processed files set
        if (object.Key) {
          this.processedFiles.add(object.Key);
        }
        
        // Keep the set size manageable
        if (this.processedFiles.size > 1000) {
          // Remove the oldest 200 items when we hit 1000
          const iterator = this.processedFiles.values();
          for (let i = 0; i < 200; i++) {
            const nextValue = iterator.next().value;
            if (nextValue) {
              this.processedFiles.delete(nextValue);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking for new files in S3:', error);
    }
  }
  
  /**
   * Process a single file from S3
   * @param s3Key The S3 object key of the file to process
   */
  private async processS3File(s3Key: string): Promise<void> {
    console.log(`Processing S3 file: ${s3Key}`);
    try {
      // Ensure we have a bucket name
      const bucketName = process.env.AWS_S3_BUCKET;
      if (!bucketName) {
        throw new Error('AWS_S3_BUCKET environment variable not set');
      }
      
      // Download the file
      const s3Object = await this.s3.getObject({
        Bucket: bucketName,
        Key: s3Key
      }).promise();
      
      if (!s3Object.Body) {
        throw new Error('File content is empty');
      }
      
      // Save to temp file
      const fileName = path.basename(s3Key);
      const tempFilePath = path.join(this.tempDir, fileName);
      fs.writeFileSync(tempFilePath, s3Object.Body as Buffer);
      
      // Try to determine the partner from the file content
      const partnerId = await this.determinePartnerFromFile(tempFilePath);
      
      // Store file in database
      const fileId = await this.saveFileToDatabase(tempFilePath, fileName, s3Key, partnerId);
      
      // Generate pre-signed URL for partner access
      if (partnerId) {
        await this.generateAndSendPresignedUrl(fileId, partnerId);
      }
      
      // Clean up temp file
      fs.unlinkSync(tempFilePath);
      
      console.log(`Successfully processed S3 file: ${s3Key}`);
    } catch (error) {
      console.error(`Error processing S3 file ${s3Key}:`, error);
    }
  }
  
  /**
   * Save the file to the database
   */
  private async saveFileToDatabase(
    filePath: string, 
    originalName: string, 
    s3Key: string,
    partnerId: number | null
  ): Promise<number> {
    try {
      // Read file content
      const fileContent = fs.readFileSync(filePath);
      
      // Calculate SHA-256 of file
      const sha256 = require('crypto').createHash('sha256').update(fileContent).digest('hex');
      
      // Insert file record - note we're using fields that match InsertFile schema
      const file = await storage.createFile({
        originalName,
        storagePath: s3Key,
        fileType: 'XML',
        fileSize: fileContent.length,
        sha256,
        status: 'validated', // We assume it's valid as it came through AS2
        uploadedBy: 1, // System user ID
        // Store metadata about AS2 source in metadata field
        metadata: {
          source: 'as2',
          sourceId: s3Key,
          partnerId: partnerId || null
        }
      });
      
      // Process the EPCIS file
      const fileResult = await processFile(fileContent, originalName, 'application/xml', 1);
      
      if (!fileResult.success) {
        // Update file status in database if processing failed
        // This would normally be done through updateFile, but we're keeping the original ID
        console.error('File processing failed:', fileResult.errorMessage);
      }
      
      // Store the actual file data
      await storage.storeFileData(fileContent, file.id);
      
      return file.id;
    } catch (error) {
      console.error('Error saving file to database:', error);
      throw error;
    }
  }
  
  /**
   * Try to determine the partner from the file content
   */
  private async determinePartnerFromFile(filePath: string): Promise<number | null> {
    try {
      // Read file content
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      
      // Get all partners using listPartners method
      const partners = await storage.listPartners();
      
      // Look for GLN in the file
      for (const partner of partners) {
        if (partner.gln && fileContent.includes(partner.gln)) {
          console.log(`Found matching partner by GLN: ${partner.name} (ID: ${partner.id})`);
          return partner.id;
        }
      }
      
      // If no match found, return null
      console.log('No matching partner found for file');
      return null;
    } catch (error) {
      console.error('Error determining partner from file:', error);
      return null;
    }
  }
  
  /**
   * Generate a pre-signed URL and send it to the partner
   */
  private async generateAndSendPresignedUrl(fileId: number, partnerId: number): Promise<void> {
    try {
      // Get partner details
      const partner = await storage.getPartner(partnerId);
      if (!partner) {
        throw new Error(`Partner with ID ${partnerId} not found`);
      }
      
      // Get file details
      const file = await storage.getFile(fileId);
      if (!file) {
        throw new Error(`File with ID ${fileId} not found`);
      }
      
      // Generate pre-signed URL (expires in 7 days)
      const expirationSeconds = 7 * 24 * 60 * 60; // 7 days
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + expirationSeconds);
      
      // Create UUID for the link
      const uuid = uuidv4();
      
      // Store pre-signed link in database
      const presignedLink = await storage.createPresignedLink({
        fileId,
        partnerId,
        uuid,
        urlHash: '', // Will be generated in createPresignedLink
        expiresAt,
        isOneTimeUse: false,
        ipRestriction: null,
        createdBy: 1, // System user ID
      });
      
      // Get the full URL based on environment
      let protocol = 'https';
      let host = process.env.REPLIT_DOMAINS || process.env.REPLIT_DEV_DOMAIN || 'localhost:3000';
      if (host.includes('localhost')) {
        protocol = 'http';
      }
      const downloadUrl = `${protocol}://${host}/api/download/${uuid}`;
      
      // Send notification email to partner
      if (partner.contactEmail) {
        await sendFileShareNotification(
          partner,
          file.originalName,
          downloadUrl,
          expiresAt
        );
        
        console.log(`Sent pre-signed URL notification to partner ${partner.name} at ${partner.contactEmail}`);
      }
    } catch (error) {
      console.error('Error generating pre-signed URL:', error);
    }
  }
}

// Export singleton instance
export const s3Monitor = S3MonitorService.getInstance();