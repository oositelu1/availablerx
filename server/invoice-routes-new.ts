import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { checkAuthenticated } from './auth-middleware';
import { processStructuredInvoice, saveInvoice, matchInvoiceToPurchaseOrders } from './invoice-processing';

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
// Making this endpoint accessible without authentication for testing
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
    
    // Process the invoice file using the structured data approach
    const filePath = req.file.path;
    const invoiceData = processStructuredInvoice(filePath);
    
    // Match against purchase orders
    const matchResult = await matchInvoiceToPurchaseOrders(invoiceData, poIds);
    
    // Save to database 
    const saveResult = await saveInvoice(
      invoiceData, 
      req.file.originalname, 
      req.file.path, 
      req.user?.id || 1 // Default to user ID 1 if not authenticated
    );
    
    if (!saveResult.success) {
      throw new Error(saveResult.error || 'Failed to save invoice');
    }
    
    // Return the processing result
    res.status(201).json({
      success: true,
      message: 'Invoice processed successfully',
      invoiceId: saveResult.invoiceId,
      extractedData: invoiceData,
      matchedPO: matchResult.matchedPO,
      matchScore: matchResult.matchScore,
      issues: matchResult.issues
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
invoiceRouter.get('/', async (req: Request, res: Response) => {
  try {
    // This would be replaced with actual database query in production
    res.json({
      invoices: [],
      total: 0,
      page: 1,
      limit: 10
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
invoiceRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    // This would be replaced with actual database query in production
    const mockInvoice = {
      id: id,
      invoiceNumber: "626000800",
      invoiceDate: "04/30/2025",
      poNumber: "43121",
      vendor: {
        name: "Eugia US LLC (f/k/a AuroMedics Pharma LLC)",
        address: "279 Princeton-Hightstown Road, Suite 214, East Windsor, NJ 08520-1401"
      },
      customer: {
        name: "LONE STAR PHARMACEUTICALS, INC.",
        address: "11951 HILLTOP ROAD, SUITE 18, ARGYLE, TX 76226, US"
      },
      products: [{
        description: "Tranexamic Acid Injection SDV 1000mg/10mL - 10s",
        ndc: "55150018810",
        lotNumber: "3TA25004A",
        expiryDate: "29-FEB-28",
        quantity: 48,
        unitPrice: 23.79,
        totalPrice: 1141.92
      }],
      totals: {
        subtotal: 1141.92,
        total: 1141.92
      }
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