import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useParams, Link } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, ArrowLeft, Printer } from 'lucide-react';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { EnhancedTransactionInfo } from '@/components/t3/enhanced-transaction-info';
import { SimplifiedTransactionHistory } from '@/components/t3/simplified-transaction-history';
import { EnhancedTransactionStatement } from '@/components/t3/enhanced-transaction-statement';
import { Layout } from '@/components/layout/layout';

export default function EnhancedT3Page() {
  const { bundleId } = useParams();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('ti');

  // Fetch T3 bundle details
  const { data: bundle, isLoading, error } = useQuery<any>({
    queryKey: ['/api/t3/bundles', bundleId],
    enabled: !!bundleId
  });

  // Handle downloading the T3 document
  const handleDownload = () => {
    if (!bundleId) return;
    
    // Direct browser to download endpoint
    window.open(`/api/t3/enhanced-download/${bundleId}`, '_blank');
    
    toast({
      title: 'Downloading T3 Document',
      description: 'Your file is being downloaded.',
    });
  };

  // Handle printing the T3 document
  const handlePrint = () => {
    window.print();
  };

  // Display loading state
  if (isLoading) {
    return (
      <Layout title="T3 Document Details">
        <div className="container mx-auto py-6 space-y-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </Layout>
    );
  }

  // Display error state
  if (error || !bundle) {
    return (
      <Layout title="T3 Document Error">
        <div className="container mx-auto py-6 space-y-8">
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <div className="h-12 w-12 rounded-full flex items-center justify-center bg-destructive/10 text-destructive">
              <FileText className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-medium">Failed to load T3 document</h3>
            <p className="text-muted-foreground">
              {error instanceof Error ? error.message : 'An unknown error occurred'}
            </p>
            <Button asChild variant="outline">
              <Link href="/t3">Back to T3 Documents</Link>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  // Transform the data for our enhanced components
  const transformData = () => {
    // Get product information
    const productInfo = {
      productName: bundle.transactionInformation?.productName || "Unknown Product",
      ndc: bundle.transactionInformation?.ndc || "Unknown NDC",
      gtin: bundle.transactionInformation?.gtin,
      lotNumber: bundle.transactionInformation?.lotNumber || "Unknown Lot",
      expirationDate: bundle.transactionInformation?.expirationDate || new Date().toISOString(),
      quantity: bundle.transactionInformation?.quantity || 1,
      manufacturer: bundle.transactionInformation?.manufacturer || "Unknown Manufacturer",
      // These could be added from real data in the future
      strength: "100mg",
      dosageForm: "Vial",
      containerSize: "10ml"
    };

    // Sample sender info (would come from real data)
    const sender = {
      name: "Your Facility",
      address: {
        street: "123 Commerce Avenue",
        city: "Metropolis",
        state: "NY",
        zipCode: "10001",
        country: "United States"
      },
      contactInfo: {
        phone: "(555) 123-4567",
        email: "info@yourfacility.com"
      }
    };

    // Sample receiver info (would come from real data)
    const receiver = {
      name: bundle.partnerName || "Trading Partner",
      address: {
        street: "456 Distribution Road",
        city: "Centerville",
        state: "PA",
        zipCode: "19001",
        country: "United States"
      },
      contactInfo: {
        phone: "(555) 987-6543",
        email: "receiving@tradingpartner.com"
      }
    };

    // Transaction details
    const transaction = {
      transactionId: bundle.bundleId || "T3-unknown",
      shipmentDate: bundle.generatedAt || new Date().toISOString(),
      referenceNumber: `REF-${Math.floor(Math.random() * 100000)}`,
      poNumber: `PO-${Math.floor(Math.random() * 10000)}`,
      invoiceId: `INV-${Math.floor(Math.random() * 10000)}`
    };

    // Sample transaction history (would be built from real data)
    const history = [
      {
        seller: {
          name: "Manufacturer Inc.",
          address: {
            street: "789 Manufacturing Blvd",
            city: "Industry City",
            state: "CA",
            zipCode: "90001",
            country: "United States"
          }
        },
        buyer: {
          name: "Regional Distributor LLC",
          address: {
            street: "101 Distribution Parkway",
            city: "Logistics",
            state: "TX",
            zipCode: "75001",
            country: "United States"
          }
        },
        transactionDate: "2025-01-15T10:00:00Z",
        referenceNumber: "MFG-98765",
        shippedFrom: {
          name: "Manufacturer Inc. - Plant 3",
          address: {
            street: "789 Manufacturing Blvd",
            city: "Industry City",
            state: "CA",
            zipCode: "90001",
            country: "United States"
          }
        },
        shippedTo: {
          name: "Regional Distributor LLC - Warehouse 7",
          address: {
            street: "101 Distribution Parkway",
            city: "Logistics",
            state: "TX",
            zipCode: "75001",
            country: "United States"
          }
        },
        shipmentDate: "2025-01-16T09:30:00Z",
        poNumber: "PO-12345",
        invoiceId: "INV-54321",
        statement: "Manufacturer Inc. has complied with each applicable subsection of FDCA Sec. 581 (27) (A)-(G)."
      },
      {
        seller: {
          name: "Regional Distributor LLC",
          address: {
            street: "101 Distribution Parkway",
            city: "Logistics",
            state: "TX",
            zipCode: "75001",
            country: "United States"
          }
        },
        buyer: {
          name: "Your Facility",
          address: {
            street: "123 Commerce Avenue",
            city: "Metropolis",
            state: "NY",
            zipCode: "10001",
            country: "United States"
          }
        },
        transactionDate: "2025-03-10T14:00:00Z",
        referenceNumber: "DIST-45678",
        shippedFrom: {
          name: "Regional Distributor LLC - Warehouse 7",
          address: {
            street: "101 Distribution Parkway",
            city: "Logistics",
            state: "TX",
            zipCode: "75001",
            country: "United States"
          }
        },
        shippedTo: {
          name: "Your Facility",
          address: {
            street: "123 Commerce Avenue",
            city: "Metropolis",
            state: "NY",
            zipCode: "10001",
            country: "United States"
          }
        },
        shipmentDate: "2025-03-11T08:15:00Z",
        poNumber: "PO-67890",
        invoiceId: "INV-09876",
        statement: "Regional Distributor LLC has complied with each applicable subsection of FDCA Sec. 581 (27) (A)-(G)."
      },
      {
        seller: {
          name: "Your Facility",
          address: {
            street: "123 Commerce Avenue",
            city: "Metropolis",
            state: "NY", 
            zipCode: "10001",
            country: "United States"
          }
        },
        buyer: receiver,
        transactionDate: new Date().toISOString(),
        referenceNumber: transaction.referenceNumber,
        shippedFrom: {
          name: "Your Facility",
          address: {
            street: "123 Commerce Avenue",
            city: "Metropolis",
            state: "NY",
            zipCode: "10001",
            country: "United States"
          }
        },
        shippedTo: receiver,
        shipmentDate: new Date().toISOString(),
        poNumber: transaction.poNumber,
        invoiceId: transaction.invoiceId,
        statement: "Your Facility has complied with each applicable subsection of FDCA Sec. 581 (27) (A)-(G)."
      }
    ];

    // Transaction statement
    const statement = "Your Facility has complied with each applicable subsection of FDCA Sec. 581 (27) (A)-(G).";
    
    return {
      productInfo,
      sender,
      receiver,
      transaction,
      history,
      statement
    };
  };

  const data = transformData();

  return (
    <Layout title="Enhanced T3 Document">
      <div className="container mx-auto py-6 space-y-8 print:py-2">
        {/* Breadcrumb navigation - hidden when printing */}
        <div className="print:hidden">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Home</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/t3">T3 Documents</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{bundle.bundleId}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        
        {/* Header section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="h-8 w-8 text-primary" />
              T3 Document
            </h1>
            <p className="text-muted-foreground">
              Transaction Information, History, and Statement for <span className="font-medium">{data.productInfo.productName}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild className="gap-2">
              <Link href="/t3">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
            </Button>
            <Button variant="outline" onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button onClick={handleDownload} className="gap-2">
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
        </div>

        {/* Document Title and Meta - visible when printing */}
        <div className="hidden print:block border-b pb-4 mb-8">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Transaction Information, History, and Statement (T3)</h1>
            <div>
              <Badge variant="outline" className="text-base font-normal">
                Document #{bundle.bundleId}
              </Badge>
            </div>
          </div>
          <div className="flex justify-between mt-2 text-sm text-muted-foreground">
            <div>Generated on {new Date(bundle.generatedAt).toLocaleDateString()}</div>
            <div>Format: {bundle.format?.toUpperCase() || 'XML'}</div>
          </div>
        </div>
        
        {/* T3 Content tabs */}
        <div className="print:hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="ti">Transaction Information</TabsTrigger>
              <TabsTrigger value="th">Transaction History</TabsTrigger>
              <TabsTrigger value="ts">Transaction Statement</TabsTrigger>
            </TabsList>
            
            <TabsContent value="ti" className="mt-6">
              <EnhancedTransactionInfo 
                product={data.productInfo}
                sender={data.sender}
                receiver={data.receiver}
                transaction={data.transaction}
              />
            </TabsContent>
            
            <TabsContent value="th" className="mt-6">
              <SimplifiedTransactionHistory history={data.history} />
            </TabsContent>
            
            <TabsContent value="ts" className="mt-6">
              <EnhancedTransactionStatement 
                company={data.sender}
                statement={data.statement}
                transactionDate={data.transaction.shipmentDate}
                signature="John Smith, Compliance Officer"
                additionalStatements={[
                  "This product was received from an authorized trading partner and was handled in compliance with all applicable regulations.",
                  "All transaction information and history has been accurately recorded and maintained."
                ]}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Print view - shows all sections together */}
        <div className="hidden print:block space-y-10">
          <EnhancedTransactionInfo 
            product={data.productInfo}
            sender={data.sender}
            receiver={data.receiver}
            transaction={data.transaction}
          />
          
          <EnhancedTransactionHistory history={data.history} />
          
          <EnhancedTransactionStatement 
            company={data.sender}
            statement={data.statement}
            transactionDate={data.transaction.shipmentDate}
            signature="John Smith, Compliance Officer"
            additionalStatements={[
              "This product was received from an authorized trading partner and was handled in compliance with all applicable regulations.",
              "All transaction information and history has been accurately recorded and maintained."
            ]}
          />

          <Card className="mt-8 border-t">
            <CardContent className="pt-6">
              <div className="text-xs text-muted-foreground text-center">
                <p>This document serves as the official Transaction Information, Transaction History, and Transaction Statement as required by DSCSA.</p>
                <p className="mt-1">Generated by EPCIS File Manager on {new Date().toLocaleDateString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}