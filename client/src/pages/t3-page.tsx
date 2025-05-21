import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useParams, Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, CheckCircle, ArrowLeftRight, Truck, Clock, XCircle } from 'lucide-react';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { TransactionInfoDisplay } from '@/components/t3/transaction-info-display';
import { TransactionHistoryDisplay } from '@/components/t3/transaction-history-display';
import { TransactionStatementDisplay } from '@/components/t3/transaction-statement-display';

// Main T3 bundle details page
export default function T3Page() {
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
    window.open(`/api/t3/download/${bundleId}`, '_blank');
    
    toast({
      title: 'Downloading T3 Document',
      description: 'Your file is being downloaded.',
    });
  };

  // Display loading state
  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  // Display error state
  if (error || !bundle) {
    return (
      <div className="container mx-auto py-6 space-y-8">
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <XCircle className="h-12 w-12 text-destructive" />
          <h3 className="text-lg font-medium">Failed to load T3 document</h3>
          <p className="text-muted-foreground">
            {error instanceof Error ? error.message : 'An unknown error occurred'}
          </p>
          <Button asChild variant="outline">
            <Link href="/t3">Back to T3 Documents</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Format dates for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Get delivery status badge color
  const getStatusColor = (status?: string) => {
    if (!status) return 'bg-gray-100 text-gray-800';
    
    switch (status.toLowerCase()) {
      case 'sent':
        return 'bg-blue-100 text-blue-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-8">
      {/* Breadcrumb navigation */}
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
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">T3 Document</h1>
          <p className="text-muted-foreground">
            Review Transaction Information, History, and Statement
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleDownload} className="gap-2">
            <Download className="h-4 w-4" />
            Download {bundle.format?.toUpperCase()}
          </Button>
        </div>
      </div>
      
      {/* T3 Bundle details card */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {bundle.bundleId}
              </CardTitle>
              <CardDescription>
                Generated on {formatDate(bundle.generatedAt)}
              </CardDescription>
            </div>
            <Badge className={getStatusColor(bundle.deliveryStatus)}>
              {bundle.deliveryStatus?.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <p className="text-sm font-medium">Delivery Method</p>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Truck className="h-4 w-4" />
                {bundle.deliveryMethod === 'as2' ? 'AS2 Transfer' : 
                 bundle.deliveryMethod === 'https' ? 'HTTPS API' : 'Pre-signed URL'}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Partner</p>
              <p className="text-sm text-muted-foreground">
                {bundle.partnerName || 'Not specified'}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Format</p>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {bundle.format?.toUpperCase() || 'XML'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* T3 Content tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ti">Transaction Information</TabsTrigger>
          <TabsTrigger value="th">Transaction History</TabsTrigger>
          <TabsTrigger value="ts">Transaction Statement</TabsTrigger>
        </TabsList>
        
        <TabsContent value="ti" className="mt-6">
          <TransactionInfoDisplay transactionInfo={bundle.transactionInformation} />
        </TabsContent>
        
        <TabsContent value="th" className="mt-6">
          <TransactionHistoryDisplay history={bundle.transactionHistory} />
        </TabsContent>
        
        <TabsContent value="ts" className="mt-6">
          <TransactionStatementDisplay statement={bundle.transactionStatement} />
        </TabsContent>
      </Tabs>
    </div>
  );
}