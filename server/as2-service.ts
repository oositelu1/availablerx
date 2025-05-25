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
  MDN_RECEIVED = 'mdn_received', // General MDN received status
  MDN_SUCCESS = 'mdn_success',   // Specific status for successful MDN
  MDN_FAILURE = 'mdn_failure'    // Specific status for failed MDN
}

// Interface for AS2 message (application's internal representation before persistence)
export interface AS2Message {
  id: string; // Application-generated UUID
  fileId: number;
  partnerId: number;
  status: AS2Status;
  senderAs2Id: string;
  receiverAs2Id: string;
  sentAt?: Date;
  mdnReceivedAt?: Date;
  originalMessageId?: string | null; // Message-ID header of the actual AS2 message
  mdnContent?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  // For local OpenAS2, we might still need filePath temporarily if not using S3 for staging
  filePath?: string; 
  subject?: string; // Keep subject for notifications or logging
  fileName?: string; // Keep original filename for notifications or logging
}

// Interface for the simulated database record, closely matching the conceptual schema
interface SimulatedAS2MessageDbRecord {
  id: string; // UUID, primary key (application-generated)
  fileId: number; // foreign key to files table
  partnerId: number; // foreign key to partners table
  status: AS2Status;
  senderAs2Id: string;
  receiverAs2Id: string;
  sentAt: Date | null;
  mdnReceivedAt: Date | null;
  originalMessageId: string | null; // Message-ID header of the actual AS2 message
  mdnContent: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  // These might not be directly in the DB table but useful for the service layer logic
  filePath?: string; // Temporary path for local OpenAS2 before send
  subject?: string;
  fileName?: string;
}

/**
 * This service provides an interface for sending and receiving AS2 messages.
 * It can work with either AWS Transfer for AS2 or a local OpenAS2 server.
 */
export class AS2Service {
  private static instance: AS2Service;
  private simulatedAs2MessagesDb: Array<SimulatedAS2MessageDbRecord> = [];
  private tmpDir: string = '';
  private as2ConfigDir: string = '';
  private useAwsTransfer: boolean = false;
  private transfer: AWS.Transfer | null = null;
  private s3: AWS.S3 | null = null;
  private awsRegion: string = '';
  private awsServerId: string = '';
  private awsBucket: string = '';

  private constructor() {
    // Create temp directory for AS2 operations (still needed for local OpenAS2 staging)
    this.tmpDir = path.join(os.tmpdir(), 'epcis-as2');
    this.as2ConfigDir = process.env.AS2_CONFIG_DIR || './as2-config';

    // Determine if we should use AWS Transfer for AS2
    this.useAwsTransfer = process.env.USE_AWS_TRANSFER === 'true';

    if (this.useAwsTransfer) {
      if (!process.env.AWS_REGION || !process.env.AWS_TRANSFER_SERVER_ID || !process.env.AWS_S3_BUCKET) {
        console.error('AWS Transfer for AS2 is enabled but required environment variables are missing');
        console.error('Required: AWS_REGION, AWS_TRANSFER_SERVER_ID, AWS_S3_BUCKET');
        throw new Error('AWS Transfer configuration incomplete');
      }
      this.awsRegion = process.env.AWS_REGION;
      this.awsServerId = process.env.AWS_TRANSFER_SERVER_ID;
      this.awsBucket = process.env.AWS_S3_BUCKET;
      AWS.config.update({ region: this.awsRegion });
      this.transfer = new AWS.Transfer();
      this.s3 = new AWS.S3();
      console.log('Initialized AWS Transfer for AS2 service');
    } else {
      // Ensure temp directory exists for local OpenAS2
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
      
      // Generate a unique application-level message ID
      const appMessageId = uuidv4();
      const now = new Date();

      // Create an AS2 message record for the simulated DB
      const dbRecord: SimulatedAS2MessageDbRecord = {
        id: appMessageId,
        fileId: file.id,
        partnerId: partner.id,
        status: AS2Status.PENDING,
        senderAs2Id: partner.as2From || 'DEFAULT_SENDER_AS2_ID', // Ensure a value
        receiverAs2Id: partner.as2To,
        sentAt: null,
        mdnReceivedAt: null,
        originalMessageId: 'pending_actual_message_id', // Placeholder
        mdnContent: null,
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
        fileName: file.originalName,
        subject: `EPCIS File: ${file.originalName}`
      };

      if (this.useAwsTransfer && this.s3 && this.transfer) {
        // Using AWS Transfer for AS2
        try {
          console.log(`Using AWS Transfer for AS2 to send file to ${partner.name} (${partner.as2To})`);

          if (!partner.as2ConnectorId) {
            const errorMsg = `AWS Transfer for AS2: No connector ID configured for partner ${partner.name}. Cannot send file.`;
            console.error(errorMsg);
            dbRecord.status = AS2Status.FAILED;
            dbRecord.errorMessage = errorMsg;
            dbRecord.updatedAt = new Date();
            this.simulatedAs2MessagesDb.push(dbRecord);
            return { messageId: appMessageId, success: false, error: errorMsg };
          }
          
          // First upload the file to S3
          const s3Key = `as2-outbound/${appMessageId}/${file.originalName}`;
          await this.s3.putObject({
            Bucket: this.awsBucket,
            Key: s3Key,
            Body: fileData
          }).promise();
          
          dbRecord.filePath = `s3://${this.awsBucket}/${s3Key}`; // Store S3 path if needed

          // Start the file transfer using the configured connector
          const startFileTransferResponse = await this.transfer.startFileTransfer({
            ConnectorId: partner.as2ConnectorId,
            SendFilePaths: [s3Key] // AWS SDK expects an array of paths relative to the bucket root
          }).promise();
          
          console.log(`AWS Transfer for AS2: Started file transfer ${JSON.stringify(startFileTransferResponse)}`);
          
          // Capture the MessageId from AWS Transfer if available
          // For this subtask, the SDK response structure for startFileTransfer is not detailed.
          // Assuming it does not directly return the AS2 Message-ID.
          // In a real scenario, this might come from an EventBridge event or by listing executions.
          dbRecord.originalMessageId = "aws_transfer_message_id_placeholder"; 
          dbRecord.status = AS2Status.SENT;
          dbRecord.sentAt = new Date();
          dbRecord.updatedAt = new Date();
          
          this.simulatedAs2MessagesDb.push(dbRecord);
          
          return { 
            messageId: appMessageId, 
            success: true,
            error: undefined // Explicitly undefined on success
          };

        } catch (awsError) {
          const errorMsg = `AWS Transfer for AS2 error: ${awsError instanceof Error ? awsError.message : String(awsError)}`;
          console.error('Error sending file via AWS Transfer for AS2:', awsError);
          dbRecord.status = AS2Status.FAILED;
          dbRecord.errorMessage = errorMsg;
          dbRecord.updatedAt = new Date();
          this.simulatedAs2MessagesDb.push(dbRecord);
          return { messageId: appMessageId, success: false, error: errorMsg };
        }
      } else {
        // Using local OpenAS2
        const tempFilePath = path.join(this.tmpDir, `${appMessageId}_${file.originalName}`);
        fs.writeFileSync(tempFilePath, fileData);
        
        dbRecord.filePath = tempFilePath; // Temporary path for local file
        
        console.log(`Simulating OpenAS2 send: ${tempFilePath} to ${partner.name} (${partner.as2To})`);
        
        // Simulate OpenAS2 producing a unique Message-ID
        dbRecord.originalMessageId = `openas2_simulated_message_id_${uuidv4()}`;
        dbRecord.status = AS2Status.SENT;
        dbRecord.sentAt = new Date();
        dbRecord.updatedAt = new Date();
        
        this.simulatedAs2MessagesDb.push(dbRecord);
        
        return { messageId: appMessageId, success: true };
      }
    } catch (error) {
      const errorMsg = `Error sending file via AS2: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMsg);
      // Attempt to record the failure if appMessageId was generated
      const appMessageId = uuidv4(); // Generate a new one if it failed before dbRecord creation
      const existingRecord = this.simulatedAs2MessagesDb.find(m => m.id === appMessageId);
      if (existingRecord) {
        existingRecord.status = AS2Status.FAILED;
        existingRecord.errorMessage = errorMsg;
        existingRecord.updatedAt = new Date();
      } else if (fileId && partnerId) { // Only add if we have enough info for a minimal record
         const now = new Date();
         this.simulatedAs2MessagesDb.push({
            id: appMessageId,
            fileId,
            partnerId,
            status: AS2Status.FAILED,
            senderAs2Id: 'unknown',
            receiverAs2Id: 'unknown',
            sentAt: null,
            mdnReceivedAt: null,
            originalMessageId: null,
            mdnContent: null,
            errorMessage: errorMsg,
            createdAt: now,
            updatedAt: now,
         });
      }
      return { messageId: appMessageId, success: false, error: errorMsg };
    }
  }
  
  /**
   * Get status of an AS2 message by its application-generated ID
   * @param appMessageId The unique application-level message ID
   */
  public getMessageStatus(appMessageId: string): SimulatedAS2MessageDbRecord | undefined {
    return this.simulatedAs2MessagesDb.find(m => m.id === appMessageId);
  }
  
  /**
   * Process an incoming MDN, correlating by the original AS2 Message-ID.
   * @param originalMessageId The Message-ID header from the received MDN.
   * @param mdnProperties Parsed properties from the MDN.
   */
  public processMDNByOriginalMessageId(
    originalMessageId: string, 
    mdnProperties: { mdnContent: string; receivedAt: Date; isSuccess: boolean; mic?: string }
  ): boolean {
    const messageIndex = this.simulatedAs2MessagesDb.findIndex(m => m.originalMessageId === originalMessageId);
    
    if (messageIndex === -1) {
      console.error(`MDN received for unknown original AS2 Message-ID: ${originalMessageId}`);
      return false;
    }
    
    const message = this.simulatedAs2MessagesDb[messageIndex];
    message.mdnContent = mdnProperties.mdnContent;
    message.mdnReceivedAt = mdnProperties.receivedAt;
    message.status = mdnProperties.isSuccess ? AS2Status.MDN_SUCCESS : AS2Status.MDN_FAILURE;
    if (!mdnProperties.isSuccess) {
        message.errorMessage = message.errorMessage ? `${message.errorMessage}; MDN indicates failure.` : 'MDN indicates failure.';
    }
    message.updatedAt = new Date();
    
    // In a real scenario, you might also verify the MIC (Message Integrity Check) if provided.
    console.log(`Processed MDN for originalMessageId ${originalMessageId}. Success: ${mdnProperties.isSuccess}. MIC (if available): ${mdnProperties.mic}`);
    
    this.simulatedAs2MessagesDb[messageIndex] = message; // Update the record in the simulated DB
    return true;
  }
  
  /**
   * Clean up temporary files for a message and remove from simulated DB.
   * @param appMessageId The application-level message ID
   */
  public cleanupMessage(appMessageId: string): boolean {
    const messageIndex = this.simulatedAs2MessagesDb.findIndex(m => m.id === appMessageId);
    if (messageIndex === -1) {
      return false;
    }
    
    const message = this.simulatedAs2MessagesDb[messageIndex];
    
    try {
      // filePath might be on S3 (s3://...) or local. Only attempt fs.unlinkSync for local files.
      if (message.filePath && !message.filePath.startsWith('s3://') && fs.existsSync(message.filePath)) {
        fs.unlinkSync(message.filePath);
        console.log(`Cleaned up local temp file: ${message.filePath}`);
      }
      
      this.simulatedAs2MessagesDb.splice(messageIndex, 1); // Remove from simulated DB
      return true;
    } catch (error) {
      console.error(`Error cleaning up message ${messageId}:`, error);
      return false;
    }
  }
}

// Export singleton instance
export const as2Service = AS2Service.getInstance();