/**
 * This file tests invoice processing with structured data
 */

// Data provided in a structured format
const source1 = {"Date": "04/30/2025", "Invoice#": "626000800"};
const source6 = {
    "Sales Order No": "263210018",
    "Customer PO No": "43121",
    "Terms": "2 Net 30,31Days",
    "Due Date": "31-May-2025",
    "Date Shipped": "30-Apr-2025",
    "Carrier": "UPS",
    "Tracking No.": "1Z6R411A0377664551",
};
const source7 = {
    "PRODUCT DESCRIPTION": "55150018810",
    "CUSTOMER ITEM": "",
    "LOT NUMBER": "3TA25004A",
    "EXPIRY DATE": "29-FEB-28",
    "INVOICE QTY": "48",
    "UOM": "EA",
    "UNIT PRICE": "23.790",
    "AMOUNT": "1,141.92",
};
const source11 = {
    "Line Totals": "$1,141.92",
    "Freight": null, // Or some value if provided
    "Discount": "$0.00",
    "Total Tax": null, // Or some value if provided
    "Amount Due": "$1,141.92",
};

// Additional vendor/customer info for proper processing
const vendorInfo = {
    "name": "Eugia US LLC (f/k/a AuroMedics Pharma LLC)",
    "address": "279 Princeton-Hightstown Road, Suite 214, East Windsor, NJ 08520-1401",
    "licenseNumber": "1000855",
    "licenseExpiry": "12/26/2025"
};

const customerInfo = {
    "name": "LONE STAR PHARMACEUTICALS, INC.",
    "address": "11951 HILLTOP ROAD, SUITE 18, ARGYLE, TX 76226, US",
    "licenseNumber": "1001790",
    "licenseExpiry": "09/28/2025"
};

// Extraction
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

// Create structured invoice data
const invoiceData = {
    invoiceNumber: invoice_number,
    invoiceDate: invoice_date,
    poNumber: po_number,
    vendor: vendorInfo,
    customer: customerInfo,
    shipment: {
        dateShipped: source6["Date Shipped"],
        carrier: source6["Carrier"],
        trackingNumber: source6["Tracking No."]
    },
    products: [
        {
            description: "Tranexamic Acid Injection SDV 1000mg/10mL - 10s",
            ndc: ndc,
            lotNumber: lot_number,
            expiryDate: expiration_date,
            quantity: quantity,
            unitPrice: parseFloat(unit_price),
            totalPrice: parseFloat(item_amount)
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

// Print extracted data
console.log("===== EXTRACTED INVOICE DATA =====");
console.log(JSON.stringify(invoiceData, null, 2));
console.log("\n===== VALIDATION =====");
console.log(`Invoice Number: ${invoice_number}`);
console.log(`Invoice Date: ${invoice_date}`);
console.log(`PO Number: ${po_number}`);
console.log("Pricing:");
console.log(`  Unit Price: $${unit_price}`);
console.log(`  Item Amount: $${item_amount}`);
console.log(`  Line Totals: ${line_totals}`);
console.log(`  Amount Due: ${amount_due}`);
console.log(`NDC: ${ndc}`);
console.log(`Lot Number: ${lot_number}`);
console.log(`Expiration Date: ${expiration_date}`);
console.log(`Quantity: ${quantity}`);

// Export for use in other modules
export const sampleInvoiceData = invoiceData;