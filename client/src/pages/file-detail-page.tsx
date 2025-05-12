import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tag, Package, ArrowRightLeft, ChevronDown } from "lucide-react";

export default function FileDetailPage() {
  const { id } = useParams<{ id: string }>();
  const fileId = parseInt(id);
  const [sendModalOpen, setSendModalOpen] = useState(false);

  const { data: file, isLoading: isLoadingFile } = useQuery({
    queryKey: [`/api/files/${fileId}`],
    enabled: !isNaN(fileId),
  });

  const { data: history, isLoading: isLoadingHistory } = useQuery({
    queryKey: [`/api/files/${fileId}/history`],
    enabled: !isNaN(fileId),
  });

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
                        <div className="text-sm font-medium">Schema Version:</div>
                        <div className="text-sm">
                          <Badge variant="outline" className="bg-primary/10 text-primary">
                            EPCIS {file.metadata.schemaVersion || "Unknown"}
                          </Badge>
                        </div>

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
                    </div>
                    
                    {/* EPCIS Events Summary */}
                    <div className="mt-4">
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="event-details">
                          <AccordionTrigger className="text-sm font-medium">
                            View EPCIS Event Details
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-4">
                              {/* Object Events */}
                              {file.metadata?.objectEvents > 0 && (
                                <div className="p-4 border rounded-md">
                                  <div className="flex items-center mb-3">
                                    <Tag className="h-5 w-5 text-primary mr-2" />
                                    <h4 className="font-medium">Object Events ({file.metadata.objectEvents})</h4>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-neutral-50 p-3 rounded">
                                      <p className="text-xs text-neutral-500 mb-1">Common Event Types</p>
                                      <ul className="text-sm space-y-1">
                                        <li className="flex items-center">
                                          <ChevronRight className="h-3 w-3 mr-1 shrink-0" />
                                          Commissioning
                                        </li>
                                        <li className="flex items-center">
                                          <ChevronRight className="h-3 w-3 mr-1 shrink-0" />
                                          Shipping
                                        </li>
                                        <li className="flex items-center">
                                          <ChevronRight className="h-3 w-3 mr-1 shrink-0" />
                                          Receiving
                                        </li>
                                      </ul>
                                    </div>
                                    <div className="bg-neutral-50 p-3 rounded">
                                      <p className="text-xs text-neutral-500 mb-1">Typical Data</p>
                                      <ul className="text-sm space-y-1">
                                        <li className="flex items-center">
                                          <ChevronRight className="h-3 w-3 mr-1 shrink-0" />
                                          Serialized GTINs (SGTINs)
                                        </li>
                                        <li className="flex items-center">
                                          <ChevronRight className="h-3 w-3 mr-1 shrink-0" />
                                          Lot/Batch Number
                                        </li>
                                        <li className="flex items-center">
                                          <ChevronRight className="h-3 w-3 mr-1 shrink-0" />
                                          Expiration Date
                                        </li>
                                      </ul>
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              {/* Aggregation Events */}
                              {file.metadata?.aggregationEvents > 0 && (
                                <div className="p-4 border rounded-md">
                                  <div className="flex items-center mb-3">
                                    <Package className="h-5 w-5 text-secondary mr-2" />
                                    <h4 className="font-medium">Aggregation Events ({file.metadata.aggregationEvents})</h4>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-neutral-50 p-3 rounded">
                                      <p className="text-xs text-neutral-500 mb-1">Common Event Types</p>
                                      <ul className="text-sm space-y-1">
                                        <li className="flex items-center">
                                          <ChevronRight className="h-3 w-3 mr-1 shrink-0" />
                                          Packing
                                        </li>
                                        <li className="flex items-center">
                                          <ChevronRight className="h-3 w-3 mr-1 shrink-0" />
                                          Unpacking
                                        </li>
                                      </ul>
                                    </div>
                                    <div className="bg-neutral-50 p-3 rounded">
                                      <p className="text-xs text-neutral-500 mb-1">Typical Data</p>
                                      <ul className="text-sm space-y-1">
                                        <li className="flex items-center">
                                          <ChevronRight className="h-3 w-3 mr-1 shrink-0" />
                                          Parent SSCCs (shipping containers)
                                        </li>
                                        <li className="flex items-center">
                                          <ChevronRight className="h-3 w-3 mr-1 shrink-0" />
                                          Child SGTINs (serialized items)
                                        </li>
                                      </ul>
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              {/* Transaction Events */}
                              {file.metadata?.transactionEvents > 0 && (
                                <div className="p-4 border rounded-md">
                                  <div className="flex items-center mb-3">
                                    <ArrowRightLeft className="h-5 w-5 text-warning mr-2" />
                                    <h4 className="font-medium">Transaction Events ({file.metadata.transactionEvents})</h4>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-neutral-50 p-3 rounded">
                                      <p className="text-xs text-neutral-500 mb-1">Common Event Types</p>
                                      <ul className="text-sm space-y-1">
                                        <li className="flex items-center">
                                          <ChevronRight className="h-3 w-3 mr-1 shrink-0" />
                                          Sale
                                        </li>
                                        <li className="flex items-center">
                                          <ChevronRight className="h-3 w-3 mr-1 shrink-0" />
                                          Purchase Order
                                        </li>
                                        <li className="flex items-center">
                                          <ChevronRight className="h-3 w-3 mr-1 shrink-0" />
                                          Invoice
                                        </li>
                                      </ul>
                                    </div>
                                    <div className="bg-neutral-50 p-3 rounded">
                                      <p className="text-xs text-neutral-500 mb-1">Typical Data</p>
                                      <ul className="text-sm space-y-1">
                                        <li className="flex items-center">
                                          <ChevronRight className="h-3 w-3 mr-1 shrink-0" />
                                          Business Transaction References
                                        </li>
                                        <li className="flex items-center">
                                          <ChevronRight className="h-3 w-3 mr-1 shrink-0" />
                                          Transaction Statement
                                        </li>
                                        <li className="flex items-center">
                                          <ChevronRight className="h-3 w-3 mr-1 shrink-0" />
                                          Source/Destination Information
                                        </li>
                                      </ul>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>
                  </div>
                )}
              </div>

              {file.errorCode && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-neutral-700 mb-2">Error Information</h3>
                  <div className="bg-destructive/10 p-4 rounded-md text-destructive">
                    <div className="grid grid-cols-1 gap-2">
                      <div className="flex items-start">
                        <div className="font-medium mr-2">Error Code:</div>
                        <div>{file.errorCode}</div>
                      </div>
                      {file.errorMessage && (
                        <div className="flex items-start">
                          <div className="font-medium mr-2">Message:</div>
                          <div>{file.errorMessage}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Transmission History</CardTitle>
              <CardDescription>
                Track all send attempts and delivery confirmations for this file
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                      <TableHead>Sent At</TableHead>
                      <TableHead>Sent By</TableHead>
                      <TableHead>Transport</TableHead>
                      <TableHead>Delivery Confirmation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((transmission: any) => (
                      <TableRow key={transmission.id}>
                        <TableCell>{transmission.partner?.name || "Unknown Partner"}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`capitalize ${
                              transmission.status === "sent"
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
            </CardContent>
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
