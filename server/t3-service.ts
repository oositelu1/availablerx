import { v4 as uuidv4 } from 'uuid';
import { 
  TransactionInformation, 
  InsertTransactionInformation,
  TransactionHistory,
  InsertTransactionHistory,
  TransactionStatement,
  InsertTransactionStatement,
  T3Bundle,
  InsertT3Bundle,
  User,
  Partner
} from '@shared/schema';
import { db } from './db';
import { 
  transactionInformation, 
  transactionHistory, 
  transactionStatements, 
  t3Bundles 
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

/**
 * Service class for handling T3 document creation, storage, and transmission
 * T3 components: Transaction Information (TI), Transaction History (TH), Transaction Statement (TS)
 */
export class T3Service {
  private static instance: T3Service;
  private t3BaseDir: string;

  private constructor() {
    // Create directory for T3 document storage if it doesn't exist
    this.t3BaseDir = path.join(process.cwd(), 'tmp', 't3-documents');
    if (!fs.existsSync(this.t3BaseDir)) {
      fs.mkdirSync(this.t3BaseDir, { recursive: true });
    }
  }

  /**
   * Get the singleton instance of T3Service
   */
  public static getInstance(): T3Service {
    if (!T3Service.instance) {
      T3Service.instance = new T3Service();
    }
    return T3Service.instance;
  }

  /**
   * Create a new Transaction Information (TI) record
   */
  async createTransactionInformation(data: InsertTransactionInformation): Promise<TransactionInformation> {
    try {
      const [newTI] = await db
        .insert(transactionInformation)
        .values(data)
        .returning();
      
      return newTI;
    } catch (error) {
      console.error('Error creating Transaction Information:', error);
      throw error;
    }
  }

  /**
   * Add a transaction to the Transaction History (TH)
   */
  async addToTransactionHistory(data: InsertTransactionHistory): Promise<TransactionHistory> {
    try {
      const [newTH] = await db
        .insert(transactionHistory)
        .values(data)
        .returning();
      
      return newTH;
    } catch (error) {
      console.error('Error adding to Transaction History:', error);
      throw error;
    }
  }

  /**
   * Create a Transaction Statement (TS) 
   */
  async createTransactionStatement(data: InsertTransactionStatement): Promise<TransactionStatement> {
    try {
      const [newTS] = await db
        .insert(transactionStatements)
        .values(data)
        .returning();
      
      return newTS;
    } catch (error) {
      console.error('Error creating Transaction Statement:', error);
      throw error;
    }
  }
  
  /**
   * Generate a standard Transaction Statement text
   * This implements the PRD requirement for "standard DSCSA TS language with user/date"
   */
  generateStandardStatement(signerName: string, companyName: string): string {
    const currentDate = new Date().toISOString().split('T')[0];
    
    return `
      TRANSACTION STATEMENT
      
      1. The entity transferring ownership of the product ("Transferor") hereby affirms that:
      
      a) Transferor is authorized under the Federal Food, Drug, and Cosmetic Act as amended by the Drug Supply Chain Security Act (DSCSA);
      
      b) Transferor received the product from an authorized person as defined in the DSCSA;
      
      c) Transferor received Transaction Information and a Transaction Statement from the prior owner;
      
      d) Transferor did not knowingly ship a suspect or illegitimate product;
      
      e) Transferor has systems and processes in place to comply with verification requirements under the DSCSA;
      
      f) Transferor did not knowingly provide false transaction information; and
      
      g) Transferor did not knowingly alter the transaction history.
      
      Signed by: ${signerName}
      Company: ${companyName}
      Date: ${currentDate}
    `.trim();
  }

  /**
   * Create a complete T3 Bundle (TI+TH+TS) for a transaction
   */
  async createT3Bundle(
    transactionInformationId: number, 
    format: 'xml' | 'json' | 'pdf', 
    user: User, 
    deliveryMethod: 'as2' | 'https' | 'presigned_url',
    partnerId?: number
  ): Promise<T3Bundle> {
    try {
      // Generate a unique bundle ID
      const bundleId = `T3-${uuidv4()}`;
      
      // Create bundle record
      const [newBundle] = await db
        .insert(t3Bundles)
        .values({
          bundleId,
          transactionInformationId,
          format,
          generatedBy: user.id,
          deliveryMethod,
          deliveredTo: partnerId,
          deliveryStatus: 'pending',
          createdBy: user.id
        })
        .returning();
      
      // Generate the actual T3 document file
      await this.generateT3Document(newBundle);
      
      return newBundle;
    } catch (error) {
      console.error('Error creating T3 Bundle:', error);
      throw error;
    }
  }
  
  /**
   * Generates the actual T3 document file (XML, JSON, or PDF)
   */
  private async generateT3Document(bundle: T3Bundle): Promise<string> {
    try {
      // Get all components of the T3 document
      const ti = await this.getTransactionInformation(bundle.transactionInformationId);
      if (!ti) {
        throw new Error('Transaction Information not found');
      }
      
      const th = await this.getTransactionHistory(bundle.transactionInformationId);
      const ts = await this.getTransactionStatement(bundle.transactionInformationId);
      
      if (!ts) {
        throw new Error('Transaction Statement not found');
      }
      
      // Create directory for this bundle
      const bundleDir = path.join(this.t3BaseDir, bundle.bundleId);
      if (!fs.existsSync(bundleDir)) {
        fs.mkdirSync(bundleDir, { recursive: true });
      }
      
      // Generate the appropriate format
      let filePath = '';
      
      if (bundle.format === 'xml') {
        filePath = path.join(bundleDir, `${bundle.bundleId}.xml`);
        const xmlContent = this.generateXmlDocument(ti, th, ts);
        fs.writeFileSync(filePath, xmlContent);
      } 
      else if (bundle.format === 'json') {
        filePath = path.join(bundleDir, `${bundle.bundleId}.json`);
        const jsonContent = this.generateJsonDocument(ti, th, ts);
        fs.writeFileSync(filePath, jsonContent);
      }
      else if (bundle.format === 'pdf') {
        filePath = path.join(bundleDir, `${bundle.bundleId}.pdf`);
        // In a real implementation, we would use a PDF generation library here
        // For this demo, we'll just write a text file with a note
        fs.writeFileSync(filePath, 'PDF generation would be implemented with a PDF library');
      }
      
      // Update the bundle with the file path
      await db
        .update(t3Bundles)
        .set({ 
          filePath,
          fileHash: 'SHA256-' + Date.now() // In a real app, calculate actual file hash
        })
        .where(eq(t3Bundles.id, bundle.id));
      
      return filePath;
    } catch (error) {
      console.error('Error generating T3 document:', error);
      throw error;
    }
  }
  
  /**
   * Generate a T3 XML document
   */
  private generateXmlDocument(
    ti: TransactionInformation, 
    th: TransactionHistory[], 
    ts: TransactionStatement
  ): string {
    // Basic XML structure for demonstration
    // In a production environment, this would use a proper XML builder library
    // and include all required DSCSA fields in the correct format
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<t3Document xmlns="urn:dscsa:t3:schema:1.0" createdAt="${new Date().toISOString()}">
  <transactionInformation>
    <transactionId>${ti.transactionId}</transactionId>
    <product>
      <gtin>${ti.gtin}</gtin>
      <ndc>${ti.ndc || ''}</ndc>
      <name>${ti.productName}</name>
      <dosageForm>${ti.dosageForm || ''}</dosageForm>
      <strength>${ti.strength || ''}</strength>
    </product>
    <lot>
      <number>${ti.lotNumber}</number>
      <expirationDate>${new Date(ti.expirationDate).toISOString().split('T')[0]}</expirationDate>
      <quantity>${ti.quantity}</quantity>
    </lot>
    <transaction>
      <date>${new Date(ti.transactionDate).toISOString()}</date>
      <senderGln>${ti.senderGln}</senderGln>
      <receiverGln>${ti.receiverGln}</receiverGln>
    </transaction>
  </transactionInformation>
  
  <transactionHistory>`;
    
    // Add each history entry
    th.forEach(entry => {
      xml += `
    <historyEntry>
      <sequenceNumber>${entry.sequenceNumber}</sequenceNumber>
      <transactionDate>${new Date(entry.transactionDate).toISOString()}</transactionDate>
      <senderGln>${entry.senderGln}</senderGln>
      <receiverGln>${entry.receiverGln}</receiverGln>
    </historyEntry>`;
    });
    
    xml += `
  </transactionHistory>
  
  <transactionStatement>
    <text><![CDATA[${ts.statementText}]]></text>
    <signedBy>${ts.signedBy}</signedBy>
    <signerTitle>${ts.signerTitle || ''}</signerTitle>
    <signerCompany>${ts.signerCompany}</signerCompany>
    <signatureDate>${new Date(ts.signatureDate).toISOString()}</signatureDate>
  </transactionStatement>
</t3Document>`;
    
    return xml;
  }
  
  /**
   * Generate a T3 JSON document
   */
  private generateJsonDocument(
    ti: TransactionInformation, 
    th: TransactionHistory[], 
    ts: TransactionStatement
  ): string {
    // Create JSON structure
    const t3Document = {
      version: "1.0",
      createdAt: new Date().toISOString(),
      transactionInformation: {
        transactionId: ti.transactionId,
        product: {
          gtin: ti.gtin,
          ndc: ti.ndc,
          name: ti.productName,
          dosageForm: ti.dosageForm,
          strength: ti.strength
        },
        lot: {
          number: ti.lotNumber,
          expirationDate: new Date(ti.expirationDate).toISOString().split('T')[0],
          quantity: ti.quantity
        },
        transaction: {
          date: new Date(ti.transactionDate).toISOString(),
          senderGln: ti.senderGln,
          receiverGln: ti.receiverGln
        }
      },
      transactionHistory: th.map(entry => ({
        sequenceNumber: entry.sequenceNumber,
        transactionDate: new Date(entry.transactionDate).toISOString(),
        senderGln: entry.senderGln,
        receiverGln: entry.receiverGln
      })),
      transactionStatement: {
        text: ts.statementText,
        signedBy: ts.signedBy,
        signerTitle: ts.signerTitle,
        signerCompany: ts.signerCompany,
        signatureDate: new Date(ts.signatureDate).toISOString()
      }
    };
    
    return JSON.stringify(t3Document, null, 2);
  }
  
  /**
   * Get Transaction Information by ID
   */
  async getTransactionInformation(id: number): Promise<TransactionInformation | undefined> {
    try {
      const [ti] = await db
        .select()
        .from(transactionInformation)
        .where(eq(transactionInformation.id, id));
      
      return ti;
    } catch (error) {
      console.error('Error getting Transaction Information:', error);
      throw error;
    }
  }
  
  /**
   * Get Transaction History entries for a Transaction Information
   */
  async getTransactionHistory(transactionInformationId: number): Promise<TransactionHistory[]> {
    try {
      const th = await db
        .select()
        .from(transactionHistory)
        .where(eq(transactionHistory.transactionInformationId, transactionInformationId))
        .orderBy(transactionHistory.sequenceNumber);
      
      return th;
    } catch (error) {
      console.error('Error getting Transaction History:', error);
      throw error;
    }
  }
  
  /**
   * Get Transaction Statement for a Transaction Information
   */
  async getTransactionStatement(transactionInformationId: number): Promise<TransactionStatement | undefined> {
    try {
      const [ts] = await db
        .select()
        .from(transactionStatements)
        .where(eq(transactionStatements.transactionInformationId, transactionInformationId));
      
      return ts;
    } catch (error) {
      console.error('Error getting Transaction Statement:', error);
      throw error;
    }
  }
  
  /**
   * Find T3 Bundle by bundle ID
   */
  async getT3Bundle(bundleId: string): Promise<T3Bundle | undefined> {
    try {
      const [bundle] = await db
        .select()
        .from(t3Bundles)
        .where(eq(t3Bundles.bundleId, bundleId));
      
      return bundle;
    } catch (error) {
      console.error('Error getting T3 Bundle:', error);
      throw error;
    }
  }
  
  /**
   * Get all T3 Bundles for a Transaction Information
   */
  async getT3BundlesForTransaction(transactionInformationId: number): Promise<T3Bundle[]> {
    try {
      const bundles = await db
        .select()
        .from(t3Bundles)
        .where(eq(t3Bundles.transactionInformationId, transactionInformationId))
        .orderBy(t3Bundles.generatedAt);
      
      return bundles;
    } catch (error) {
      console.error('Error getting T3 Bundles for transaction:', error);
      throw error;
    }
  }
  
  /**
   * Create all T3 components (TI, TH, TS) at once from inventory transaction data
   * This is a convenience method for creating a complete T3 document from inventory movement
   */
  async createT3FromInventoryTransaction(
    inventoryTransactionId: number,
    user: User,
    partner: Partner,
    format: 'xml' | 'json' | 'pdf' = 'xml',
    deliveryMethod: 'as2' | 'https' | 'presigned_url' = 'as2'
  ): Promise<T3Bundle> {
    try {
      // In a real implementation, we would:
      // 1. Fetch the inventory transaction details
      // 2. Fetch the product details
      // 3. Fetch any previous transaction history
      // 4. Create the Transaction Information (TI)
      // 5. Create or append to Transaction History (TH)
      // 6. Create the Transaction Statement (TS)
      // 7. Create the T3 Bundle
      
      // For demo purposes, we'll create sample data
      const transactionId = `TX-${Date.now()}`;
      
      // Create Transaction Information
      const ti = await this.createTransactionInformation({
        transactionId,
        inventoryTransactionId,
        gtin: '00301430957010',
        ndc: '301430957010',
        productName: 'SODIUM FERRIC GLUCONATE',
        lotNumber: '24052241',
        expirationDate: new Date('2026-09-30'),
        quantity: 1,
        transactionDate: new Date(),
        senderGln: '0123456789012',
        receiverGln: partner.gln || 'UNKNOWN',
        createdBy: user.id
      });
      
      // Create Transaction History - start with one entry for this transaction
      const th = await this.addToTransactionHistory({
        transactionInformationId: ti.id,
        sequenceNumber: 1,
        transactionDate: new Date(),
        senderGln: '0123456789012',
        receiverGln: partner.gln || 'UNKNOWN',
        senderId: null,
        receiverId: partner.id,
        sourceVerified: true,
        createdBy: user.id
      });
      
      // Create Transaction Statement
      const statementText = this.generateStandardStatement(user.fullName, 'MedScout Pharma');
      const ts = await this.createTransactionStatement({
        transactionInformationId: ti.id,
        statementText,
        signedBy: user.fullName,
        signerTitle: 'Authorized Representative',
        signerCompany: 'MedScout Pharma',
        signatureDate: new Date(),
        createdBy: user.id
      });
      
      // Create T3 Bundle
      const bundle = await this.createT3Bundle(
        ti.id,
        format,
        user,
        deliveryMethod,
        partner.id
      );
      
      return bundle;
    } catch (error) {
      console.error('Error creating T3 from inventory transaction:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const t3Service = T3Service.getInstance();