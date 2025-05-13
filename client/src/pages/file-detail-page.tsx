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
import { useState } from "react";
import { format } from "date-fns";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// Component to refresh metadata
function RefreshMetadataButton({ fileId }: { fileId: number }) {
  const { toast } = useToast();
  
  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/files/${fileId}/reprocess`);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Metadata updated",
        description: "File metadata has been refreshed successfully.",
        variant: "default",
      });
      // Invalidate cache to reload file details
      queryClient.invalidateQueries({ queryKey: [`/api/files/${fileId}`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to refresh file metadata",
        variant: "destructive",
      });
    },
  });
  
  return (
    <Button 
      variant="outline" 
      onClick={() => refreshMutation.mutate()} 
      disabled={refreshMutation.isPending}
      className="max-w-xs"
    >
      {refreshMutation.isPending ? (
        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4 mr-2" />
      )}
      Refresh Metadata
    </Button>
  );
}

export default function FileDetailPage() {
  const { id } = useParams<{ id: string }>();
  const fileId = parseInt(id);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const { toast } = useToast();

  // Define the reprocess mutation
  const reprocessMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/files/${fileId}/reprocess`);
      return await res.json();
    },
    onSuccess: () => {
      // Silent success - don't show a toast notification
      // Invalidate cache to reload file details
      queryClient.invalidateQueries({ queryKey: [`/api/files/${fileId}`] });
    },
    onError: (error: Error) => {
      // Only show errors, not success messages
      toast({
        title: "Metadata update failed",
        description: error.message || "Failed to refresh file metadata",
        variant: "destructive",
      });
    },
  });

  // Query for file data 
  const { data: file, isLoading: isLoadingFile } = useQuery({
    queryKey: [`/api/files/${fileId}`],
    enabled: !isNaN(fileId),
  });
  
  // Check if we need to refresh metadata automatically
  // Use this instead of useEffect for simplicity
  if (file && (!file.metadata?.productInfo || 
      Object.keys(file.metadata?.productInfo || {}).length === 0) && 
      !reprocessMutation.isPending && !reprocessMutation.isSuccess) {
    // Only try to reprocess once
    reprocessMutation.mutate();
  }

  const { data: history, isLoading: isLoadingHistory } = useQuery({
    queryKey: [`/api/files/${fileId}/history`],
    enabled: !isNaN(fileId),
  });
  
  // Query for file's associated purchase orders
  const { data: associationsResponse, isLoading: isLoadingAssociations } = useQuery({
    queryKey: [`/api/associations/file/${fileId}`],
    enabled: !isNaN(fileId),
  });
  
  // Extract the associations array from the response
  const associations = Array.isArray(associationsResponse) ? associationsResponse : 
    (associationsResponse?.associations || []);
    
  // Query for product items in this file
  const { data: productItemsResponse, isLoading: isLoadingItems } = useQuery({
    queryKey: [`/api/product-items/file/${fileId}`],
    enabled: !isNaN(fileId),
  });
  
  // Extract the product items array from the response
  const productItems = Array.isArray(productItemsResponse) ? productItemsResponse : 
    (productItemsResponse?.items || []);

  if (isNaN(fileId)) {
    return (
      <Layout title="Invalid File ID">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Invalid File ID</h2>
          <p className="text-neutral-600 mb-6">The file ID is not valid.</p>
          <Button asChild>
            <WouterLink href="/files">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Files
            </WouterLink>
          </Button>
        </div>
      </Layout>
    );
  }

  // Format file size for display
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "Unknown";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Get status icon
  const getStatusIcon = (status?: string) => {
    if (!status) return <Clock className="h-5 w-5" />;
    
    switch (status.toLowerCase()) {
      case "validated":
      case "sent":
        return <CheckCircle className="h-5 w-5 text-success" />;
      case "failed":
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case "sending":
        return <Clock className="h-5 w-5 text-warning" />;
      default:
        return <Clock className="h-5 w-5" />;
    }
  };

  // Handle download
  const handleDownload = () => {
    window.location.href = `/api/files/${fileId}/download`;
  };

  // Handle send
  const handleSend = () => {
    setSendModalOpen(true);
  };
  
  // Handle opening the product validation dialog
  const handleOpenValidationDialog = () => {
    setValidationDialogOpen(true);
  };

  return (
    <Layout title="File Details">
      <div className="flex items-center mb-6">
        <Button variant="ghost" className="mr-2" asChild>
          <WouterLink href="/files">
            <ArrowLeft className="h-4 w-4" />
          </WouterLink>
        </Button>
        <h1 className="text-2xl font-semibold text-neutral-900">File Details</h1>
      </div>

      {isLoadingFile ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/2 mt-2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          </CardContent>
        </Card>
      ) : file ? (
        <>
          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-xl flex items-center">
                  <FileArchive className="h-5 w-5 mr-2 text-neutral-600" />
                  {file.originalName}
                </CardTitle>
                <CardDescription>
                  {file.fileType} • {formatFileSize(file.fileSize)}
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                {file.status === "validated" && (
                  <Button onClick={handleSend}>
                    <Send className="mr-2 h-4 w-4" />
                    Send to Partner
                  </Button>
                )}
                <Button variant="outline" onClick={handleDownload}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div>
                  <h3 className="text-sm font-medium text-neutral-700 mb-2">File Information</h3>
                  <div className="bg-neutral-50 p-4 rounded-md">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <div className="text-sm font-medium">File ID:</div>
                      <div className="text-sm">{file.id}</div>

                      <div className="text-sm font-medium">Status:</div>
                      <div className="text-sm flex items-center">
                        {getStatusIcon(file.status)}
                        <Badge variant="outline" className="ml-2 capitalize">
                          {file.status}
                        </Badge>
                      </div>

                      <div className="text-sm font-medium">SHA-256:</div>
                      <div className="text-sm truncate" title={file.sha256}>
                        {file.sha256?.substring(0, 10)}...{file.sha256?.substring(file.sha256.length - 10)}
                      </div>

                      <div className="text-sm font-medium">Upload Date:</div>
                      <div className="text-sm">
                        {format(new Date(file.uploadedAt), "PPP p")}
                      </div>
                    </div>
                  </div>
                </div>

                {file.metadata && (
                  <div>
                    <h3 className="text-sm font-medium text-neutral-700 mb-2">EPCIS Data</h3>
                    <div className="bg-neutral-50 p-4 rounded-md">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {/* EPCIS Standard Information */}
                        <div className="text-sm font-medium">EPCIS Version:</div>
                        <div className="text-sm">
                          <Badge variant="outline" className="bg-primary/10 text-primary">
                            EPCIS {file.metadata.schemaVersion || "Unknown"}
                          </Badge>
                        </div>
                        
                        {/* Product Information - New section */}
                        {file.metadata.productInfo && (
                          <div className="col-span-2 pt-4 pb-2">
                            <div className="text-sm font-semibold mb-3 text-primary">Product Information</div>
                            <div className="bg-white p-4 rounded-lg border border-primary/10">
                              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                {file.metadata.productInfo.name && (
                                  <>
                                    <div className="text-sm font-medium text-neutral-700">Product Name:</div>
                                    <div className="text-sm font-semibold">{file.metadata.productInfo.name}</div>
                                  </>
                                )}
                                
                                {file.metadata.productInfo.manufacturer && (
                                  <>
                                    <div className="text-sm font-medium text-neutral-700">Manufacturer:</div>
                                    <div className="text-sm">{file.metadata.productInfo.manufacturer}</div>
                                  </>
                                )}
                                
                                {file.metadata.productInfo.dosageForm && file.metadata.productInfo.strength && (
                                  <>
                                    <div className="text-sm font-medium text-neutral-700">Dosage Form:</div>
                                    <div className="text-sm">
                                      {file.metadata.productInfo.dosageForm} - {file.metadata.productInfo.strength}
                                    </div>
                                  </>
                                )}
                                
                                {/* Show GTIN if available */}
                                {productItems && productItems.length > 0 && productItems[0].gtin && (
                                  <>
                                    <div className="text-sm font-medium text-neutral-700">GTIN:</div>
                                    <div className="text-sm font-mono">
                                      {productItems[0].gtin}
                                    </div>
                                  </>
                                )}
                                
                                {/* Show NDC if available in metadata, or derive from GTIN */}
                                {(file.metadata.productInfo.ndc || 
                                  (productItems && productItems.length > 0 && productItems[0].gtin)) && (
                                  <>
                                    <div className="text-sm font-medium text-neutral-700">NDC:</div>
                                    <div className="text-sm font-mono">
                                      {file.metadata.productInfo.ndc || 
                                       (productItems && productItems.length > 0 && productItems[0].gtin 
                                        ? (() => {
                                            // Convert GTIN to NDC
                                            // GTIN-14 format: Indicator(1) + Labeler(5) + Product(3) + Package(1) + Check(1)
                                            // NDC format: Labeler(5)-Product(4)-Package(2)
                                            const gtin = productItems[0].gtin;
                                            if (gtin && gtin.length >= 11) {
                                              // Extract the middle portion of the GTIN, which corresponds to the NDC
                                              // For GTIN-14, start at position 1 (after indicator digit)
                                              // For GTIN-12, start at position 0
                                              const startPos = gtin.length >= 14 ? 1 : 0;
                                              // Format as 5-4-2
                                              // Note: This is a simplified conversion and may not work for all GTINs
                                              const labeler = gtin.substring(startPos, startPos + 5);
                                              const product = gtin.substring(startPos + 5, startPos + 9);
                                              const pkg = gtin.substring(startPos + 9, startPos + 11);
                                              return `${labeler}-${product}-${pkg}`;
                                            }
                                            return "Not available";
                                          })()
                                        : "Not available")
                                      }
                                    </div>
                                  </>
                                )}
                                
                                {file.metadata.productInfo.lotNumber && (
                                  <>
                                    <div className="text-sm font-medium text-neutral-700">Lot/Batch:</div>
                                    <div className="text-sm font-mono">
                                      {typeof file.metadata.productInfo.lotNumber === 'object' && file.metadata.productInfo.lotNumber._
                                        ? file.metadata.productInfo.lotNumber._
                                        : file.metadata.productInfo.lotNumber}
                                    </div>
                                  </>
                                )}
                                
                                {file.metadata.productInfo.expirationDate && (
                                  <>
                                    <div className="text-sm font-medium text-neutral-700">Expiration Date:</div>
                                    <div className="text-sm">
                                      {typeof file.metadata.productInfo.expirationDate === 'object' && file.metadata.productInfo.expirationDate._
                                        ? new Date(file.metadata.productInfo.expirationDate._).toLocaleDateString()
                                        : new Date(file.metadata.productInfo.expirationDate).toLocaleDateString()}
                                    </div>
                                  </>
                                )}
                                
                                {file.metadata.productInfo.netContent && (
                                  <>
                                    <div className="text-sm font-medium text-neutral-700">Quantity/Pack Size:</div>
                                    <div className="text-sm">{file.metadata.productInfo.netContent}</div>
                                  </>
                                )}
                                
                                {/* Purchase Order Association Section */}
                                <div className="border-t pt-3 mt-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="text-sm font-medium text-neutral-700">Purchase Order Association</div>
                                    <AssociatePODialog fileId={fileId}>
                                      <Button variant="outline" size="sm" className="text-xs">
                                        <ShoppingCart className="mr-2 h-3 w-3" />
                                        Associate with PO
                                      </Button>
                                    </AssociatePODialog>
                                  </div>
                                  
                                  {/* Display PO numbers extracted directly from EPCIS */}
                                  {file.metadata.poNumbers && file.metadata.poNumbers.length > 0 && (
                                    <div className="mb-2">
                                      <div className="text-xs text-neutral-500 mb-1">Referenced in EPCIS file:</div>
                                      <div className="flex flex-wrap gap-1">
                                        {file.metadata.poNumbers.map((poNumber, index) => (
                                          <Badge key={index} variant="outline" className="bg-primary/5">
                                            {poNumber}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Show linked purchase orders */}
                                  {associations && associations.length > 0 ? (
                                    <div>
                                      <div className="text-xs text-neutral-500 mb-1">Linked Purchase Orders:</div>
                                      <div className="space-y-2">
                                        {associations.map((association) => (
                                          <div key={association.id} className="flex items-center justify-between bg-white rounded p-2 border">
                                            <div className="flex items-center">
                                              <ShoppingCart className="h-4 w-4 text-primary mr-2" />
                                              <div>
                                                <WouterLink 
                                                  href={`/purchase-orders/${association.po.id}`} 
                                                  className="text-sm font-medium hover:underline"
                                                >
                                                  PO: {association.po.poNumber}
                                                </WouterLink>
                                                <div className="text-xs text-neutral-500">
                                                  Method: {association.associationMethod.replace('_', ' ')}
                                                  {association.confidence !== null && 
                                                    ` • ${association.confidence}% confidence`}
                                                </div>
                                              </div>
                                            </div>
                                            <Button 
                                              variant="ghost" 
                                              size="sm"
                                              onClick={() => window.location.href = `/purchase-orders/${association.po.id}`}
                                            >
                                              <FileText className="h-3.5 w-3.5" />
                                              <span className="sr-only">View</span>
                                            </Button>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-xs text-neutral-500 bg-muted/30 rounded p-2 border border-dashed">
                                      No purchase orders associated with this file yet. Click "Associate with PO" to link this file with a purchase order.
                                    </div>
                                  )}
                                </div>
                                
                                {/* Display Serial Numbers from product items */}
                                {productItems && productItems.length > 0 && (
                                  <>
                                    <div className="text-sm font-medium text-neutral-700">Serial Number(s):</div>
                                    <div className="text-sm">
                                      {productItems.length === 1 ? (
                                        <code className="bg-primary/5 px-1 py-0.5 rounded text-xs font-mono">
                                          {productItems[0].serialNumber}
                                        </code>
                                      ) : productItems.length <= 5 ? (
                                        <div className="flex flex-wrap gap-1">
                                          {productItems.slice(0, 5).map((item, index) => (
                                            <code key={index} className="bg-primary/5 px-1.5 py-0.5 rounded text-xs font-mono">
                                              {item.serialNumber}
                                            </code>
                                          ))}
                                        </div>
                                      ) : (
                                        <div>
                                          <div className="flex flex-wrap gap-1 mb-1">
                                            {productItems.slice(0, 3).map((item, index) => (
                                              <code key={index} className="bg-primary/5 px-1.5 py-0.5 rounded text-xs font-mono">
                                                {item.serialNumber}
                                              </code>
                                            ))}
                                          </div>
                                          <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="text-xs"
                                            onClick={() => window.open(`/product-items/file/${fileId}`, '_blank')}
                                          >
                                            View all {productItems.length} Serial Numbers
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  </>
                                )}
                                
                                {/* Display Serial Numbers from extracted metadata if no product items */}
                                {(!productItems || productItems.length === 0) && 
                                  file.metadata.productItems && 
                                  file.metadata.productItems.length > 0 && (
                                  <>
                                    <div className="text-sm font-medium text-neutral-700">Serial Number(s):</div>
                                    <div className="text-sm">
                                      {file.metadata.productItems.length === 1 ? (
                                        <code className="bg-primary/5 px-1 py-0.5 rounded text-xs font-mono">
                                          {file.metadata.productItems[0].serialNumber}
                                        </code>
                                      ) : file.metadata.productItems.length <= 5 ? (
                                        <div className="flex flex-wrap gap-1">
                                          {file.metadata.productItems.slice(0, 5).map((item, index) => (
                                            <code key={index} className="bg-primary/5 px-1.5 py-0.5 rounded text-xs font-mono">
                                              {item.serialNumber}
                                            </code>
                                          ))}
                                        </div>
                                      ) : (
                                        <div>
                                          <div className="flex flex-wrap gap-1 mb-1">
                                            {file.metadata.productItems.slice(0, 3).map((item, index) => (
                                              <code key={index} className="bg-primary/5 px-1.5 py-0.5 rounded text-xs font-mono">
                                                {item.serialNumber}
                                              </code>
                                            ))}
                                            <span className="text-neutral-500">+{file.metadata.productItems.length - 3} more</span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
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

                        <div className="col-span-2 pt-2">
                          <div className="text-sm font-medium mb-2">Transaction Summary:</div>
                          <div className="bg-white p-3 rounded border">
                            <div className="flex items-center">
                              <CheckCircle className="h-4 w-4 text-success mr-2" />
                              <span className="text-sm">DSCSA Transaction Statement included</span>
                            </div>
                            <div className="text-xs text-neutral-500 mt-1 pl-6">
                              Seller has complied with each applicable subsection of FDCA Sec. 581(27)(A)-(G)
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <RefreshMetadataButton fileId={fileId} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Tabs defaultValue="transmissions">
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="transmissions" className="flex items-center">
                    <Send className="h-4 w-4 mr-2" />
                    Transmission History
                  </TabsTrigger>
                  <TabsTrigger value="purchase-orders" className="flex items-center">
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Purchase Orders
                  </TabsTrigger>
                  <TabsTrigger value="presigned" className="flex items-center">
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Pre-Signed URLs
                  </TabsTrigger>
                </TabsList>
                
                <div className="mt-4">
                  <TabsContent value="transmissions">
                    <div>
                      <CardDescription className="mb-6">
                        Track all send attempts and delivery confirmations for this file
                      </CardDescription>
                      
                      {isLoadingHistory ? (
                        <div className="space-y-4">
                          <Skeleton className="h-10 w-full" />
                          <Skeleton className="h-10 w-full" />
                          <Skeleton className="h-10 w-full" />
                        </div>
                      ) : history && history.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Partner</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Date & Time</TableHead>
                              <TableHead>Sent By</TableHead>
                              <TableHead>Transport Type</TableHead>
                              <TableHead>Confirmation</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {history.map((transmission) => (
                              <TableRow key={transmission.id}>
                                <TableCell className="font-medium">
                                  {transmission.partner.name}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    className={`${
                                      transmission.status === "delivered"
                                        ? "text-success"
                                        : transmission.status === "failed"
                                        ? "text-destructive"
                                        : "text-warning"
                                    }`}
                                  >
                                    {transmission.status}
                                  </Badge>
                                </TableCell>
                                <TableCell>{format(new Date(transmission.sentAt), "PPP p")}</TableCell>
                                <TableCell>System</TableCell>
                                <TableCell>{transmission.transportType}</TableCell>
                                <TableCell className="max-w-xs truncate" title={transmission.deliveryConfirmation}>
                                  {transmission.deliveryConfirmation || "—"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="text-center py-8 text-neutral-500">
                          <File className="h-12 w-12 mx-auto mb-3 text-neutral-300" />
                          <p>This file has not been sent to any partners yet.</p>
                          {file.status === "validated" && (
                            <Button className="mt-4" onClick={handleSend}>
                              <Send className="mr-2 h-4 w-4" />
                              Send to Partner
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="purchase-orders">
                    <div>
                      <CardDescription className="mb-6">
                        Manage purchase order associations for this EPCIS file
                      </CardDescription>
                      
                      {isLoadingAssociations ? (
                        <div className="space-y-4">
                          <Skeleton className="h-10 w-full" />
                          <Skeleton className="h-10 w-full" />
                        </div>
                      ) : associations && associations.length > 0 ? (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <h3 className="text-lg font-medium">Associated Purchase Orders</h3>
                              <p className="text-sm text-muted-foreground">
                                This file is associated with {associations.length} purchase order{associations.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <AssociatePODialog fileId={fileId}>
                              <Button variant="outline" size="sm">
                                <ShoppingCart className="mr-2 h-4 w-4" />
                                Add Association
                              </Button>
                            </AssociatePODialog>
                          </div>
                          
                          <div className="space-y-3">
                            {associations.map((association) => (
                              <Card key={association.id} className="overflow-hidden">
                                <div className="flex bg-muted/20">
                                  <div className="p-4 flex-1">
                                    <div className="flex items-center">
                                      <ShoppingCart className="h-5 w-5 text-primary mr-2" />
                                      <div>
                                        <h4 className="text-base font-medium">PO #{association.po.poNumber}</h4>
                                        <div className="text-sm text-muted-foreground">
                                          Association Method: {association.associationMethod.replace('_', ' ')}
                                          {association.confidence && ` (${association.confidence}% confidence)`}
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {association.notes && (
                                      <div className="mt-2 text-sm">
                                        <div className="font-medium">Notes:</div>
                                        <div className="text-muted-foreground">{association.notes}</div>
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="py-4 pr-4 flex items-center">
                                    <Button 
                                      variant="secondary" 
                                      onClick={() => window.location.href = `/purchase-orders/${association.po.id}`}
                                    >
                                      <FileText className="mr-2 h-4 w-4" />
                                      View PO Details
                                    </Button>
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <ShoppingCart className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                          <h3 className="text-lg font-medium mb-1">No Purchase Order Associations</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            This file has not been associated with any purchase orders yet.
                          </p>
                          <AssociatePODialog fileId={fileId}>
                            <Button>
                              <ShoppingCart className="mr-2 h-4 w-4" />
                              Associate with PO
                            </Button>
                          </AssociatePODialog>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="presigned">
                    <div>
                      <CardDescription className="mb-6">
                        Share this file securely with partners using expiring download links
                      </CardDescription>
                      <PresignedLinks fileId={fileId} />
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            </CardHeader>
          </Card>
        </>
      ) : (
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">File Not Found</h2>
          <p className="text-neutral-600 mb-6">The file you're looking for doesn't exist or has been deleted.</p>
          <Button asChild>
            <WouterLink href="/files">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Files
            </WouterLink>
          </Button>
        </div>
      )}

      {/* Send File Modal */}
      <SendFileModal
        isOpen={sendModalOpen}
        setIsOpen={setSendModalOpen}
        fileId={fileId}
      />
    </Layout>
  );
}