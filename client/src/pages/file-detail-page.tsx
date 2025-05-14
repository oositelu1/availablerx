import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link as WouterLink } from "wouter";
import { Layout } from "@/components/layout/layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import ProductValidationDialog from "@/components/product-validation-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { SendFileModal } from "@/components/send-file-modal";
import { PresignedLinks } from "@/components/presigned-links";
import { AssociatePODialog } from "@/components/associate-po-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductInfoDisplay } from "@/components/product-info-display";
import {
  ArrowLeft,
  File,
  Send,
  Download,
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronRight,
  FileArchive,
  RefreshCw,
  Link as LinkIcon,
  FileText,
  Tag,
  Package,
  ArrowRightLeft,
  ChevronDown,
  ShoppingCart,
  QrCode,
  ScanLine,
} from "lucide-react";
import { formatDate, gtinToNDC } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SheetContent, SheetTrigger, Sheet } from "@/components/ui/sheet";

export default function FileDetailPage() {
  const { id: fileId } = useParams();
  const { toast } = useToast();
  const [showSendModal, setShowSendModal] = useState(false);
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [showAssociatePODialog, setShowAssociatePODialog] = useState(false);
  const [expandedBizTransactions, setExpandedBizTransactions] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("details");

  // Fetch file details
  const { data: file, isLoading: isLoadingFile } = useQuery({
    queryKey: [`/api/files/${fileId}`],
    queryFn: async () => {
      const res = await fetch(`/api/files/${fileId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch file");
      }
      return await res.json();
    },
  });

  // Fetch product items for this file
  const { data: productItems, isLoading: isLoadingProductItems } = useQuery({
    queryKey: [`/api/product-items/file/${fileId}`],
    queryFn: async () => {
      const res = await fetch(`/api/product-items/file/${fileId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch product items");
      }
      return await res.json();
    },
  });

  // Fetch PO associations for this file
  const { data: associations, isLoading: isLoadingAssociations } = useQuery({
    queryKey: [`/api/associations/file/${fileId}`],
    queryFn: async () => {
      const res = await fetch(`/api/associations/file/${fileId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch PO associations");
      }
      return await res.json();
    },
  });

  // Download file mutation
  const downloadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/files/${fileId}/download`);
      if (!response.ok) {
        throw new Error("Failed to download file");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `file-${fileId}.xml`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast({
        title: "File downloaded",
        description: "The file has been downloaded successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Download failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDownload = () => {
    downloadMutation.mutate();
  };

  const handleOpenValidationDialog = () => {
    setShowValidationDialog(true);
  };

  const handleAssociateWithPO = () => {
    setShowAssociatePODialog(true);
  };

  const toggleBizTransaction = (id: string) => {
    if (expandedBizTransactions.includes(id)) {
      setExpandedBizTransactions(expandedBizTransactions.filter(i => i !== id));
    } else {
      setExpandedBizTransactions([...expandedBizTransactions, id]);
    }
  };

  if (isLoadingFile) {
    return (
      <Layout>
        <div className="flex items-center space-x-2 mb-6">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        </div>
        <Skeleton className="h-[600px] w-full rounded-md" />
      </Layout>
    );
  }

  if (!file) {
    return (
      <Layout>
        <div className="py-20 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">File Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The requested file could not be found.
          </p>
          <WouterLink href="/files">
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Files
            </Button>
          </WouterLink>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Header area */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1 text-sm breadcrumbs">
            <WouterLink href="/files">
              <span className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                Files
              </span>
            </WouterLink>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">EPCIS Details</span>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            {file.name}
          </h1>
          <p className="text-muted-foreground mt-1">
            Uploaded {formatDate(file.uploadedAt)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            className="flex items-center gap-2"
            onClick={handleDownload}
            disabled={downloadMutation.isPending}
          >
            {downloadMutation.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download XML
          </Button>
          
          {(productItems && productItems.length > 0) && (
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              onClick={handleOpenValidationDialog}
            >
              <ScanLine className="h-4 w-4" />
              Validate Products
            </Button>
          )}
          
          <Button 
            variant="outline" 
            className="flex items-center gap-2"
            onClick={() => setShowSendModal(true)}
          >
            <Send className="h-4 w-4" />
            Send
          </Button>
          
          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={handleAssociateWithPO}
          >
            <ShoppingCart className="h-4 w-4" />
            Associate PO
          </Button>
        </div>
      </div>

      {/* Main content */}
      <Tabs 
        defaultValue="details" 
        className="w-full"
        value={activeTab}
        onValueChange={setActiveTab}
      >
        <TabsList className="mb-4">
          <TabsTrigger value="details">File Details</TabsTrigger>
          <TabsTrigger value="products">Products ({productItems?.length || 0})</TabsTrigger>
          <TabsTrigger value="po-associations">PO Associations ({associations?.length || 0})</TabsTrigger>
          <TabsTrigger value="transmission-history">Transmission History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="details">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* File metadata card */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <File className="h-5 w-5 text-primary" />
                  File Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-sm font-medium">File ID:</div>
                    <div className="text-sm">{file.id}</div>
                    
                    <div className="text-sm font-medium">Status:</div>
                    <div>
                      <Badge variant={file.validationStatus === "VALID" ? "success" : "destructive"}>
                        {file.validationStatus}
                      </Badge>
                    </div>
                    
                    <div className="text-sm font-medium">SHA-256:</div>
                    <div className="text-sm font-mono text-xs truncate" title={file.sha256}>
                      {file.sha256?.substring(0, 10)}...
                    </div>
                    
                    <div className="text-sm font-medium">Upload Date:</div>
                    <div className="text-sm">
                      {formatDate(file.uploadedAt)}
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-sm font-medium">EPCIS Version:</div>
                      <div className="text-sm">
                        {file.metadata.version || "Unknown"}
                      </div>
                    </div>
                    
                    {/* Debug output to understand file metadata structure */}
                    <div className="bg-muted/50 p-2 rounded text-xs mt-3 mb-2">
                      <pre className="whitespace-pre-wrap overflow-auto max-h-[150px]">
                        File metadata keys: {JSON.stringify(Object.keys(file.metadata || {}), null, 2)}
                        {file.metadata.productInfo && (
                          <>
                            <br />
                            <br />
                            Product Info: {JSON.stringify(file.metadata.productInfo, null, 2)}
                          </>
                        )}
                      </pre>
                    </div>
                    
                    {/* Display product information if available */}
                    {file.metadata.productInfo ? (
                      <div className="space-y-2">
                        <div className="text-sm font-semibold mb-3 text-primary">Product Information</div>
                        
                        <ProductInfoDisplay 
                          productInfo={file.metadata.productInfo} 
                          gtin={file.metadata.productInfo.gtin}
                        />
                      </div>
                    ) : (
                      <div className="bg-muted/30 p-3 rounded text-sm mt-3">
                        <div className="font-medium mb-1 text-primary">Product Information</div>
                        <p className="text-muted-foreground text-sm">No product information available in this file</p>
                      </div>
                    )}
                    
                    {file.metadata.senderGln && (
                      <>
                        <div className="text-sm font-medium">Sender GLN:</div>
                        <div className="text-sm font-mono">{file.metadata.senderGln}</div>
                      </>
                    )}
                    
                    <div className="col-span-2 pt-2">
                      <div className="text-sm font-medium mb-2">Event Summary:</div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-white p-3 rounded border">
                          <div className="text-xs text-neutral-500 uppercase">Object Events</div>
                          <div className="text-lg font-semibold mt-1">{file.metadata.objectEvents || 0}</div>
                        </div>
                        <div className="bg-white p-3 rounded border">
                          <div className="text-xs text-neutral-500 uppercase">Aggregation Events</div>
                          <div className="text-lg font-semibold mt-1">{file.metadata.aggregationEvents || 0}</div>
                        </div>
                        <div className="bg-white p-3 rounded border">
                          <div className="text-xs text-neutral-500 uppercase">Transaction Events</div>
                          <div className="text-lg font-semibold mt-1">{file.metadata.transactionEvents || 0}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Business transactions card */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ArrowRightLeft className="h-5 w-5 text-primary" />
                  Business Transactions
                </CardTitle>
                <CardDescription>
                  List of business transactions associated with this EPCIS file
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-6">
                {file.metadata.bizTransactions && file.metadata.bizTransactions.length > 0 ? (
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[200px]">Type</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {file.metadata.bizTransactions.map((bizTransaction: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">
                              {bizTransaction.type.split(':').pop() || bizTransaction.type}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {bizTransaction.value}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm">
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="py-12 text-center border rounded-md">
                    <p className="text-muted-foreground">No business transactions found in this file</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="products">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Product Items
              </CardTitle>
              <CardDescription>
                List of serialized product items found in this EPCIS file
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingProductItems ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : productItems && productItems.length > 0 ? (
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">GTIN</TableHead>
                        <TableHead>Serial Number</TableHead>
                        <TableHead>Lot Number</TableHead>
                        <TableHead>Expiration Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productItems.slice(0, 10).map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-sm">{item.gtin}</TableCell>
                          <TableCell className="font-mono text-sm">{item.serialNumber}</TableCell>
                          <TableCell className="font-mono text-sm">{item.lotNumber}</TableCell>
                          <TableCell>{formatDate(item.expirationDate)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {productItems.length > 10 && (
                    <div className="py-2 px-4 bg-muted flex justify-between items-center">
                      <p className="text-sm text-muted-foreground">
                        Showing 10 of {productItems.length} items
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.open(`/product-items/file/${fileId}`, '_blank')}
                      >
                        View All
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center border rounded-md">
                  <p className="text-muted-foreground">No product items found in this file</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="po-associations">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Purchase Order Associations
              </CardTitle>
              <CardDescription>
                Purchase Orders associated with this EPCIS file
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingAssociations ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : associations && associations.length > 0 ? (
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>PO Number</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Associated On</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {associations.map((association: any) => (
                        <TableRow key={association.id}>
                          <TableCell className="font-medium">
                            <WouterLink href={`/purchase-orders/${association.po.id}`}>
                              <span className="text-primary hover:underline cursor-pointer">
                                {association.po.poNumber}
                              </span>
                            </WouterLink>
                          </TableCell>
                          <TableCell>
                            <Badge variant={association.status === "MATCHED" ? "success" : "outline"}>
                              {association.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(association.createdAt)}</TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => window.open(`/purchase-orders/${association.po.id}`, '_blank')}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-12 text-center border rounded-md flex flex-col items-center gap-4">
                  <p className="text-muted-foreground mb-2">No purchase orders are associated with this file yet</p>
                  <Button 
                    variant="outline"
                    className="flex items-center gap-2"
                    onClick={handleAssociateWithPO}
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Associate with a PO
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="transmission-history">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Send className="h-5 w-5 text-primary" />
                Transmission History
              </CardTitle>
              <CardDescription>
                History of file transmissions to trading partners
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* We'll implement the transmission history table here */}
              <div className="py-12 text-center border rounded-md flex flex-col items-center gap-4">
                <p className="text-muted-foreground mb-2">This file has not been transmitted to any trading partners yet</p>
                <Button 
                  variant="outline"
                  className="flex items-center gap-2"
                  onClick={() => setShowSendModal(true)}
                >
                  <Send className="h-4 w-4" />
                  Send This File
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modals and dialogs */}
      <SendFileModal 
        isOpen={showSendModal} 
        onClose={() => setShowSendModal(false)} 
        fileId={Number(fileId)}
      />
      
      {showValidationDialog && (
        <ProductValidationDialog
          isOpen={showValidationDialog}
          onClose={() => setShowValidationDialog(false)}
          productItems={productItems || []}
        />
      )}
      
      {showAssociatePODialog && (
        <AssociatePODialog
          isOpen={showAssociatePODialog}
          onClose={() => setShowAssociatePODialog(false)}
          fileId={Number(fileId)}
        />
      )}
      
      <PresignedLinks
        fileId={Number(fileId)}
        fileName={file.name}
      />
    </Layout>
  );
}