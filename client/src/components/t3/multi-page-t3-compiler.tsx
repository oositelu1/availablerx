import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { FileText, ChevronDown, ChevronUp, Printer } from 'lucide-react';
import { EnhancedTransactionInfo } from './enhanced-transaction-info';
import { SimplifiedTransactionHistory } from './simplified-transaction-history';
import { EnhancedTransactionStatement } from './enhanced-transaction-statement';
import { DSCSAInfoSection } from './dscsa-info-section';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface T3Page {
  id: string;
  title: string;
  type: 'outbound' | 'internal' | 'supplier';
  data: any;
  source: string;
}

interface MultiPageT3CompilerProps {
  bundle: any;
  outboundT3: any;
  internalT3: any | null;
  supplierT3: any | null;
  onPrint: () => void;
}

export function MultiPageT3Compiler({ 
  bundle,
  outboundT3,
  internalT3,
  supplierT3,
  onPrint
}: MultiPageT3CompilerProps) {
  const [expanded, setExpanded] = useState<{[key: string]: boolean}>({
    'page-1': true,
    'page-2': false, 
    'page-3': false
  });

  // Create page objects
  const pages: T3Page[] = [
    {
      id: 'page-1',
      title: 'Final Outbound T3',
      type: 'outbound',
      data: outboundT3,
      source: 'Generated for Customer'
    }
  ];

  // Add internal T3 if available
  if (internalT3) {
    pages.push({
      id: 'page-2',
      title: 'Internal T3',
      type: 'internal',
      data: internalT3,
      source: 'Generated from SAP'
    });
  }

  // Add supplier T3 if available
  if (supplierT3) {
    pages.push({
      id: 'page-3',
      title: 'Original Supplier T3',
      type: 'supplier',
      data: supplierT3,
      source: 'Received from Supplier'
    });
  }

  const toggleExpand = (pageId: string) => {
    setExpanded(prev => ({
      ...prev,
      [pageId]: !prev[pageId]
    }));
  };

  // Render a single T3 page
  const renderT3Page = (page: T3Page) => {
    return (
      <Card key={page.id} className="mb-6 border border-slate-200">
        <CardHeader className="bg-slate-50 py-4 px-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-primary" />
                <CardTitle className="text-xl">{page.title}</CardTitle>
                <Badge variant={page.type === 'outbound' ? 'default' : 
                              page.type === 'internal' ? 'secondary' : 
                              'outline'}>
                  {page.type === 'outbound' ? 'Outbound' : 
                   page.type === 'internal' ? 'Internal' : 
                   'Supplier'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Source: {page.source}
              </p>
            </div>
            <CollapsibleTrigger 
              onClick={() => toggleExpand(page.id)}
              className="rounded-full p-2 hover:bg-slate-200 transition-colors"
            >
              {expanded[page.id] ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <Collapsible open={expanded[page.id]}>
          <CollapsibleContent>
            <CardContent className="p-6">
              <Tabs defaultValue="ti" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="ti">Transaction Information</TabsTrigger>
                  <TabsTrigger value="th">Transaction History</TabsTrigger>
                  <TabsTrigger value="ts">Transaction Statement</TabsTrigger>
                  <TabsTrigger value="dscsa">DSCSA Reference</TabsTrigger>
                </TabsList>
                <ScrollArea className="h-[500px] rounded-md border p-4">
                  <TabsContent value="ti">
                    <EnhancedTransactionInfo 
                      transaction={page.data.transaction}
                      purchaseOrder={page.data.purchaseOrder}
                      products={page.data.products}
                      sender={page.data.sender}
                      recipient={page.data.recipient}
                    />
                  </TabsContent>
                  
                  <TabsContent value="th">
                    <SimplifiedTransactionHistory history={page.data.history} />
                  </TabsContent>
                  
                  <TabsContent value="ts">
                    <EnhancedTransactionStatement 
                      company={page.data.sender}
                      statement={page.data.statement}
                      transactionDate={page.data.transaction.shipmentDate}
                      signature={page.data.signature || "Authorized Representative"}
                      additionalStatements={page.data.additionalStatements || []}
                    />
                  </TabsContent>
                  
                  <TabsContent value="dscsa">
                    <DSCSAInfoSection />
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Multi-Page T3 Document</h2>
        <Button onClick={onPrint} className="flex items-center gap-2">
          <Printer className="h-4 w-4" />
          Print Complete Document
        </Button>
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
        <h3 className="font-medium text-blue-800">About Multi-Page T3 Documents</h3>
        <p className="text-blue-700 text-sm mt-1">
          This T3 document combines multiple transaction statements throughout the supply chain to provide a complete 
          chain of custody. Page 1 contains the final outbound T3, page 2 contains internal records, and page 3 
          contains the original supplier T3.
        </p>
      </div>
      
      {pages.map(page => renderT3Page(page))}
    </div>
  );
}