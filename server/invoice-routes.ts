import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { parseInvoicePDF, processInvoicePDF } from './invoice-parser';
import { checkAuthenticated } from './auth-middleware';
import { storage as appStorage } from './storage';
import { v4 as uuidv4 } from 'uuid';

export const invoiceRouter = Router();

// Configure multer for file uploads
const invoiceStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    // Use import.meta.url to determine paths in ES modules
    const moduleURL = new URL(import.meta.url);
    const dirname = path.dirname(moduleURL.pathname);
    const dir = path.join(dirname, '../uploads/invoices');
    try {
      await fs.mkdir(dir, { recursive: true });
      cb(null, dir);
    } catch (err) {
      cb(err as Error, dir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    const extension = path.extname(file.originalname);
    cb(null, `invoice-${uniqueId}${extension}`);
  }
});

const upload = multer({
  storage: invoiceStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only PDF files
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Upload and process an invoice
// For development, we'll make this endpoint accessible regardless of auth status
invoiceRouter.post('/upload', upload.single('invoice'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No invoice file uploaded' });
    }

    console.log(`Invoice uploaded: ${req.file.originalname}`);
    
    // Additional parameters from the form
    const poIds = req.body.poIds ? 
      (Array.isArray(req.body.poIds) ? req.body.poIds : [req.body.poIds]).map(Number) : 
      [];
    
    // Parse the uploaded PDF to extract invoice data
    const filePath = req.file.path;
    const processingResult = await processInvoicePDF(filePath, poIds);
    
    // Save the invoice to the database
    const invoiceData = {
      invoiceNumber: processingResult.invoiceData.invoiceNumber,
      invoiceDate: processingResult.invoiceData.invoiceDate, // Pass as string
      dueDate: processingResult.invoiceData.dueDate, // Pass as string or undefined
      filename: req.file.originalname,
      filepath: req.file.path,
      purchaseOrderId: processingResult.matchedPO,
      vendorName: processingResult.invoiceData.vendor.name,
      vendorAddress: processingResult.invoiceData.vendor.address,
      subtotal: processingResult.invoiceData.totals.subtotal.toString(), // Convert to string
      tax: processingResult.invoiceData.totals.tax?.toString(), // Convert to string
      shipping: processingResult.invoiceData.totals.shipping?.toString(), // Convert to string
      discount: processingResult.invoiceData.totals.discount?.toString(), // Convert to string
      total: processingResult.invoiceData.totals.total.toString(), // Convert to string
      extractedData: processingResult.invoiceData,
      matchScore: processingResult.matchScore ? processingResult.matchScore.toString() : null, // Convert to string
      issues: processingResult.issues || [],
      status: processingResult.issues?.length ? 'needs_review' : 'processed',
      uploadedBy: req.user?.id || 1 // Fallback to user ID 1 if not authenticated
    };
    
    // Store the invoice
    const invoiceRecord = await appStorage.createInvoice(invoiceData);
    
    // Store the invoice items
    for (const product of processingResult.invoiceData.products) {
      await appStorage.createInvoiceItem({
        invoiceId: invoiceRecord.id,
        description: product.description,
        productCode: product.ndc || '',
        ndc: product.ndc || '',
        lotNumber: product.lotNumber,
        expiryDate: product.expiryDate, // Pass as string
        quantity: product.quantity,
        uom: 'EA', // Default unit of measure
        unitPrice: product.unitPrice.toString(), // Convert to string
        totalPrice: product.totalPrice.toString(), // Convert to string
        status: 'pending'
      });
    }
    
    // Find matching EPCIS files based on lot numbers, NDCs
    const matchingEpcisFiles = await appStorage.findMatchingEpcisFiles({
      lotNumbers: processingResult.invoiceData.products.map(p => p.lotNumber),
      ndcCodes: processingResult.invoiceData.products.filter(p => p.ndc).map(p => p.ndc!)
    });
    
    res.status(201).json({
      success: true,
      message: 'Invoice processed successfully',
      invoiceId: invoiceRecord.id,
      extractedData: processingResult.invoiceData,
      matchedPO: processingResult.matchedPO,
      matchScore: processingResult.matchScore,
      issues: processingResult.issues,
      matchingEpcisFiles: matchingEpcisFiles
    });
  } catch (error: any) {
    console.error('Error processing invoice:', error);
    res.status(500).json({
      success: false,
      message: `Error processing invoice: ${error.message}`
    });
  }
});

// Get all invoices
// For development, remove auth check
invoiceRouter.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    const poId = req.query.poId ? parseInt(req.query.poId as string) : undefined;
    
    // Calculate offset based on page and limit
    const offset = (page - 1) * limit;
    
    // Create filters object
    const filters: any = {
      limit,
      offset
    };
    
    // Add optional filters if provided
    if (status) {
      filters.status = status;
    }
    
    if (poId) {
      filters.purchaseOrderId = poId;
    }
    
    // Add date range filters if provided
    if (req.query.startDate) {
      filters.startDate = new Date(req.query.startDate as string);
    }
    
    if (req.query.endDate) {
      filters.endDate = new Date(req.query.endDate as string);
    }
    
    // Get invoices from database
    const result = await appStorage.listInvoices(filters);
    
    res.json({
      invoices: result.invoices,
      total: result.total,
      page,
      limit
    });
  } catch (error: any) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({
      success: false,
      message: `Error fetching invoices: ${error.message}`
    });
  }
});

// Get invoice by ID
// For development, remove auth check
invoiceRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    // Get invoice from database
    const invoice = await appStorage.getInvoice(id);
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: `Invoice with ID ${id} not found`
      });
    }
    
    // Get invoice items
    const invoiceItems = await appStorage.listInvoiceItems(id);
    
    // Find matching EPCIS files
    const matchingEpcisFiles = await appStorage.findMatchingEpcisFiles({
      invoiceNumber: invoice.invoiceNumber
    });
    
    // Get purchase order if available
    let purchaseOrder = null;
    if (invoice.purchaseOrderId) {
      purchaseOrder = await appStorage.getPurchaseOrder(invoice.purchaseOrderId);
    }
    
    // Return invoice with related data
    res.json({
      invoice,
      invoiceItems,
      matchingEpcisFiles: matchingEpcisFiles.map(file => ({
        id: file.id,
        originalName: file.originalName,
        uploadedAt: file.uploadedAt,
        fileSize: file.fileSize,
        fileType: file.fileType
      })),
      purchaseOrder: purchaseOrder ? {
        id: purchaseOrder.id,
        poNumber: purchaseOrder.poNumber,
        orderDate: purchaseOrder.orderDate,
        status: purchaseOrder.status
      } : null
    });
  } catch (error: any) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({
      success: false,
      message: `Error fetching invoice: ${error.message}`
    });
  }
});

// Update invoice status/reconciliation
// Allows updating status, PO association, and reconciliation
invoiceRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { status, purchaseOrderId, notes, reconciled } = req.body;
    
    // Get existing invoice first
    const existingInvoice = await appStorage.getInvoice(id);
    
    if (!existingInvoice) {
      return res.status(404).json({
        success: false,
        message: `Invoice with ID ${id} not found`
      });
    }
    
    // Prepare updates object
    const updates: any = {};
    
    if (status) {
      updates.status = status;
    }
    
    if (purchaseOrderId) {
      // Verify the PO exists
      const po = await appStorage.getPurchaseOrder(parseInt(purchaseOrderId));
      if (!po) {
        return res.status(400).json({
          success: false,
          message: `Purchase Order with ID ${purchaseOrderId} not found`
        });
      }
      updates.purchaseOrderId = parseInt(purchaseOrderId);
      
      // Create an EPCIS-PO association if files are linked to this invoice
      const matchingFiles = await appStorage.findMatchingEpcisFiles({
        invoiceNumber: existingInvoice.invoiceNumber
      });
      
      // For each matching file, try to create an association
      for (const file of matchingFiles) {
        try {
          await appStorage.createEpcisPoAssociation({
            fileId: file.id,
            poId: parseInt(purchaseOrderId),
            associationMethod: 'invoice_matched',
            confidence: 85, // High confidence from invoice match
            createdBy: req.user?.id || 1, 
            notes: `Associated via invoice ${existingInvoice.invoiceNumber}`
          });
        } catch (error) {
          // Log error but continue processing
          console.error(`Error creating PO-EPCIS association for file ${file.id}:`, error);
        }
      }
    }
    
    if (notes !== undefined) {
      updates.notes = notes;
    }
    
    // Handle reconciliation if requested
    if (reconciled === true) {
      updates.reconciledBy = req.user?.id || 1;
      updates.reconciledAt = new Date().toISOString();
      updates.status = 'reconciled';
    }
    
    // Update the invoice
    const updatedInvoice = await appStorage.updateInvoice(id, updates);
    
    // Get updated invoice items
    const invoiceItems = await appStorage.listInvoiceItems(id);
    
    res.json({
      success: true,
      message: 'Invoice updated successfully',
      invoice: updatedInvoice,
      invoiceItems
    });
  } catch (error: any) {
    console.error('Error updating invoice:', error);
    res.status(500).json({
      success: false,
      message: `Error updating invoice: ${error.message}`
    });
  }
});

// Match invoice items with product items from EPCIS files
invoiceRouter.post('/:id/match-products', async (req: Request, res: Response) => {
  try {
    const invoiceId = parseInt(req.params.id);
    
    // Get the invoice
    const invoice = await appStorage.getInvoice(invoiceId);
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: `Invoice with ID ${invoiceId} not found`
      });
    }
    
    // Get invoice items
    const invoiceItems = await appStorage.listInvoiceItems(invoiceId);
    
    if (invoiceItems.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No items found for invoice with ID ${invoiceId}`
      });
    }
    
    // Find matching EPCIS files
    const matchingFiles = await appStorage.findMatchingEpcisFiles({
      lotNumbers: invoiceItems.map(item => item.lotNumber),
      ndcCodes: invoiceItems.filter(item => item.ndc).map(item => item.ndc!),
      invoiceNumber: invoice.invoiceNumber,
      poId: invoice.purchaseOrderId
    });
    
    if (matchingFiles.length === 0) {
      return res.json({
        success: true,
        message: 'No matching EPCIS files found for this invoice',
        matchResults: []
      });
    }
    
    // For each invoice item, find matching product items
    const matchResults = [];
    
    for (const item of invoiceItems) {
      // Get product items for each matching file
      let matchingProductItems = [];
      
      for (const file of matchingFiles) {
        // Get all product items for this file
        const fileProductItems = await appStorage.listProductItemsForFile(file.id);
        
        // Filter by lot number and NDC (via GTIN)
        const lotMatches = fileProductItems.filter(product => 
          product.lotNumber === item.lotNumber
        );
        
        matchingProductItems.push(...lotMatches);
      }
      
      // Calculate match score based on number of matches relative to quantity
      const matchScore = Math.min(1, matchingProductItems.length / item.quantity);
      
      // Update invoice item with match information if needed
      if (matchingProductItems.length > 0 && matchScore > 0) {
        await appStorage.updateInvoiceItem(item.id, {
          status: matchScore >= 1 ? 'matched' : 'partial_match',
          matchScore: matchScore.toFixed(4)
        });
      }
      
      matchResults.push({
        invoiceItem: item,
        matchingProductItems: matchingProductItems.map(p => ({
          id: p.id,
          fileId: p.fileId,
          gtin: p.gtin,
          serialNumber: p.serialNumber,
          lotNumber: p.lotNumber,
          expirationDate: p.expirationDate
        })),
        matchScore,
        status: matchScore >= 1 ? 'matched' : (matchScore > 0 ? 'partial_match' : 'no_match')
      });
    }
    
    // Update invoice status if needed
    const allMatched = matchResults.every(result => result.status === 'matched');
    const someMatched = matchResults.some(result => result.status === 'matched' || result.status === 'partial_match');
    
    if (allMatched) {
      await appStorage.updateInvoice(invoiceId, {
        status: 'verified'
      });
    } else if (someMatched) {
      await appStorage.updateInvoice(invoiceId, {
        status: 'partial_verified'
      });
    }
    
    // Return match results
    res.json({
      success: true,
      message: `Successfully matched invoice items with product items`,
      matchResults,
      matchedFiles: matchingFiles.map(file => ({
        id: file.id,
        originalName: file.originalName,
        uploadedAt: file.uploadedAt
      }))
    });
  } catch (error: any) {
    console.error('Error matching invoice items:', error);
    res.status(500).json({
      success: false,
      message: `Error matching invoice items: ${error.message}`
    });
  }
});