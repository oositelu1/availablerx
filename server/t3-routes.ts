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

    // Log the actual inventory transactions for debugging
    console.log("T3 API - All inventory transactions:", JSON.stringify(global.inventoryTransactions));
    
    // Convert inventory transactions to T3 bundles
    const bundles = global.inventoryTransactions.map((transaction, index) => {
      // Get partner information based on transaction
      const partnerId = transaction.toPartnerId || 1;
      
      // Get the product name from the inventory transactions
      let productName = transaction.productName || "Unknown Product";
      
      // The product name might also be in the details object
      if (!productName || productName === "Unknown Product") {
        if (transaction.details && transaction.details.productName) {
          productName = transaction.details.productName;
        }
      }
      
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
          productName: productName,
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
    
    // Extract the transaction ID from the bundle ID
    const transactionId = parseInt(bundleId.replace('T3-', ''));
    
    // Find the transaction in our global storage
    if (!global.inventoryTransactions) {
      return res.status(404).json({ message: "No transactions found" });
    }
    
    const transaction = global.inventoryTransactions.find(t => t.id === transactionId);
    
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }
    
    // Generate XML file based on actual transaction data
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<t3Document xmlns="urn:dscsa:t3:schema:1.0" createdAt="${new Date().toISOString()}">
  <transactionInformation>
    <transactionId>TX-${transaction.id}</transactionId>
    <product>
      <gtin>${transaction.gtin || 'N/A'}</gtin>
      <ndc>${transaction.gtin ? transaction.gtin.substring(2, 13) : 'N/A'}</ndc>
      <name>${transaction.productName || 'Pharmaceutical Product'}</name>
    </product>
    <lot>
      <number>${transaction.lotNumber || 'N/A'}</number>
      <expirationDate>${transaction.expirationDate || 'N/A'}</expirationDate>
      <quantity>1</quantity>
    </lot>
    <transaction>
      <date>${transaction.transactionDate?.toISOString() || new Date().toISOString()}</date>
      <senderGln>0123456789012</senderGln>
      <receiverGln>9876543210123</receiverGln>
    </transaction>
  </transactionInformation>
  
  <transactionHistory>
    <historyEntry>
      <sequenceNumber>1</sequenceNumber>
      <transactionDate>${transaction.transactionDate?.toISOString() || new Date().toISOString()}</transactionDate>
      <senderGln>0123456789012</senderGln>
      <receiverGln>9876543210123</receiverGln>
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
      
      Signed by: ${req.user?.fullName || 'Authorized User'}
      Company: Your Company
      Date: ${new Date().toISOString().split('T')[0]}
    </text>
    <signedBy>${req.user?.fullName || 'Authorized User'}</signedBy>
    <signerTitle>Authorized Representative</signerTitle>
    <signerCompany>Your Company</signerCompany>
    <signatureDate>${new Date().toISOString()}</signatureDate>
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
    // Use real inventory transactions instead of mock data
    if (!global.inventoryTransactions || global.inventoryTransactions.length === 0) {
      return res.json({ transactions: [] });
    }
    
    // Convert inventory transactions to a format suitable for the ledger
    const transactions = global.inventoryTransactions.map(transaction => {
      return {
        id: transaction.id,
        transactionId: `TX-${transaction.id}`,
        productName: transaction.productName || 'Pharmaceutical Product',
        lotNumber: transaction.lotNumber || 'N/A',
        transactionDate: transaction.transactionDate || new Date(),
        sender: 'Manufacturer',
        receiver: 'Your Facility',
        bundleId: `T3-${transaction.id}`,
        deliveryMethod: 'as2',
        deliveryStatus: transaction.transactionType === 'receive' ? 'received' : 'pending'
      };
    }).reverse(); // Show newest first
    
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
    
    // Use real inventory transactions instead of mock data
    if (!global.inventoryTransactions || global.inventoryTransactions.length === 0) {
      // Create empty CSV if no transactions
      const csvContent = `Transaction ID,Product,Lot Number,Transaction Date,Sender,Receiver,Bundle ID,Delivery Method,Status`;
      const tempDir = path.join(process.cwd(), 'tmp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const filePath = path.join(tempDir, 't3-audit-export.csv');
      fs.writeFileSync(filePath, csvContent);
      return res.download(filePath, 't3-audit-export.csv');
    }
    
    // Generate CSV from actual transactions
    let csvContent = `Transaction ID,Product,Lot Number,Transaction Date,Sender,Receiver,Bundle ID,Delivery Method,Status\n`;
    
    global.inventoryTransactions.forEach(transaction => {
      const row = [
        `TX-${transaction.id}`,
        transaction.productName || 'Pharmaceutical Product',
        transaction.lotNumber || 'N/A',
        transaction.transactionDate?.toISOString() || new Date().toISOString(),
        'Manufacturer',
        'Your Facility',
        `T3-${transaction.id}`,
        'as2',
        transaction.transactionType === 'receive' ? 'received' : 'pending'
      ].join(',');
      
      csvContent += row + '\n';
    });

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