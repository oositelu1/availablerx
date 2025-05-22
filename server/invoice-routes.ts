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
    
    // For demo purposes, return mock data
    const invoices = {
      invoices: [],
      total: 0,
      page,
      limit
    };
    res.json(invoices);
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
    
    // For demo purposes, return a mock invoice
    const mockInvoice = {
      id: id,
      filename: "invoice_sample.pdf",
      filepath: "/tmp/invoice_sample.pdf",
      uploadedBy: req.user!.id,
      uploadedAt: new Date(),
      status: "processed",
      extractedData: {
        invoiceNumber: "INV-12345",
        invoiceDate: "2025-05-20",
        poNumber: "PO-67890",
        vendor: {
          name: "ABC Pharmaceuticals",
          address: "123 Pharma Lane, Med City, MC 12345",
        },
        customer: {
          name: "AvailableRx",
          address: "456 Healthcare Ave, Pharmacy Town, PT 54321",
        },
        shipment: {},
        products: [{
          description: "Medication A 10mg",
          lotNumber: "LOT123456",
          expiryDate: "2026-05-20",
          quantity: 100,
          unitPrice: 25.99,
          totalPrice: 2599.00
        }],
        totals: {
          subtotal: 2599.00,
          tax: 207.92,
          total: 2806.92
        }
      },
      matchedPurchaseOrderId: 1,
      matchScore: 0.95,
      issues: []
    };
    
    res.json(mockInvoice);
  } catch (error: any) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({
      success: false,
      message: `Error fetching invoice: ${error.message}`
    });
  }
});

// Update invoice status/reconciliation
// For development, remove auth check
invoiceRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { status, matchedPurchaseOrderId, notes } = req.body;
    
    // For demo purposes, return a success response with mock data
    const updatedInvoice = {
      id,
      filename: "invoice_sample.pdf",
      filepath: "/tmp/invoice_sample.pdf",
      uploadedBy: req.user!.id,
      uploadedAt: new Date(),
      status: status || 'processed',
      extractedData: {
        invoiceNumber: "INV-12345",
        invoiceDate: "2025-05-20",
        poNumber: "PO-67890",
        vendor: {
          name: "ABC Pharmaceuticals",
          address: "123 Pharma Lane, Med City, MC 12345",
        },
        customer: {
          name: "AvailableRx",
          address: "456 Healthcare Ave, Pharmacy Town, PT 54321",
        },
        shipment: {},
        products: [{
          description: "Medication A 10mg",
          lotNumber: "LOT123456",
          expiryDate: "2026-05-20",
          quantity: 100,
          unitPrice: 25.99,
          totalPrice: 2599.00
        }],
        totals: {
          subtotal: 2599.00,
          tax: 207.92,
          total: 2806.92
        }
      },
      matchedPurchaseOrderId: matchedPurchaseOrderId ? parseInt(matchedPurchaseOrderId) : 1,
      matchScore: 0.95,
      issues: [],
      notes: notes || ""
    };
    
    res.json({
      success: true,
      message: 'Invoice updated successfully',
      invoice: updatedInvoice
    });
  } catch (error: any) {
    console.error('Error updating invoice:', error);
    res.status(500).json({
      success: false,
      message: `Error updating invoice: ${error.message}`
    });
  }
});