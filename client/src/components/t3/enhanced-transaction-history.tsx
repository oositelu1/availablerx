import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { History, Building, ArrowRight, Truck, Calendar, FileText, CircleDot } from "lucide-react";

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

interface TransactionHistoryRecord {
  // Ownership history
  seller: CompanyInfo;
  buyer: CompanyInfo;
  transactionDate: string;
  referenceNumber: string;

  // Physical distribution history
  shippedFrom: CompanyInfo;
  shippedTo: CompanyInfo;
  shipmentDate: string;
  shipmentReference?: string;
  
  // Additional details
  poNumber?: string;
  invoiceId?: string;
  statement?: string;
}

interface EnhancedTransactionHistoryProps {
  history: TransactionHistoryRecord[];
}

export function EnhancedTransactionHistory({ history }: EnhancedTransactionHistoryProps) {
  if (!history || history.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Transaction History</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
              <History className="h-10 w-10 mb-3 opacity-20" />
              <p>No transaction history available</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Format address (compact version)
  const formatAddressCompact = (address: CompanyInfo['address']) => {
    return `${address.city}, ${address.state} ${address.zipCode}`;
  };

  // Format address (full)
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
      <h2 className="text-2xl font-bold">Transaction History</h2>
      
      <Card className="overflow-hidden">
        <CardHeader className="bg-primary/5 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            Chain of Custody
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-8">
            {history.map((record, index) => (
              <div key={`history-${index}`} className="relative pb-8">
                {/* Timeline connector */}
                {index < history.length - 1 && (
                  <div className="absolute left-5 top-12 bottom-0 w-px bg-border"></div>
                )}
                
                <Card className="border-l-4 border-l-primary ml-10">
                  <CardHeader className="bg-primary/5 pb-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Calendar className="h-4 w-4" /> 
                        {formatDate(record.transactionDate)} 
                        {record.shipmentDate !== record.transactionDate && (
                          <span className="text-muted-foreground text-sm">
                            (Shipped: {formatDate(record.shipmentDate)})
                          </span>
                        )}
                      </CardTitle>
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        {record.referenceNumber && (
                          <span className="bg-background px-2 py-1 rounded-md">
                            Ref: {record.referenceNumber}
                          </span>
                        )}
                        {record.poNumber && (
                          <span className="bg-background px-2 py-1 rounded-md">
                            PO: {record.poNumber}
                          </span>
                        )}
                        {record.invoiceId && (
                          <span className="bg-background px-2 py-1 rounded-md">
                            Invoice: {record.invoiceId}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Ownership transfer */}
                      <div className="space-y-4">
                        <h3 className="text-sm uppercase tracking-wider text-muted-foreground font-medium">Ownership Transfer</h3>
                        <div className="flex items-center gap-4">
                          <div className="flex-1 bg-muted/30 p-3 rounded-md border">
                            <div className="font-medium">{record.seller.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatAddressCompact(record.seller.address)}
                            </div>
                          </div>
                          <ArrowRight className="flex-shrink-0 h-5 w-5 text-muted-foreground" />
                          <div className="flex-1 bg-muted/30 p-3 rounded-md border">
                            <div className="font-medium">{record.buyer.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatAddressCompact(record.buyer.address)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Physical shipment */}
                      <div className="space-y-4">
                        <h3 className="text-sm uppercase tracking-wider text-muted-foreground font-medium">Physical Distribution</h3>
                        <div className="flex items-center gap-4">
                          <div className="flex-1 bg-muted/30 p-3 rounded-md border">
                            <div className="font-medium">{record.shippedFrom.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatAddressCompact(record.shippedFrom.address)}
                            </div>
                          </div>
                          <Truck className="flex-shrink-0 h-5 w-5 text-muted-foreground" />
                          <div className="flex-1 bg-muted/30 p-3 rounded-md border">
                            <div className="font-medium">{record.shippedTo.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatAddressCompact(record.shippedTo.address)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {record.statement && (
                      <div className="mt-6 pt-4 border-t">
                        <div className="flex items-start gap-2">
                          <FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          <div className="text-sm">
                            <strong>Statement:</strong> {record.statement}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                {/* Timeline dot */}
                <div className="absolute left-5 top-6 transform -translate-x-1/2 h-10 w-10 rounded-full bg-background border-2 border-primary flex items-center justify-center z-10">
                  <History className="h-5 w-5 text-primary" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}