import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Package, Calendar, Barcode, Info, Building, ArrowRightLeft } from "lucide-react";

interface EnhancedProductInfo {
  productName: string;
  gtin?: string;
  ndc: string;
  lotNumber: string;
  expirationDate: string;
  quantity: number;
  manufacturer?: string;
  genericName?: string;
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
  product: EnhancedProductInfo;
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
      <div className="flex flex-col lg:flex-row justify-between gap-4">
        <h2 className="text-2xl font-bold">Transaction Information</h2>
        <div className="text-sm text-right">
          <div className="font-semibold">Transaction #{transaction.transactionId}</div>
          <div>Reference: {transaction.referenceNumber}</div>
          {transaction.poNumber && <div>PO: {transaction.poNumber}</div>}
          {transaction.invoiceId && <div>Invoice: {transaction.invoiceId}</div>}
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="bg-primary/5 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Product Details
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-y-6 gap-x-4">
            <div className="space-y-1 md:col-span-3">
              <div className="text-sm font-medium text-muted-foreground">Product Name</div>
              <div className="text-lg font-semibold">{product.productName}</div>
              {product.genericName && (
                <div className="text-sm text-muted-foreground">Generic: {product.genericName}</div>
              )}
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground">NDC</div>
              <div className="font-medium">{product.ndc}</div>
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground">Lot Number</div>
              <div className="font-medium">{product.lotNumber}</div>
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground">Expiration Date</div>
              <div className="font-medium">{formatDate(product.expirationDate)}</div>
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground">Quantity</div>
              <div className="font-medium">{product.quantity}</div>
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground">Manufacturer</div>
              <div className="font-medium">{product.manufacturer || "N/A"}</div>
            </div>

            {product.gtin && (
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">GTIN</div>
                <div className="font-medium font-mono text-sm">{product.gtin}</div>
              </div>
            )}

            {product.strength && (
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Strength</div>
                <div className="font-medium">{product.strength}</div>
              </div>
            )}

            {product.dosageForm && (
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Dosage Form</div>
                <div className="font-medium">{product.dosageForm}</div>
              </div>
            )}

            {product.containerSize && (
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Container Size</div>
                <div className="font-medium">{product.containerSize}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="bg-primary/5 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Transaction Details
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex flex-col">
                <div className="text-sm font-medium text-muted-foreground mb-1">Sender</div>
                <div className="font-semibold">{sender.name}</div>
                <div className="text-sm mt-1">
                  {formatAddress(sender.address)}
                </div>
                {sender.contactInfo && (
                  <div className="text-sm mt-2">
                    {sender.contactInfo.phone && <div>{sender.contactInfo.phone}</div>}
                    {sender.contactInfo.email && <div>{sender.contactInfo.email}</div>}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col">
                <div className="text-sm font-medium text-muted-foreground mb-1">Receiver</div>
                <div className="font-semibold">{receiver.name}</div>
                <div className="text-sm mt-1">
                  {formatAddress(receiver.address)}
                </div>
                {receiver.contactInfo && (
                  <div className="text-sm mt-2">
                    {receiver.contactInfo.phone && <div>{receiver.contactInfo.phone}</div>}
                    {receiver.contactInfo.email && <div>{receiver.contactInfo.email}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="flex flex-wrap gap-8">
            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground">Shipment Date</div>
              <div className="font-medium">{formatDate(transaction.shipmentDate)}</div>
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground">Reference Number</div>
              <div className="font-medium">{transaction.referenceNumber}</div>
            </div>

            {transaction.poNumber && (
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">PO Number</div>
                <div className="font-medium">{transaction.poNumber}</div>
              </div>
            )}

            {transaction.invoiceId && (
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Invoice ID</div>
                <div className="font-medium">{transaction.invoiceId}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}