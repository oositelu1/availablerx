import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  Package, Building, User, Calendar, ShoppingCart, 
  Hash, Barcode, FileSpreadsheet, Pill, FlaskConical
} from "lucide-react";

interface ProductInfo {
  productName: string;
  ndc: string;
  gtin?: string;
  lotNumber: string;
  expirationDate: string;
  quantity: number;
  manufacturer?: string;
  strength?: string;
  dosageForm?: string;
  containerSize?: string;
}

interface CompanyInfo {
  name: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  contactInfo?: {
    phone?: string;
    email?: string;
  };
}

interface TransactionDetails {
  transactionId: string;
  shipmentDate: string;
  referenceNumber: string;
  poNumber?: string;
  invoiceId?: string;
}

interface EnhancedTransactionInfoProps {
  product: ProductInfo;
  sender: CompanyInfo;
  receiver: CompanyInfo;
  transaction: TransactionDetails;
}

export function EnhancedTransactionInfo({ 
  product, 
  sender, 
  receiver, 
  transaction 
}: EnhancedTransactionInfoProps) {
  
  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Format address
  const formatAddress = (address: CompanyInfo['address']) => {
    return (
      <>
        <div>{address.street}</div>
        <div>{address.city}, {address.state} {address.zipCode}</div>
        <div>{address.country}</div>
      </>
    );
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Transaction Information</h2>
      
      {/* Product Information */}
      <Card>
        <CardHeader className="bg-primary/5 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Product Details
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-lg mb-3">{product.productName}</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <FlaskConical className="h-4 w-4 mt-1 text-muted-foreground" /> 
                  <div>
                    <span className="text-muted-foreground">Manufacturer:</span> {product.manufacturer || "N/A"}
                  </div>
                </div>
                {product.strength && (
                  <div className="flex items-start gap-2">
                    <Pill className="h-4 w-4 mt-1 text-muted-foreground" /> 
                    <div>
                      <span className="text-muted-foreground">Strength:</span> {product.strength}
                    </div>
                  </div>
                )}
                {product.dosageForm && (
                  <div className="flex items-start gap-2">
                    <Package className="h-4 w-4 mt-1 text-muted-foreground" /> 
                    <div>
                      <span className="text-muted-foreground">Dosage Form:</span> {product.dosageForm}
                    </div>
                  </div>
                )}
                {product.containerSize && (
                  <div className="flex items-start gap-2">
                    <Package className="h-4 w-4 mt-1 text-muted-foreground" /> 
                    <div>
                      <span className="text-muted-foreground">Container Size:</span> {product.containerSize}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 border rounded-md">
                  <div className="text-xs text-muted-foreground">NDC</div>
                  <div className="font-medium">{product.ndc}</div>
                </div>
                <div className="p-3 border rounded-md">
                  <div className="text-xs text-muted-foreground">GTIN</div>
                  <div className="font-medium">{product.gtin || "N/A"}</div>
                </div>
                <div className="p-3 border rounded-md">
                  <div className="text-xs text-muted-foreground">Lot Number</div>
                  <div className="font-medium">{product.lotNumber}</div>
                </div>
                <div className="p-3 border rounded-md">
                  <div className="text-xs text-muted-foreground">Expiration Date</div>
                  <div className="font-medium">{formatDate(product.expirationDate)}</div>
                </div>
              </div>
              <div className="p-3 border rounded-md">
                <div className="text-xs text-muted-foreground">Quantity</div>
                <div className="font-medium">{product.quantity} unit(s)</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Transaction Details */}
      <Card>
        <CardHeader className="bg-primary/5 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Transaction Details
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="p-4 border rounded-md">
                <h3 className="font-medium text-sm mb-1 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Transaction Information
                </h3>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Transaction ID</div>
                    <div>{transaction.transactionId}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Shipment Date</div>
                    <div>{formatDate(transaction.shipmentDate)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Reference Number</div>
                    <div>{transaction.referenceNumber}</div>
                  </div>
                  {transaction.poNumber && (
                    <div>
                      <div className="text-xs text-muted-foreground">PO Number</div>
                      <div>{transaction.poNumber}</div>
                    </div>
                  )}
                  {transaction.invoiceId && (
                    <div>
                      <div className="text-xs text-muted-foreground">Invoice ID</div>
                      <div>{transaction.invoiceId}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="p-4 border rounded-md">
                <h3 className="font-medium text-sm mb-1 flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Sender
                </h3>
                <div className="mt-2">
                  <div className="font-medium">{sender.name}</div>
                  <div className="text-sm mt-1 text-muted-foreground">
                    {formatAddress(sender.address)}
                  </div>
                  {sender.contactInfo && (
                    <div className="mt-2 text-sm">
                      {sender.contactInfo.phone && <div>Phone: {sender.contactInfo.phone}</div>}
                      {sender.contactInfo.email && <div>Email: {sender.contactInfo.email}</div>}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 border rounded-md">
                <h3 className="font-medium text-sm mb-1 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Receiver
                </h3>
                <div className="mt-2">
                  <div className="font-medium">{receiver.name}</div>
                  <div className="text-sm mt-1 text-muted-foreground">
                    {formatAddress(receiver.address)}
                  </div>
                  {receiver.contactInfo && (
                    <div className="mt-2 text-sm">
                      {receiver.contactInfo.phone && <div>Phone: {receiver.contactInfo.phone}</div>}
                      {receiver.contactInfo.email && <div>Email: {receiver.contactInfo.email}</div>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}