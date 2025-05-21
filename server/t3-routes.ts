import { Router, Request, Response } from 'express';
import { checkAuthenticated } from './auth-middleware';
import { storage } from './storage';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Import inventory-specific globals
declare global {
  var inventoryTransactions: any[];
}

export const t3Router = Router();

// Apply authentication middleware to all T3 routes
t3Router.use(checkAuthenticated);

/**
 * Create a T3 document (TI, TH, TS) based on an inventory transaction
 * POST /api/t3/create
 */
t3Router.post('/create', async (req: Request, res: Response) => {
  try {
    const { inventoryTransactionId, partnerId, format, deliveryMethod } = req.body;

    if (!inventoryTransactionId || !partnerId) {
      return res.status(400).json({ message: 'Missing required fields: inventoryTransactionId and partnerId are required' });
    }

    // Get the partner
    const partner = await storage.getPartner(partnerId);
    if (!partner) {
      return res.status(404).json({ message: 'Partner not found' });
    }

    // Create a mock T3 bundle for demonstration
    const mockBundle = {
      id: 12345,
      bundleId: `T3-${uuidv4().substring(0, 8)}`,
      transactionInformationId: 123,
      format: format || 'xml',
      generatedAt: new Date(),
      deliveryMethod: deliveryMethod || 'as2',
      deliveryStatus: 'pending',
      partnerName: partner.name,
      filePath: '/tmp/t3-documents/example.xml'
    };

    res.status(201).json(mockBundle);
  } catch (error: any) {
    console.error('Error creating T3 document:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * Get a list of all T3 documents
 * GET /api/t3/bundles
 */
t3Router.get('/bundles', async (req: Request, res: Response) => {
  try {
    // Access the actual inventory transactions from global storage
    if (!global.inventoryTransactions || global.inventoryTransactions.length === 0) {
      // If no transactions exist yet, return empty array
      return res.json({ bundles: [], totalPages: 0 });
    }

    // Convert inventory transactions to T3 bundles
    const bundles = global.inventoryTransactions.map((transaction, index) => {
      // Get partner information based on transaction
      const partnerId = transaction.toPartnerId || 1;
      const partnerName = "Your Facility"; // Default for received items
      
      // For transactions with a receiving status, set partner to the sender
      const deliveryStatus = transaction.transactionType === 'receive' ? 'received' : 'pending';
      
      // Create a unique bundle ID for each transaction
      const bundleId = `T3-${transaction.id}`;
      
      return {
        id: transaction.id,
        bundleId,
        format: 'xml',
        generatedAt: transaction.transactionDate || new Date(),
        deliveryMethod: 'as2',
        deliveryStatus,
        partnerName,
        transactionInformation: {
          transactionId: `TX-${transaction.id}`,
          gtin: transaction.gtin,
          ndc: transaction.gtin ? transaction.gtin.substring(2, 13) : 'N/A',
          productName: transaction.productName || 'Pharmaceutical Product',
          lotNumber: transaction.lotNumber,
          expirationDate: transaction.expirationDate,
          quantity: 1
        }
      };
    }).reverse(); // Show newest first

    // Apply pagination
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = 10;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedBundles = bundles.slice(startIndex, endIndex);
    const totalPages = Math.ceil(bundles.length / pageSize);

    res.json({ 
      bundles: paginatedBundles,
      totalPages,
      totalCount: bundles.length
    });
  } catch (error: any) {
    console.error('Error fetching T3 bundles:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * Get a specific T3 bundle
 * GET /api/t3/bundles/:bundleId
 */
t3Router.get('/bundles/:bundleId', async (req: Request, res: Response) => {
  try {
    const { bundleId } = req.params;
    
    // Extract the transaction ID from the bundle ID (T3-123 -> 123)
    const transactionId = parseInt(bundleId.replace('T3-', ''));
    
    // Find the transaction in our global storage
    if (!global.inventoryTransactions) {
      return res.status(404).json({ message: "No transactions found" });
    }
    
    const transaction = global.inventoryTransactions.find(t => t.id === transactionId);
    
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }
    
    // Create a T3 bundle from the actual transaction data
    const bundle = {
      id: transaction.id,
      bundleId,
      transactionInformationId: transaction.id,
      format: 'xml',
      generatedAt: transaction.transactionDate || new Date(),
      deliveryMethod: 'as2',
      deliveryStatus: transaction.transactionType === 'receive' ? 'received' : 'pending',
      partnerName: "Your Facility", // Default for received items
      
      // Include comprehensive data based on the actual transaction
      transactionInformation: {
        transactionId: `TX-${transaction.id}`,
        gtin: transaction.gtin,
        ndc: transaction.gtin ? transaction.gtin.substring(2, 13) : 'N/A',
        productName: transaction.productName || 'Pharmaceutical Product',
        lotNumber: transaction.lotNumber,
        expirationDate: transaction.expirationDate,
        quantity: 1
      },
      
      // Create a transaction history for this item
      transactionHistory: [
        {
          sequenceNumber: 1,
          transactionDate: transaction.transactionDate || new Date().toISOString(),
          senderGln: '0123456789012', // Manufacturer GLN (could be retrieved from EPCIS file)
          receiverGln: '9876543210123', // Your facility GLN
          senderName: 'Manufacturer',
          receiverName: 'Your Facility'
        }
      ],
      
      // Create a standard transaction statement
      transactionStatement: {
        signedBy: req.user?.fullName || 'Authorized User',
        signerTitle: 'Authorized Representative',
        signerCompany: 'Your Company',
        signatureDate: new Date().toISOString()
      }
    };
    
    res.json(bundle);
  } catch (error: any) {
    console.error(`Error fetching T3 bundle ${req.params.bundleId}:`, error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * Download a T3 document file
 * GET /api/t3/download/:bundleId
 */
t3Router.get('/download/:bundleId', async (req: Request, res: Response) => {
  try {
    const { bundleId } = req.params;
    
    // In a real implementation, fetch bundle details from database
    // and return the actual file
    
    // For demo purposes, create a simple XML file on the fly
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<t3Document xmlns="urn:dscsa:t3:schema:1.0" createdAt="${new Date().toISOString()}">
  <transactionInformation>
    <transactionId>TX-123456</transactionId>
    <product>
      <gtin>00301430957010</gtin>
      <ndc>301430957010</ndc>
      <name>SODIUM FERRIC GLUCONATE</name>
    </product>
    <lot>
      <number>24052241</number>
      <expirationDate>2026-09-30</expirationDate>
      <quantity>1</quantity>
    </lot>
    <transaction>
      <date>${new Date().toISOString()}</date>
      <senderGln>0123456789012</senderGln>
      <receiverGln>9876543210123</receiverGln>
    </transaction>
  </transactionInformation>
  
  <transactionHistory>
    <historyEntry>
      <sequenceNumber>1</sequenceNumber>
      <transactionDate>2025-05-10T14:30:00Z</transactionDate>
      <senderGln>0123456789012</senderGln>
      <receiverGln>9876543210123</receiverGln>
    </historyEntry>
    <historyEntry>
      <sequenceNumber>2</sequenceNumber>
      <transactionDate>2025-05-15T10:20:00Z</transactionDate>
      <senderGln>9876543210123</senderGln>
      <receiverGln>5555555555555</receiverGln>
    </historyEntry>
  </transactionHistory>
  
  <transactionStatement>
    <text>
      TRANSACTION STATEMENT
      
      1. The entity transferring ownership of the product ("Transferor") hereby affirms that:
      
      a) Transferor is authorized under the Federal Food, Drug, and Cosmetic Act as amended by the Drug Supply Chain Security Act (DSCSA);
      
      b) Transferor received the product from an authorized person as defined in the DSCSA;
      
      c) Transferor received Transaction Information and a Transaction Statement from the prior owner;
      
      d) Transferor did not knowingly ship a suspect or illegitimate product;
      
      e) Transferor has systems and processes in place to comply with verification requirements under the DSCSA;
      
      f) Transferor did not knowingly provide false transaction information; and
      
      g) Transferor did not knowingly alter the transaction history.
      
      Signed by: John Smith
      Company: Distributor LLC
      Date: 2025-05-15
    </text>
    <signedBy>John Smith</signedBy>
    <signerTitle>Authorized Representative</signerTitle>
    <signerCompany>Distributor LLC</signerCompany>
    <signatureDate>2025-05-15T10:20:00Z</signatureDate>
  </transactionStatement>
</t3Document>`;

    // Create a temporary directory for storing files
    const tempDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Create a temporary file
    const filePath = path.join(tempDir, `${bundleId}.xml`);
    fs.writeFileSync(filePath, xmlContent);
    
    // Send the file as a download
    res.download(filePath, `T3-${bundleId}.xml`, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
      }
      
      // Clean up the file after download
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  } catch (error: any) {
    console.error(`Error downloading T3 document ${req.params.bundleId}:`, error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * Get transaction ledger (centralized T3 record)
 * GET /api/t3/ledger
 */
t3Router.get('/ledger', async (req: Request, res: Response) => {
  try {
    // In real implementation, fetch from database
    // For now, return mock data
    const transactions = [
      {
        id: 1,
        transactionId: 'TX-123456',
        productName: 'SODIUM FERRIC GLUCONATE',
        lotNumber: '24052241',
        transactionDate: new Date(),
        sender: 'Our Company',
        receiver: 'Acme Pharmaceuticals',
        bundleId: 'T3-12345',
        deliveryMethod: 'as2',
        deliveryStatus: 'sent'
      },
      {
        id: 2,
        transactionId: 'TX-789012',
        productName: 'AMOXICILLIN 500MG',
        lotNumber: 'AMX5001',
        transactionDate: new Date(Date.now() - 86400000),
        sender: 'ABC Supplier',
        receiver: 'Our Company',
        bundleId: 'T3-67890',
        deliveryMethod: 'presigned_url',
        deliveryStatus: 'received'
      }
    ];
    
    res.json({ transactions });
  } catch (error: any) {
    console.error('Error fetching T3 ledger:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * Generate a T3 audit export (for 6-year record requirements)
 * GET /api/t3/audit-export
 */
t3Router.get('/audit-export', async (req: Request, res: Response) => {
  try {
    const { format, startDate, endDate } = req.query;
    
    // In real implementation, generate full export based on parameters
    // For now, generate a simple CSV for demo
    const csvContent = `Transaction ID,Product,Lot Number,Transaction Date,Sender,Receiver,Bundle ID,Delivery Method,Status
TX-123456,SODIUM FERRIC GLUCONATE,24052241,2025-05-20,Our Company,Acme Pharmaceuticals,T3-12345,as2,sent
TX-789012,AMOXICILLIN 500MG,AMX5001,2025-05-19,ABC Supplier,Our Company,T3-67890,presigned_url,received`;

    // Create a temporary directory for storing files
    const tempDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Create a temporary file
    const filePath = path.join(tempDir, 't3-audit-export.csv');
    fs.writeFileSync(filePath, csvContent);
    
    // Send the file as a download
    res.download(filePath, 't3-audit-export.csv', (err) => {
      if (err) {
        console.error('Error downloading file:', err);
      }
      
      // Clean up the file after download
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  } catch (error: any) {
    console.error('Error generating T3 audit export:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * Update T3 bundle delivery status
 * PATCH /api/t3/bundles/:bundleId/status
 */
t3Router.patch('/bundles/:bundleId/status', async (req: Request, res: Response) => {
  try {
    const { bundleId } = req.params;
    const { deliveryStatus, deliveryReference } = req.body;
    
    if (!deliveryStatus) {
      return res.status(400).json({ message: 'Missing required field: deliveryStatus' });
    }
    
    // In real implementation, update in database
    // For now, just acknowledge the request
    res.json({
      bundleId,
      deliveryStatus,
      deliveryReference,
      updatedAt: new Date()
    });
  } catch (error: any) {
    console.error(`Error updating T3 bundle status ${req.params.bundleId}:`, error);
    res.status(500).json({ message: error.message });
  }
});