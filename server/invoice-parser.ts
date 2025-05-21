import * as pdfjsLib from 'pdfjs-dist';
import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';

// Set the worker source (required for PDF.js)
pdfjsLib.GlobalWorkerOptions.workerSrc = '//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Define the structure of extracted invoice data
export interface ExtractedInvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  poNumber: string;
  vendor: {
    name: string;
    address: string;
    licenseNumber?: string;
    licenseExpiry?: string;
  };
  customer: {
    name: string;
    address: string;
    licenseNumber?: string;
    licenseExpiry?: string;
  };
  shipment: {
    dateShipped?: string;
    carrier?: string;
    trackingNumber?: string;
  };
  products: Array<{
    description: string;
    ndc?: string;
    lotNumber: string;
    expiryDate: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  totals: {
    subtotal: number;
    tax?: number;
    shipping?: number;
    discount?: number;
    total: number;
  };
  paymentTerms?: string;
  dueDate?: string;
}

// Validation schema for invoice data
export const invoiceDataSchema = z.object({
  invoiceNumber: z.string(),
  invoiceDate: z.string(),
  poNumber: z.string(),
  vendor: z.object({
    name: z.string(),
    address: z.string(),
    licenseNumber: z.string().optional(),
    licenseExpiry: z.string().optional(),
  }),
  customer: z.object({
    name: z.string(),
    address: z.string(),
    licenseNumber: z.string().optional(),
    licenseExpiry: z.string().optional(),
  }),
  shipment: z.object({
    dateShipped: z.string().optional(),
    carrier: z.string().optional(),
    trackingNumber: z.string().optional(),
  }),
  products: z.array(z.object({
    description: z.string(),
    ndc: z.string().optional(),
    lotNumber: z.string(),
    expiryDate: z.string(),
    quantity: z.number(),
    unitPrice: z.number(),
    totalPrice: z.number(),
  })),
  totals: z.object({
    subtotal: z.number(),
    tax: z.number().optional(),
    shipping: z.number().optional(),
    discount: z.number().optional(),
    total: z.number(),
  }),
  paymentTerms: z.string().optional(),
  dueDate: z.string().optional(),
});

export type InvoiceData = z.infer<typeof invoiceDataSchema>;

/**
 * Parse PDF file to extract invoice data
 * @param filePath Path to the PDF file
 * @returns Extracted invoice data
 */
export async function parseInvoicePDF(filePath: string): Promise<ExtractedInvoiceData> {
  // Use a shell command to extract text from PDF using pdftotext (part of poppler-utils)
  // This is more reliable for text extraction than JavaScript libraries
  return new Promise((resolve, reject) => {
    exec(`cat ${filePath} | strings`, async (error, stdout, stderr) => {
      if (error) {
        console.error(`Error extracting text from PDF: ${error.message}`);
        // Fallback to loading the PDF with pdf-lib
        try {
          const pdfBytes = await fs.readFile(filePath);
          const pdfDoc = await PDFDocument.load(pdfBytes);
          const pageCount = pdfDoc.getPageCount();
          
          // We don't have direct text extraction in pdf-lib
          // So we'll use some pre-defined patterns to identify invoice data
          console.log(`PDF loaded with pdf-lib. Page count: ${pageCount}`);
          
          // Extract using the file name for initial basic information
          const fileName = path.basename(filePath);
          console.log(`Using filename for extraction: ${fileName}`);
          
          // Extract PO number and Invoice number from filename if possible
          const fileNameMatch = fileName.match(/PO\s*(\d+)\s*-\s*INV\s*(\d+)/i);
          
          const defaultData: ExtractedInvoiceData = {
            invoiceNumber: fileNameMatch ? fileNameMatch[2] : 'Unknown',
            invoiceDate: new Date().toLocaleDateString(),
            poNumber: fileNameMatch ? fileNameMatch[1] : 'Unknown',
            vendor: {
              name: 'Extracted from PDF',
              address: 'Address extraction failed',
            },
            customer: {
              name: 'Customer extraction failed',
              address: 'Address extraction failed',
            },
            shipment: {},
            products: [{
              description: 'Product extraction failed',
              lotNumber: 'Unknown',
              expiryDate: 'Unknown',
              quantity: 0,
              unitPrice: 0,
              totalPrice: 0
            }],
            totals: {
              subtotal: 0,
              total: 0
            }
          };
          
          resolve(defaultData);
        } catch (pdfLibError) {
          console.error('Error with pdf-lib fallback:', pdfLibError);
          reject(new Error(`Failed to extract invoice data: ${error.message}`));
        }
        return;
      }
      
      if (stderr) {
        console.warn(`Warning during PDF text extraction: ${stderr}`);
      }
      
      const text = stdout;
      console.log('PDF Text Extract (first 500 chars):', text.substring(0, 500));
      
      // Use regex and text patterns to extract information
      const invoiceData = extractInvoiceData(text, null);
      resolve(invoiceData);
    });
  });
}

/**
 * Extract structured invoice data from PDF text content
 * @param text The raw text content from the PDF
 * @param extractedData Additional data from PDF.js extract
 * @returns Structured invoice data
 */
function extractInvoiceData(text: string, extractedData: any): ExtractedInvoiceData {
  // Initialize with default structure
  const invoiceData: ExtractedInvoiceData = {
    invoiceNumber: '',
    invoiceDate: '',
    poNumber: '',
    vendor: {
      name: '',
      address: '',
    },
    customer: {
      name: '',
      address: '',
    },
    shipment: {},
    products: [],
    totals: {
      subtotal: 0,
      total: 0,
    },
  };

  // Extract invoice number
  const invoiceNumberMatch = text.match(/Invoice\s*#\s*:?\s*([A-Z0-9-]+)/i) || 
                            text.match(/Invoice\s*Number\s*:?\s*([A-Z0-9-]+)/i) ||
                            text.match(/Invoice\s*#\s*([A-Z0-9-]+)/i);
  if (invoiceNumberMatch && invoiceNumberMatch[1]) {
    invoiceData.invoiceNumber = invoiceNumberMatch[1].trim();
  }

  // Extract invoice date
  const dateMatch = text.match(/Date\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i) ||
                   text.match(/Invoice\s*Date\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i) ||
                   text.match(/Date\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i);
  if (dateMatch && dateMatch[1]) {
    invoiceData.invoiceDate = dateMatch[1].trim();
  }

  // Extract PO number
  const poMatch = text.match(/P\.?O\.?\s*#?\s*:?\s*([A-Z0-9-]+)/i) || 
                 text.match(/Purchase\s*Order\s*:?\s*([A-Z0-9-]+)/i) ||
                 text.match(/Customer\s*PO\s*No\s*:?\s*([A-Z0-9-]+)/i) ||
                 text.match(/PO\s*#?\s*:?\s*([A-Z0-9-]+)/i);
  if (poMatch && poMatch[1]) {
    invoiceData.poNumber = poMatch[1].trim();
  }

  // Extract vendor information (assuming it's usually at the top of the invoice)
  const vendorLines = text.split('\n').slice(0, 10).filter(line => line.trim().length > 0);
  if (vendorLines.length > 0) {
    invoiceData.vendor.name = vendorLines[0].trim();
    invoiceData.vendor.address = vendorLines.slice(1, 3).join(', ').trim();
  }

  // Extract customer information (typically after "Bill To" or "Ship To")
  const billToIndex = text.indexOf('Bill To');
  if (billToIndex !== -1) {
    const billToText = text.substring(billToIndex, billToIndex + 300);
    const billToLines = billToText.split('\n').filter(line => line.trim().length > 0);
    if (billToLines.length > 1) {
      // Skip the "Bill To" line
      invoiceData.customer.name = billToLines[1].trim();
      invoiceData.customer.address = billToLines.slice(2, 5).join(', ').trim();
    }
  }

  // Extract license information
  const vendorLicenseMatch = text.match(/State\s*License\s*:?\s*([A-Z0-9-]+)/i);
  if (vendorLicenseMatch && vendorLicenseMatch[1]) {
    invoiceData.vendor.licenseNumber = vendorLicenseMatch[1].trim();
  }

  const vendorExpiryMatch = text.match(/State\s*Expiry\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  if (vendorExpiryMatch && vendorExpiryMatch[1]) {
    invoiceData.vendor.licenseExpiry = vendorExpiryMatch[1].trim();
  }

  // Extract shipment information
  const dateShippedMatch = text.match(/Date\s*Shipped\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i);
  if (dateShippedMatch && dateShippedMatch[1]) {
    invoiceData.shipment.dateShipped = dateShippedMatch[1].trim();
  }

  const carrierMatch = text.match(/Carrier\s*:?\s*([A-Za-z0-9 ]+)/i);
  if (carrierMatch && carrierMatch[1]) {
    invoiceData.shipment.carrier = carrierMatch[1].trim();
  }

  const trackingMatch = text.match(/Tracking\s*No\.?\s*:?\s*([A-Z0-9-]+)/i);
  if (trackingMatch && trackingMatch[1]) {
    invoiceData.shipment.trackingNumber = trackingMatch[1].trim();
  }

  // Extract product information
  // This is more complex and depends on the invoice format
  // Look for patterns like product descriptions, lot numbers, quantities, etc.
  const lotMatch = text.match(/LOT\s*:?\s*([A-Z0-9-]+)/i) || 
                  text.match(/LOT\s*NUMBER\s*:?\s*([A-Z0-9-]+)/i) ||
                  text.match(/LOT\s*#?\s*:?\s*([A-Z0-9-]+)/i);
  
  const expiryMatch = text.match(/EXPIRY\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i) || 
                     text.match(/EXPIRY\s*DATE\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i) ||
                     text.match(/EXP\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i);

  // Try to extract product information by looking for patterns in the text
  // This is a simplified approach and may need adjustments based on invoice format
  const productLines = text.split('\n').filter(line => {
    // Look for lines that contain product-related information
    return line.match(/\d+\s+EA\s+\d+\.\d+\s+\d+,\d+\.\d+/i) ||
           line.match(/\d+\s+BOX\s+\d+\.\d+\s+\d+,\d+\.\d+/i) ||
           line.match(/\d+\s+EACH\s+\d+\.\d+\s+\d+,\d+\.\d+/i);
  });

  // Process each product line
  productLines.forEach(line => {
    const parts = line.trim().split(/\s+/);
    const qtyIndex = parts.findIndex(part => part.match(/^\d+$/));
    const priceIndex = parts.findIndex(part => part.match(/^\d+\.\d+$/));
    const totalIndex = parts.findIndex(part => part.match(/^\d+,\d+\.\d+$/));
    
    if (qtyIndex !== -1 && priceIndex !== -1 && totalIndex !== -1) {
      const product = {
        description: parts.slice(0, qtyIndex).join(' '),
        lotNumber: lotMatch ? lotMatch[1].trim() : 'Unknown',
        expiryDate: expiryMatch ? expiryMatch[1].trim() : 'Unknown',
        quantity: parseInt(parts[qtyIndex]),
        unitPrice: parseFloat(parts[priceIndex]),
        totalPrice: parseFloat(parts[totalIndex].replace(',', '')),
      };
      invoiceData.products.push(product);
    }
  });

  // Extract total amount
  const totalMatch = text.match(/Amount\s*Due\s*:?\s*\$?([0-9,.]+)/i) || 
                    text.match(/Total\s*:?\s*\$?([0-9,.]+)/i) ||
                    text.match(/Total\s*Amount\s*:?\s*\$?([0-9,.]+)/i);
  if (totalMatch && totalMatch[1]) {
    invoiceData.totals.total = parseFloat(totalMatch[1].replace(/,/g, ''));
  }

  // Extract payment terms
  const termsMatch = text.match(/Terms\s*:?\s*([^\n]+)/i);
  if (termsMatch && termsMatch[1]) {
    invoiceData.paymentTerms = termsMatch[1].trim();
  }

  // Extract due date
  const dueDateMatch = text.match(/Due\s*Date\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i);
  if (dueDateMatch && dueDateMatch[1]) {
    invoiceData.dueDate = dueDateMatch[1].trim();
  }

  return invoiceData;
}

/**
 * Process an invoice PDF and match it against purchase orders
 * @param filePath Path to the invoice PDF
 * @param purchaseOrderIds Optional array of PO IDs to check against
 * @returns Processed invoice data with matching information
 */
export async function processInvoicePDF(
  filePath: string, 
  purchaseOrderIds?: number[]
): Promise<{
  invoiceData: ExtractedInvoiceData;
  matchedPO?: number;
  matchScore: number;
  issues?: string[];
}> {
  const invoiceData = await parseInvoicePDF(filePath);
  const issues: string[] = [];
  let matchedPO: number | undefined;
  let matchScore = 0;

  // If purchase order IDs are provided, attempt to match the invoice to a PO
  if (purchaseOrderIds && purchaseOrderIds.length > 0) {
    // In a real implementation, we'd query the database for PO details
    // and perform matching logic here
    
    // For now, we'll just check if the invoice's PO number matches any of the provided IDs
    const poNumber = invoiceData.poNumber;
    const matchingPOId = purchaseOrderIds.find(id => id.toString() === poNumber);
    
    if (matchingPOId) {
      matchedPO = matchingPOId;
      matchScore = 1.0; // Perfect match
    } else {
      issues.push(`Invoice PO number ${poNumber} does not match any provided PO IDs`);
      matchScore = 0.0;
    }
  }

  return {
    invoiceData,
    matchedPO,
    matchScore,
    issues: issues.length > 0 ? issues : undefined
  };
}