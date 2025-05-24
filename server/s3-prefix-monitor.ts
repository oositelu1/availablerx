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

interface MonitoredReceiver {
  partnerId: number;
  partnerName: string;
  gln: string;
  email: string;
  s3Prefix: string; // e.g., "receivers/distributor-abc/"
  lastCheckTime: Date;
  processedFiles: Set<string>;
}

/**
 * S3 monitoring service that uses a single bucket with separate prefixes
 * for different receivers. More scalable and cost-efficient.
 */
export class S3PrefixMonitorService {
  private static instance: S3PrefixMonitorService;
  private s3: AWS.S3;
  private interval: NodeJS.Timeout | null = null;
  private _isRunning: boolean = false;
  private receivers: Map<number, MonitoredReceiver> = new Map();
  private readonly tempDir: string;
  private checkIntervalMs: number = 5 * 60 * 1000; // 5 minutes default
  private bucketName: string;
  
  private constructor() {
    // Initialize AWS S3 client
    if (process.env.AWS_REGION) {
      AWS.config.update({ region: process.env.AWS_REGION });
      this.s3 = new AWS.S3();
    } else {
      this.s3 = new AWS.S3();
    }
    
    // Single bucket for all AS2 transfers
    // Prefer AWS_S3_AS2_BUCKET if set, otherwise fall back to AWS_S3_BUCKET
    this.bucketName = process.env.AWS_S3_AS2_BUCKET || process.env.AWS_S3_BUCKET || '';
    
    // Create temp directory for file processing
    this.tempDir = path.join(os.tmpdir(), 'epcis-as2-prefix-processing');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
    
    console.log('S3 Prefix Monitor Service initialized');
    console.log(`Using bucket: ${this.bucketName}`);
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): S3PrefixMonitorService {
    if (!S3PrefixMonitorService.instance) {
      S3PrefixMonitorService.instance = new S3PrefixMonitorService();
    }
    return S3PrefixMonitorService.instance;
  }
  
  /**
   * Generate S3 prefix for a partner
   * Format: receivers/{partner-gln}/
   */
  private generateS3Prefix(partner: Partner): string {
    // Use GLN if available, otherwise use partner ID
    const identifier = partner.gln || `partner-${partner.id}`;
    return `receivers/${identifier}/`;
  }
  
  /**
   * Load all active AS2 receivers from database
   */
  private async loadReceiversFromDatabase(): Promise<void> {
    try {
      const activePartners = await storage.getAllActiveAS2Receivers();
      
      for (const partner of activePartners) {
        if (!this.receivers.has(partner.id)) {
          const receiver: MonitoredReceiver = {
            partnerId: partner.id,
            partnerName: partner.companyName,
            gln: partner.gln || '',
            email: partner.contactEmail,
            s3Prefix: partner.s3Prefix || this.generateS3Prefix(partner),
            lastCheckTime: new Date(),
            processedFiles: new Set<string>()
          };
          
          this.receivers.set(partner.id, receiver);
          console.log(`Added receiver ${partner.companyName} with prefix: ${receiver.s3Prefix}`);
        }
      }
      
      console.log(`Loaded ${activePartners.length} receivers for monitoring`);
    } catch (error) {
      console.error('Error loading receivers from database:', error);
    }
  }
  
  /**
   * Start monitoring all configured receivers
   */
  public async start(intervalMs?: number): Promise<void> {
    if (this._isRunning) {
      console.log('S3 Prefix Monitor Service is already running');
      return;
    }
    
    if (!this.bucketName) {
      throw new Error('AWS_S3_AS2_BUCKET or AWS_S3_BUCKET environment variable not configured');
    }
    
    if (intervalMs) {
      this.checkIntervalMs = intervalMs;
    }
    
    // Load receivers from database
    await this.loadReceiversFromDatabase();
    
    this._isRunning = true;
    
    // Perform initial check
    await this.checkAllReceivers();
    
    // Set up periodic checks
    this.interval = setInterval(async () => {
      await this.checkAllReceivers();
    }, this.checkIntervalMs);
    
    console.log(`S3 Prefix Monitor Service started`);
    console.log(`Monitoring ${this.receivers.size} receivers in bucket: ${this.bucketName}`);
    console.log(`Check interval: ${this.checkIntervalMs / 1000} seconds`);
  }
  
  /**
   * Stop the monitoring service
   */
  public stop(): void {
    if (!this._isRunning || !this.interval) {
      console.log('S3 Prefix Monitor Service is not running');
      return;
    }
    
    clearInterval(this.interval);
    this.interval = null;
    this._isRunning = false;
    console.log('S3 Prefix Monitor Service stopped');
  }
  
  /**
   * Check all receivers for new files
   */
  private async checkAllReceivers(): Promise<void> {
    console.log(`Checking ${this.receivers.size} receiver prefixes for new files`);
    
    // Reload receivers from database to pick up any changes
    await this.loadReceiversFromDatabase();
    
    // Check each receiver's prefix in parallel
    const checkPromises = Array.from(this.receivers.values()).map(receiver => 
      this.checkReceiverPrefix(receiver).catch(error => {
        console.error(`Error checking receiver ${receiver.partnerName}:`, error);
      })
    );
    
    await Promise.all(checkPromises);
  }
  
  /**
   * Check a specific receiver's S3 prefix for new files
   */
  private async checkReceiverPrefix(receiver: MonitoredReceiver): Promise<void> {
    try {
      console.log(`Checking prefix ${receiver.s3Prefix} for ${receiver.partnerName}`);
      receiver.lastCheckTime = new Date();
      
      const params = {
        Bucket: this.bucketName,
        Prefix: receiver.s3Prefix,
        MaxKeys: 100
      };
      
      const response = await this.s3.listObjectsV2(params).promise();
      
      if (!response.Contents || response.Contents.length === 0) {
        return;
      }
      
      // Filter for new files only
      const newFiles = response.Contents.filter(obj => {
        const key = obj.Key || '';
        return !receiver.processedFiles.has(key) && 
               !key.endsWith('/') && 
               (key.endsWith('.xml') || key.endsWith('.zip'));
      });
      
      if (newFiles.length === 0) {
        return;
      }
      
      console.log(`Found ${newFiles.length} new files for ${receiver.partnerName}`);
      
      // Process each new file
      for (const fileObj of newFiles) {
        if (!fileObj.Key) continue;
        
        try {
          await this.processReceiverFile(receiver, fileObj.Key);
          receiver.processedFiles.add(fileObj.Key);
        } catch (error) {
          console.error(`Error processing file ${fileObj.Key} for ${receiver.partnerName}:`, error);
        }
      }
    } catch (error) {
      console.error(`Error checking prefix for ${receiver.partnerName}:`, error);
      throw error;
    }
  }
  
  /**
   * Process a file for a specific receiver
   */
  private async processReceiverFile(receiver: MonitoredReceiver, s3Key: string): Promise<void> {
    console.log(`Processing file ${s3Key} for receiver ${receiver.partnerName}`);
    
    // Download file from S3
    const params = {
      Bucket: this.bucketName,
      Key: s3Key
    };
    
    const s3Object = await this.s3.getObject(params).promise();
    if (!s3Object.Body) {
      throw new Error(`File ${s3Key} has no content`);
    }
    
    // Save to temp file
    const fileName = path.basename(s3Key);
    const tempFilePath = path.join(this.tempDir, `${receiver.partnerId}-${Date.now()}-${fileName}`);
    fs.writeFileSync(tempFilePath, s3Object.Body as Buffer);
    
    try {
      // Process the file
      const fileId = uuidv4();
      const processedResult = await processFile(tempFilePath, fileId);
      
      if (!processedResult.success) {
        console.error(`File validation failed for ${fileName}:`, processedResult.error);
        return;
      }
      
      // Extract sender information from the processed file
      const senderGLN = processedResult.metadata?.senderGLN;
      if (!senderGLN) {
        console.error('No sender GLN found in file metadata');
        return;
      }
      
      // Find the sender partner by GLN
      const senderPartner = await storage.getPartnerByGLN(senderGLN);
      if (!senderPartner) {
        console.error(`No partner found with GLN ${senderGLN}`);
        // Continue anyway - we can still process the file
      }
      
      const senderName = senderPartner?.companyName || `Unknown Sender (GLN: ${senderGLN})`;
      console.log(`File from ${senderName} to ${receiver.partnerName}`);
      
      // Store the file in database
      const storedFile = await storage.createFile({
        originalName: fileName,
        storagePath: s3Key,
        fileSize: s3Object.ContentLength || 0,
        fileType: fileName.endsWith('.zip') ? 'ZIP' : 'XML',
        sha256: crypto.createHash('sha256').update(s3Object.Body as Buffer).digest('hex'),
        status: 'validated',
        metadata: {
          ...processedResult.metadata,
          receiverGLN: receiver.gln,
          receiverName: receiver.partnerName,
          senderName: senderName,
          s3Bucket: this.bucketName,
          s3Key: s3Key
        },
        uploadedBy: 1 // System user
      });
      
      // Generate pre-signed URL
      const presignedUrl = await this.generatePresignedUrl(s3Key, receiver.partnerName);
      
      // Send notification to receiver
      const emailData = {
        recipientEmail: receiver.email,
        recipientName: receiver.partnerName,
        senderName: senderName,
        fileName: fileName,
        presignedUrl: presignedUrl,
        expiresIn: '7 days',
        fileSize: s3Object.ContentLength ? `${(s3Object.ContentLength / 1024 / 1024).toFixed(2)} MB` : 'Unknown',
        metadata: {
          senderGLN: senderGLN,
          receiverGLN: receiver.gln,
          processedAt: new Date().toISOString(),
          fileId: storedFile.id
        }
      };
      
      await sendFileShareNotification(emailData);
      
      console.log(`Successfully processed and notified for file ${fileName}`);
      
    } finally {
      // Clean up temp file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  }
  
  /**
   * Generate a pre-signed URL for file access
   */
  private async generatePresignedUrl(key: string, partnerName: string): Promise<string> {
    const params = {
      Bucket: this.bucketName,
      Key: key,
      Expires: 7 * 24 * 60 * 60, // 7 days
      ResponseContentDisposition: `attachment; filename="${path.basename(key)}"`
    };
    
    return this.s3.getSignedUrl('getObject', params);
  }
  
  /**
   * Get monitoring status
   */
  public getStatus(): {
    isRunning: boolean;
    bucketName: string;
    receivers: Array<{
      partnerId: number;
      partnerName: string;
      gln: string;
      s3Prefix: string;
      lastCheckTime: Date;
      processedFileCount: number;
    }>;
    checkInterval: number;
  } {
    const receivers = Array.from(this.receivers.values()).map(r => ({
      partnerId: r.partnerId,
      partnerName: r.partnerName,
      gln: r.gln,
      s3Prefix: r.s3Prefix,
      lastCheckTime: r.lastCheckTime,
      processedFileCount: r.processedFiles.size
    }));
    
    return {
      isRunning: this._isRunning,
      bucketName: this.bucketName,
      receivers,
      checkInterval: this.checkIntervalMs
    };
  }
  
  /**
   * Trigger immediate check for a specific receiver
   */
  public async checkReceiver(partnerId: number): Promise<void> {
    const receiver = this.receivers.get(partnerId);
    if (!receiver) {
      throw new Error(`Receiver with partner ID ${partnerId} not found`);
    }
    
    console.log(`Manual check triggered for ${receiver.partnerName}`);
    await this.checkReceiverPrefix(receiver);
  }
  
  /**
   * Update a receiver's S3 prefix
   */
  public async updateReceiverPrefix(partnerId: number, newPrefix: string): Promise<void> {
    const receiver = this.receivers.get(partnerId);
    if (!receiver) {
      throw new Error(`Receiver with partner ID ${partnerId} not found`);
    }
    
    // Ensure prefix ends with /
    if (!newPrefix.endsWith('/')) {
      newPrefix += '/';
    }
    
    receiver.s3Prefix = newPrefix;
    receiver.processedFiles.clear(); // Clear processed files for the new prefix
    
    // Update in database
    await storage.updatePartner(partnerId, { s3Prefix: newPrefix });
    
    console.log(`Updated ${receiver.partnerName} prefix to: ${newPrefix}`);
  }
}