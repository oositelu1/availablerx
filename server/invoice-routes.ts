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
    const dir = path.join(__dirname, '../uploads/invoices');
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
invoiceRouter.post('/upload', checkAuthenticated, upload.single('invoice'), async (req: Request, res: Response) => {
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
    
    // Store extracted data
    const invoiceRecord = await appStorage.createInvoiceRecord({
      filename: req.file.originalname,
      filepath: req.file.path,
      uploadedBy: req.user!.id,
      extractedData: processingResult.invoiceData,
      matchedPurchaseOrderId: processingResult.matchedPO,
      matchScore: processingResult.matchScore,
      issues: processingResult.issues,
      status: processingResult.issues?.length ? 'needs_review' : 'processed'
    });
    
    res.status(201).json({
      success: true,
      message: 'Invoice processed successfully',
      invoiceId: invoiceRecord.id,
      extractedData: processingResult.invoiceData,
      matchedPO: processingResult.matchedPO,
      matchScore: processingResult.matchScore,
      issues: processingResult.issues
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
invoiceRouter.get('/', checkAuthenticated, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    
    const invoices = await appStorage.listInvoices(page, limit, status);
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
invoiceRouter.get('/:id', checkAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const invoice = await appStorage.getInvoice(id);
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }
    
    res.json(invoice);
  } catch (error: any) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({
      success: false,
      message: `Error fetching invoice: ${error.message}`
    });
  }
});

// Update invoice status/reconciliation
invoiceRouter.patch('/:id', checkAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { status, matchedPurchaseOrderId, notes } = req.body;
    
    const updatedInvoice = await appStorage.updateInvoice(id, {
      status,
      matchedPurchaseOrderId: matchedPurchaseOrderId ? parseInt(matchedPurchaseOrderId) : undefined,
      notes
    });
    
    if (!updatedInvoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }
    
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