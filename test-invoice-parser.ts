import { parseInvoicePDF, processInvoicePDF } from './server/invoice-parser';
import fs from 'fs/promises';
import path from 'path';

async function testInvoiceParser() {
  try {
    console.log('Starting invoice parser test...');
    
    // Path to the sample invoice PDF
    const sampleInvoicePath = path.join(__dirname, 'attached_assets', 'PO 43121 - INV 626000800.pdf');
    
    // Check if file exists
    try {
      await fs.access(sampleInvoicePath);
      console.log('Sample invoice found at:', sampleInvoicePath);
    } catch (err) {
      console.error('Sample invoice not found at:', sampleInvoicePath);
      return;
    }
    
    console.log('Parsing invoice...');
    const invoiceData = await parseInvoicePDF(sampleInvoicePath);
    console.log('Extracted invoice data:');
    console.log(JSON.stringify(invoiceData, null, 2));
    
    console.log('\nProcessing invoice with PO matching...');
    // Test with a matching PO number (43121 from the filename)
    const processResult = await processInvoicePDF(sampleInvoicePath, [43121]);
    console.log('Process result:');
    console.log(JSON.stringify(processResult, null, 2));
    
    console.log('Invoice parser test completed.');
  } catch (error) {
    console.error('Error in invoice parser test:', error);
  }
}

// Run the test
testInvoiceParser();