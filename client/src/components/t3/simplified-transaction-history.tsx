import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, ArrowLeftRight, Building } from "lucide-react";

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

interface SimplifiedTransactionHistoryProps {
  history: TransactionHistoryRecord[];
}

export function SimplifiedTransactionHistory({ history }: SimplifiedTransactionHistoryProps) {
  if (!history || history.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Transaction History</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
              <Building className="h-10 w-10 mb-3 opacity-20" />
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

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Transaction History</h2>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Chain of Ownership
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Reference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((record, index) => (
                <TableRow key={`transaction-${index}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{formatDate(record.transactionDate)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{record.seller.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {record.seller.address.city}, {record.seller.address.state}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{record.buyer.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {record.buyer.address.city}, {record.buyer.address.state}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{record.referenceNumber}</div>
                    {record.poNumber && <div className="text-xs">PO: {record.poNumber}</div>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Physical Shipment Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building className="h-5 w-5" />
            Physical Shipments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>From Location</TableHead>
                <TableHead>To Location</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((record, index) => (
                <TableRow key={`shipment-${index}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{formatDate(record.shipmentDate)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{record.shippedFrom.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {record.shippedFrom.address.street}<br />
                      {record.shippedFrom.address.city}, {record.shippedFrom.address.state} {record.shippedFrom.address.zipCode}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{record.shippedTo.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {record.shippedTo.address.street}<br />
                      {record.shippedTo.address.city}, {record.shippedTo.address.state} {record.shippedTo.address.zipCode}
                    </div>
                  </TableCell>
                  <TableCell>
                    {record.shipmentReference && (
                      <Badge variant="outline" className="mb-1">
                        Ref: {record.shipmentReference}
                      </Badge>
                    )}
                    {record.invoiceId && <div className="text-xs">Invoice: {record.invoiceId}</div>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <div className="bg-muted p-4 rounded-md">
        <p className="text-sm font-medium">DSCSA Compliance Note:</p>
        <p className="text-sm text-muted-foreground mt-1">
          The Drug Supply Chain Security Act (DSCSA) requires that each person who is engaged in the wholesale distribution of a product provide the subsequent owner with transaction history. This ensures complete traceability of the product through the supply chain.
        </p>
      </div>
    </div>
  );
}