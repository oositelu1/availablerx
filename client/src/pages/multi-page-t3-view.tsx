import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useParams, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download } from 'lucide-react';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { MultiPageT3Compiler } from '@/components/t3/multi-page-t3-compiler';
import { Layout } from '@/components/layout/layout';
import { Skeleton } from '@/components/ui/skeleton';

export default function MultiPageT3View() {
  const { bundleId } = useParams();
  const { toast } = useToast();

  // Fetch T3 bundle details
  const { data: bundle, isLoading: isLoadingBundle, error } = useQuery<any>({
    queryKey: ['/api/t3/bundles', bundleId],
    enabled: !!bundleId
  });

  // For demo purposes, we're using the current T3 as the outbound T3
  // In a real implementation, we would fetch the linked internal and supplier T3s
  const outboundT3 = bundle;
  
  // In a real implementation, we would fetch these from the database
  // For now, we'll use sample data for demonstration
  const internalT3 = bundle ? {
    ...bundle,
    transaction: {
      ...bundle.transaction,
      id: 'INT-' + bundle.transaction.id,
      source: 'SAP ERP System',
      transactionDate: new Date(new Date(bundle.transaction.transactionDate).getTime() - 86400000).toISOString() // 1 day earlier
    },
    sender: {
      ...bundle.sender,
      name: 'Internal Distribution Center',
      role: 'Distributor (Internal)'
    }
  } : null;

  const supplierT3 = bundle ? {
    ...bundle,
    transaction: {
      ...bundle.transaction,
      id: 'SUP-' + bundle.transaction.id,
      source: 'Supplier ERP',
      transactionDate: new Date(new Date(bundle.transaction.transactionDate).getTime() - 172800000).toISOString() // 2 days earlier
    },
    sender: {
      name: 'Original Manufacturer Inc.',
      role: 'Manufacturer',
      address: '123 Manufacturing Way, Industrial District, CA 90210',
      license: 'MAN-12345-FDA',
      gln: '0848473005043'
    }
  } : null;

  // Handle downloading the T3 document
  const handleDownload = () => {
    if (!bundleId) return;
    
    // In a real implementation, this would generate and download the complete
    // multi-page T3 document as a PDF
    toast({
      title: "Download Started",
      description: "Your multi-page T3 document is being prepared for download.",
    });
  };

  // Handle printing the T3 document
  const handlePrint = () => {
    window.print();
  };

  if (error) {
    return (
      <Layout>
        <div className="container mx-auto py-6">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            Error loading T3 document: {error.message}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-6">
        {/* Breadcrumb navigation */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/t3">T3 Documents</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbPage>Multi-Page T3 View</BreadcrumbPage>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Back button and actions */}
        <div className="flex justify-between mb-6">
          <Button variant="outline" asChild>
            <Link to="/t3" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to T3 Documents
            </Link>
          </Button>
          
          <Button variant="outline" onClick={handleDownload} className="flex items-center gap-2">
            <Download className="h-4 w-4" /> Download Complete T3
          </Button>
        </div>

        {/* Loading state */}
        {isLoadingBundle && (
          <div className="space-y-4">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}

        {/* Render multi-page T3 compiler when data is available */}
        {bundle && (
          <MultiPageT3Compiler 
            bundle={bundle}
            outboundT3={outboundT3}
            internalT3={internalT3}
            supplierT3={supplierT3}
            onPrint={handlePrint}
          />
        )}
      </div>
    </Layout>
  );
}