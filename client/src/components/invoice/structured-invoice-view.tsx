import { Card, CardContent } from "@/components/ui/card";

// Sample structured data for demonstration
const sampleInvoiceData = {
  invoiceNumber: "626000800",
  invoiceDate: "04/30/2025",
  poNumber: "43121",
  vendor: {
    name: "Eugia US LLC (f/k/a AuroMedics Pharma LLC)",
    address: "279 Princeton-Hightstown Road, Suite 214, East Windsor, NJ 08520-1401",
    licenseNumber: "1000855",
    licenseExpiry: "12/26/2025"
  },
  customer: {
    name: "LONE STAR PHARMACEUTICALS, INC.",
    address: "11951 HILLTOP ROAD, SUITE 18, ARGYLE, TX 76226, US",
    licenseNumber: "1001790",
    licenseExpiry: "09/28/2025"
  },
  shipment: {
    dateShipped: "30-Apr-2025",
    carrier: "UPS",
    trackingNumber: "1Z6R411A0377664551"
  },
  products: [
    {
      description: "Tranexamic Acid Injection SDV 1000mg/10mL - 10s",
      ndc: "55150018810",
      lotNumber: "3TA25004A",
      expiryDate: "29-FEB-28",
      quantity: 48,
      unitPrice: 23.79,
      totalPrice: 1141.92
    }
  ],
  totals: {
    subtotal: 1141.92,
    discount: 0,
    total: 1141.92
  },
  paymentTerms: "2 Net 30,31Days",
  dueDate: "31-May-2025"
};

export interface StructuredInvoiceData {
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
  shipment?: {
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

interface StructuredInvoiceViewProps {
  data?: StructuredInvoiceData;
  showSampleData?: boolean;
}

export function StructuredInvoiceView({ data, showSampleData = false }: StructuredInvoiceViewProps) {
  // Use provided data or sample data
  const invoiceData = data || (showSampleData ? sampleInvoiceData : null);
  
  if (!invoiceData) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No invoice data available. Upload an invoice to view extracted information.</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold mb-1">Invoice Details</h3>
          <div className="bg-muted/40 p-3 rounded-md">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <p className="text-xs text-muted-foreground">Invoice Number</p>
                <p className="font-medium">{invoiceData.invoiceNumber}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Invoice Date</p>
                <p className="font-medium">{invoiceData.invoiceDate}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">PO Number</p>
                <p className="font-medium">{invoiceData.poNumber}</p>
              </div>
              {invoiceData.dueDate && (
                <div>
                  <p className="text-xs text-muted-foreground">Due Date</p>
                  <p className="font-medium">{invoiceData.dueDate}</p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div>
          <h3 className="text-sm font-semibold mb-1">Totals</h3>
          <div className="bg-muted/40 p-3 rounded-md">
            <div className="space-y-1">
              <div className="flex justify-between">
                <p className="text-sm">Subtotal:</p>
                <p className="font-medium">${invoiceData.totals.subtotal.toFixed(2)}</p>
              </div>
              {invoiceData.totals.tax !== undefined && (
                <div className="flex justify-between">
                  <p className="text-sm">Tax:</p>
                  <p className="font-medium">${invoiceData.totals.tax.toFixed(2)}</p>
                </div>
              )}
              {invoiceData.totals.shipping !== undefined && (
                <div className="flex justify-between">
                  <p className="text-sm">Shipping:</p>
                  <p className="font-medium">${invoiceData.totals.shipping.toFixed(2)}</p>
                </div>
              )}
              {invoiceData.totals.discount !== undefined && invoiceData.totals.discount > 0 && (
                <div className="flex justify-between">
                  <p className="text-sm">Discount:</p>
                  <p className="font-medium text-green-600">-${invoiceData.totals.discount.toFixed(2)}</p>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t mt-2">
                <p className="text-sm font-bold">Total:</p>
                <p className="font-bold">${invoiceData.totals.total.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold mb-1">Vendor</h3>
          <Card>
            <CardContent className="p-3">
              <p className="font-medium">{invoiceData.vendor.name}</p>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{invoiceData.vendor.address}</p>
              {invoiceData.vendor.licenseNumber && (
                <div className="mt-2 text-sm">
                  <span className="text-muted-foreground">License:</span> {invoiceData.vendor.licenseNumber}
                  {invoiceData.vendor.licenseExpiry && (
                    <span> (Expires: {invoiceData.vendor.licenseExpiry})</span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        <div>
          <h3 className="text-sm font-semibold mb-1">Customer</h3>
          <Card>
            <CardContent className="p-3">
              <p className="font-medium">{invoiceData.customer.name}</p>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{invoiceData.customer.address}</p>
              {invoiceData.customer.licenseNumber && (
                <div className="mt-2 text-sm">
                  <span className="text-muted-foreground">License:</span> {invoiceData.customer.licenseNumber}
                  {invoiceData.customer.licenseExpiry && (
                    <span> (Expires: {invoiceData.customer.licenseExpiry})</span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      {invoiceData.shipment && Object.keys(invoiceData.shipment).some(key => !!invoiceData.shipment?.[key as keyof typeof invoiceData.shipment]) && (
        <div>
          <h3 className="text-sm font-semibold mb-1">Shipment Information</h3>
          <div className="bg-muted/40 p-3 rounded-md">
            <div className="grid grid-cols-3 gap-4">
              {invoiceData.shipment.dateShipped && (
                <div>
                  <p className="text-xs text-muted-foreground">Date Shipped</p>
                  <p className="font-medium">{invoiceData.shipment.dateShipped}</p>
                </div>
              )}
              {invoiceData.shipment.carrier && (
                <div>
                  <p className="text-xs text-muted-foreground">Carrier</p>
                  <p className="font-medium">{invoiceData.shipment.carrier}</p>
                </div>
              )}
              {invoiceData.shipment.trackingNumber && (
                <div>
                  <p className="text-xs text-muted-foreground">Tracking Number</p>
                  <p className="font-medium">{invoiceData.shipment.trackingNumber}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      <div>
        <h3 className="text-sm font-semibold mb-1">Products</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-muted/60">
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Description</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">NDC</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Lot Number</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Expiry Date</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Quantity</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Unit Price</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoiceData.products.map((product, index) => (
                <tr key={index} className="hover:bg-muted/30">
                  <td className="px-4 py-2 text-sm">{product.description}</td>
                  <td className="px-4 py-2 text-sm">{product.ndc || '-'}</td>
                  <td className="px-4 py-2 text-sm">{product.lotNumber}</td>
                  <td className="px-4 py-2 text-sm">{product.expiryDate}</td>
                  <td className="px-4 py-2 text-sm text-right">{product.quantity}</td>
                  <td className="px-4 py-2 text-sm text-right">${product.unitPrice.toFixed(2)}</td>
                  <td className="px-4 py-2 text-sm font-medium text-right">${product.totalPrice.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {invoiceData.paymentTerms && (
        <div className="text-sm">
          <span className="text-muted-foreground font-medium">Payment Terms:</span> {invoiceData.paymentTerms}
        </div>
      )}
    </div>
  );
}