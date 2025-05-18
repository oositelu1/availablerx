import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { storage } from './storage';
import { Partner } from '@shared/schema';
import AWS from 'aws-sdk';
import axios from 'axios';

// Enum for AS2 message status
export enum AS2Status {
  PENDING = 'pending',
  SENT = 'sent',
  RECEIVED = 'received',
  FAILED = 'failed',
  MDN_RECEIVED = 'mdn_received'
}

// Interface for AS2 message
export interface AS2Message {
  id: string;
  sender: string;
  receiver: string;
  subject?: string;
  fileName: string;
  filePath: string;
  status: AS2Status;
  sentAt?: Date;
  mdn?: string;
  error?: string;
}

/**
 * This service provides an interface for sending and receiving AS2 messages.
 * It can work with either AWS Transfer for AS2 or a local OpenAS2 server.
 */
export class AS2Service {
  private static instance: AS2Service;
  private messages: Map<string, AS2Message> = new Map();
  private tmpDir: string;
  private as2ConfigDir: string;
  private useAwsTransfer: boolean;
  private transfer: AWS.Transfer;
  private s3: AWS.S3;
  private awsRegion: string;
  private awsServerId: string;
  private awsBucket: string;
  
  private constructor() {
    // Create temp directory for AS2 operations
    this.tmpDir = path.join(os.tmpdir(), 'epcis-as2');
    this.as2ConfigDir = process.env.AS2_CONFIG_DIR || './as2-config';
    
    // Determine if we should use AWS Transfer for AS2
    this.useAwsTransfer = process.env.USE_AWS_TRANSFER === 'true';
    
    // If using AWS Transfer, initialize AWS SDK
    if (this.useAwsTransfer) {
      // Check for required AWS environment variables
      if (!process.env.AWS_REGION || !process.env.AWS_TRANSFER_SERVER_ID || !process.env.AWS_S3_BUCKET) {
        console.error('AWS Transfer for AS2 is enabled but required environment variables are missing');
        console.error('Required: AWS_REGION, AWS_TRANSFER_SERVER_ID, AWS_S3_BUCKET');
        throw new Error('AWS Transfer configuration incomplete');
      }
      
      this.awsRegion = process.env.AWS_REGION;
      this.awsServerId = process.env.AWS_TRANSFER_SERVER_ID;
      this.awsBucket = process.env.AWS_S3_BUCKET;
      
      // Initialize AWS services
      AWS.config.update({ region: this.awsRegion });
      this.transfer = new AWS.Transfer();
      this.s3 = new AWS.S3();
      
      console.log('Initialized AWS Transfer for AS2 service');
    } else {
      // Ensure directories exist for local OpenAS2
      if (!fs.existsSync(this.tmpDir)) {
        fs.mkdirSync(this.tmpDir, { recursive: true });
      }
      console.log('Initialized local OpenAS2 service');
    }
    
    if (!fs.existsSync(this.as2ConfigDir)) {
      fs.mkdirSync(this.as2ConfigDir, { recursive: true });
    }
  }

  /**
   * Get the singleton instance of AS2Service
   */
  public static getInstance(): AS2Service {
    if (!AS2Service.instance) {
      AS2Service.instance = new AS2Service();
    }
    return AS2Service.instance;
  }

  /**
   * Check if OpenAS2 is installed and properly configured
   */
  public async checkAS2Configuration(): Promise<{ isConfigured: boolean; message: string }> {
    try {
      // Check if configuration files exist
      const configExists = fs.existsSync(path.join(this.as2ConfigDir, 'config.xml'));
      
      if (!configExists) {
        return { 
          isConfigured: false, 
          message: 'OpenAS2 configuration not found. Please configure OpenAS2 before using AS2 functionality.' 
        };
      }
      
      // Additional checks could be performed here
      
      return { isConfigured: true, message: 'OpenAS2 is properly configured.' };
    } catch (error) {
      console.error('Error checking AS2 configuration:', error);
      return { 
        isConfigured: false, 
        message: `Error checking AS2 configuration: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }

  /**
   * Configure OpenAS2 for a partner
   * @param partner The trading partner to configure
   */
  public async configurePartner(partner: Partner): Promise<boolean> {
    try {
      // In a real implementation, this would generate the proper OpenAS2 
      // configuration files for the partner
      console.log(`Configuring OpenAS2 for partner: ${partner.name}`);
      
      // Example: write partner config files
      const partnerConfig = `
      <partner>
        <name>${partner.name}</name>
        <as2_id>${partner.as2To}</as2_id>
        <x509_alias>${partner.as2To}</x509_alias>
        <email>${partner.contactEmail}</email>
        <target_url>${partner.as2Url}</target_url>
        <subject>EPCIS AS2 Message</subject>
        <encryption>${partner.enableEncryption ? 'on' : 'off'}</encryption>
        <encryption_algorithm>3DES</encryption_algorithm>
        <sign>${partner.enableSigning ? 'on' : 'off'}</sign>
        <sign_algorithm>SHA1</sign_algorithm>
        <compress>${partner.enableCompression ? 'on' : 'off'}</compress>
        <mdn_options>
          <mdn_to>${partner.as2From}</mdn_to>
          <mdn_type>${partner.mdn || 'sync'}</mdn_type>
        </mdn_options>
      </partner>
      `;
      
      // In a real implementation, this would be written to the OpenAS2 config directory
      // For now, we'll just log it
      console.log('Partner configuration generated:', partnerConfig);
      
      return true;
    } catch (error) {
      console.error('Error configuring AS2 partner:', error);
      return false;
    }
  }

  /**
   * Send an EPCIS file to a partner using AS2
   * @param fileId The ID of the file to send
   * @param partnerId The ID of the partner to send to
   * @returns A unique message ID for tracking
   */
  public async sendFile(fileId: number, partnerId: number): Promise<{ messageId: string; success: boolean; error?: string }> {
    try {
      // Get file and partner details
      const file = await storage.getFile(fileId);
      const partner = await storage.getPartner(partnerId);
      
      if (!file || !partner) {
        throw new Error('File or partner not found');
      }
      
      // Check if partner has AS2 configuration
      if (!partner.as2To || !partner.as2Url) {
        throw new Error('Partner does not have AS2 configuration');
      }
      
      // Get the file data
      const fileData = await storage.retrieveFileData(fileId);
      if (!fileData) {
        throw new Error('File data not found');
      }
      
      // Generate a unique message ID
      const messageId = uuidv4();
      
      // Write file to temp directory
      const tempFilePath = path.join(this.tmpDir, `${messageId}_${file.originalName}`);
      fs.writeFileSync(tempFilePath, fileData);
      
      // Create an AS2 message record
      const message: AS2Message = {
        id: messageId,
        sender: partner.as2From || 'DEFAULT',
        receiver: partner.as2To,
        subject: `EPCIS File: ${file.originalName}`,
        fileName: file.originalName,
        filePath: tempFilePath,
        status: AS2Status.PENDING,
      };
      
      // Store the message
      this.messages.set(messageId, message);
      
      // In a production environment, we would call the actual OpenAS2 
      // command to send the file. For this example, we'll simulate it.
      console.log(`Simulating AS2 send: ${tempFilePath} to ${partner.name} (${partner.as2To})`);
      
      // Update message status
      message.status = AS2Status.SENT;
      message.sentAt = new Date();
      
      // In a real implementation, we would monitor for MDN receipt
      
      return { messageId, success: true };
    } catch (error) {
      console.error('Error sending file via AS2:', error);
      return { 
        messageId: '', 
        success: false, 
        error: `Error sending file via AS2: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }
  
  /**
   * Get status of an AS2 message
   * @param messageId The unique message ID
   */
  public getMessageStatus(messageId: string): AS2Message | undefined {
    return this.messages.get(messageId);
  }
  
  /**
   * Process an incoming MDN for an AS2 message
   * @param messageId The message ID
   * @param mdn The MDN content
   */
  public processMDN(messageId: string, mdn: string): boolean {
    const message = this.messages.get(messageId);
    if (!message) {
      console.error(`MDN received for unknown message: ${messageId}`);
      return false;
    }
    
    message.mdn = mdn;
    message.status = AS2Status.MDN_RECEIVED;
    return true;
  }
  
  /**
   * Clean up temporary files for a message
   * @param messageId The message ID
   */
  public cleanupMessage(messageId: string): boolean {
    const message = this.messages.get(messageId);
    if (!message) {
      return false;
    }
    
    try {
      if (fs.existsSync(message.filePath)) {
        fs.unlinkSync(message.filePath);
      }
      
      this.messages.delete(messageId);
      return true;
    } catch (error) {
      console.error(`Error cleaning up message ${messageId}:`, error);
      return false;
    }
  }
}

// Export singleton instance
export const as2Service = AS2Service.getInstance();