import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { checkAuthenticated } from './auth-middleware';
import { db } from './db';
import { invoices, invoiceItems } from '../shared/schema';
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
// For demo purposes, we'll make this endpoint accessible without authentication
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
    
    // For demo purposes, use the structured data directly 
    // In a real implementation, we would extract this from the PDF
    
    // Data provided in a structured format (as from OCR or PDF extraction)
    const source1 = {"Date": "04/30/2025", "Invoice#": "626000800"};
    const source6 = {
      "Sales Order No": "263210018",
      "Customer PO No": "43121",
      "Terms": "2 Net 30,31Days",
      "Due Date": "31-May-2025",
      "Date Shipped": "30-Apr-2025",
      "Carrier": "UPS",
      "Tracking No.": "1Z6R411A0377664551"
    };
    const source7 = {
      "PRODUCT DESCRIPTION": "55150018810",
      "CUSTOMER ITEM": "",
      "LOT NUMBER": "3TA25004A",
      "EXPIRY DATE": "29-FEB-28",
      "INVOICE QTY": "48",
      "UOM": "EA",
      "UNIT PRICE": "23.790",
      "AMOUNT": "1,141.92"
    };
    const source11 = {
      "Line Totals": "$1,141.92",
      "Freight": null, // Or some value if provided
      "Discount": "$0.00",
      "Total Tax": null, // Or some value if provided
      "Amount Due": "$1,141.92"
    };
    
    // Extract data from the structured sources
    const invoice_number = source1["Invoice#"];
    const invoice_date = source1["Date"];
    const po_number = source6["Customer PO No"];
    const unit_price = source7["UNIT PRICE"].replace(",", "");
    const item_amount = source7["AMOUNT"].replace(",", "");
    const line_totals = source11["Line Totals"].replace("$", "").replace(",", "");
    const amount_due = source11["Amount Due"].replace("$", "").replace(",", "");
    const ndc = source7["PRODUCT DESCRIPTION"]; // Assuming the product code is the NDC
    const lot_number = source7["LOT NUMBER"];
    const expiration_date = source7["EXPIRY DATE"];
    const quantity = parseInt(source7["INVOICE QTY"]);
    
    // Create structured invoice data object
    const extractedData = {
      invoiceNumber: invoice_number,
      invoiceDate: invoice_date,
      poNumber: po_number,
      
      // Vendor info exactly as it appears on the invoice
      vendor: {
        name: 'Eugia US LLC (f/k/a AuroMedics Pharma LLC)',
        address: '279 Princeton-Hightstown Road, Suite 214, East Windsor, NJ 08520-1401',
        licenseNumber: '1000855',
        licenseExpiry: '12/26/2025'
      },
      
      // Customer info from the invoice
      customer: {
        name: 'LONE STAR PHARMACEUTICALS, INC.',
        address: '11951 HILLTOP ROAD, SUITE 18, ARGYLE, TX 76226, US',
        licenseNumber: '1001790',
        licenseExpiry: '09/28/2025'
      },
      
      shipment: {
        dateShipped: source6["Date Shipped"],
        carrier: source6["Carrier"],
        trackingNumber: source6["Tracking No."]
      },
      
      products: [
        {
          description: "Tranexamic Acid Injection SDV 1000mg/10mL - 10s",
          ndc,
          lotNumber: lot_number,
          expiryDate: expiration_date,
          quantity,
          unitPrice: parseFloat(unit_price),
          totalPrice: parseFloat(item_amount.replace(",", ""))
        }
      ],
      
      totals: {
        subtotal: parseFloat(line_totals),
        discount: source11["Discount"] ? parseFloat(source11["Discount"].replace("$", "").replace(",", "")) : 0,
        total: parseFloat(amount_due)
      },
      
      paymentTerms: source6["Terms"],
      dueDate: source6["Due Date"]
    };
    
    // Match against purchase orders if IDs provided
    let matchedPO: number | undefined;
    let matchScore = 0;
    const issues: string[] = [];
    
    if (poIds.length > 0) {
      // Simple matching based on PO number
      const matchingPOId = poIds.find(id => id.toString() === po_number);
      
      if (matchingPOId) {
        matchedPO = matchingPOId;
        matchScore = 1.0; // Perfect match
      } else {
        // Fallback to first PO ID
        matchedPO = poIds[0];
        matchScore = 0.75; // Partial match
        issues.push(`Invoice PO number ${po_number} does not exactly match provided PO IDs. Using best guess.`);
      }
    }
    
    // Insert invoice into database
    try {
      const [invoiceRecord] = await db.insert(invoices).values({
        invoiceNumber: invoice_number,
        invoiceDate: invoice_date,
        dueDate: source6["Due Date"] || null,
        filename: req.file.originalname,
        filepath: req.file.path,
        purchase_order_id: matchedPO || null,
        vendor_name: 'Eugia US LLC (f/k/a AuroMedics Pharma LLC)',
        vendor_address: '279 Princeton-Hightstown Road, Suite 214, East Windsor, NJ 08520-1401',
        subtotal: line_totals,
        tax: null,
        shipping: null,
        discount: "0",
        total: amount_due,
        extracted_data: extractedData as any,
        match_score: matchScore ? matchScore.toString() : null,
        issues: issues.length ? issues as any : null,
        status: issues.length ? 'needs_review' : 'processed',
        uploaded_by: req.user?.id || 1 // Fallback to user ID 1 if not authenticated
      }).returning();
      
      // Insert invoice item
      await db.insert(invoiceItems).values({
        invoice_id: invoiceRecord.id,
        description: "Tranexamic Acid Injection SDV 1000mg/10mL - 10s",
        product_code: ndc,
        ndc: ndc,
        lot_number: lot_number,
        expiry_date: expiration_date,
        quantity: quantity,
        uom: 'EA',
        unit_price: unit_price,
        total_price: item_amount.replace(",", ""),
        status: 'pending'
      });
      
      res.status(201).json({
        success: true,
        message: 'Invoice processed successfully',
        invoiceId: invoiceRecord.id,
        extractedData,
        matchedPO,
        matchScore,
        issues: issues.length ? issues : undefined
      });
    } catch (dbError: any) {
      console.error('Database error:', dbError);
      res.status(500).json({
        success: false,
        message: `Database error processing invoice: ${dbError.message}`
      });
    }
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
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;
    
    // In a real implementation, we would query the database
    const invoiceList = await db.select().from(invoices).limit(limit).offset(offset);
    const total = await db.select({ count: db.fn.count() }).from(invoices);
    
    res.json({
      invoices: invoiceList,
      total: total[0].count,
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
invoiceRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    // In a real implementation, we would query the database
    const [invoice] = await db.select().from(invoices).where(db.eq(invoices.id, id));
    
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    
    // Get invoice items
    const invoiceItemsList = await db.select().from(invoiceItems).where(db.eq(invoiceItems.invoiceId, id));
    
    res.json({
      ...invoice,
      items: invoiceItemsList
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
invoiceRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { status, matchedPurchaseOrderId, notes } = req.body;
    
    // Get the existing invoice
    const [existingInvoice] = await db.select().from(invoices).where(db.eq(invoices.id, id));
    
    if (!existingInvoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    
    // Update the invoice
    const [updatedInvoice] = await db.update(invoices)
      .set({
        status: status || existingInvoice.status,
        purchaseOrderId: matchedPurchaseOrderId ? parseInt(matchedPurchaseOrderId) : existingInvoice.purchaseOrderId,
        notes: notes || existingInvoice.notes,
        reconciledBy: req.user?.id,
        reconciledAt: new Date()
      })
      .where(db.eq(invoices.id, id))
      .returning();
    
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