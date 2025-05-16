import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Calendar, FileText, Download, Plus, LinkIcon, QrCode } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { insertEpcisPoAssociationSchema } from "@shared/schema";
import { Layout } from "@/components/layout/layout";

// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

// Form schema for associating EPCIS files
const associationSchema = z.object({
  fileId: z.number().min(1, "Please select a file"),
  associationMethod: z.enum(["direct", "inferred_date", "inferred_gtin", "manual"]),
  confidence: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
});

type AssociationFormValues = z.infer<typeof associationSchema>;

export default function PurchaseOrderDetailPage() {
  const [, params] = useRoute("/purchase-orders/:id");
  const { toast } = useToast();
  const [associateDialogOpen, setAssociateDialogOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState("overview");
  
  // Get the purchase order ID from the route
  const poId = params?.id ? parseInt(params.id) : 0;
  
  // Fetch purchase order details
  const { data: purchaseOrder, isLoading: isLoadingPO } = useQuery({
    queryKey: [`/api/purchase-orders/${poId}`],
    enabled: !!poId,
  });
  
  // Fetch associated EPCIS files
  const { data: associatedFilesResponse, isLoading: isLoadingFiles } = useQuery({
    queryKey: [`/api/purchase-orders/${poId}/files`],
    enabled: !!poId,
  });
  
  // Extract the associated files array from the response
  const associatedFiles = Array.isArray(associatedFilesResponse) ? associatedFilesResponse : 
    (associatedFilesResponse && associatedFilesResponse.associations ? associatedFilesResponse.associations : []);
  
  // Fetch product items from this purchase order
  const { data: productItemsResponse, isLoading: isLoadingItems } = useQuery({
    queryKey: [`/api/purchase-orders/${poId}/products`],
    enabled: !!poId,
  });
  
  // Extract the product items array from the response
  const productItems = Array.isArray(productItemsResponse) ? productItemsResponse : 
    (productItemsResponse && productItemsResponse.items ? productItemsResponse.items : []);
  
  // Fetch all files for association dropdown
  const { data: allFilesResponse, isLoading: isLoadingAllFiles } = useQuery({
    queryKey: ['/api/files'],
    enabled: associateDialogOpen, // Only load when dialog is open
  });
  
  // Extract the files array from the response
  const allFiles = allFilesResponse?.files || [];
  
  // Set up form for associating files
  const form = useForm<AssociationFormValues>({
    resolver: zodResolver(associationSchema),
    defaultValues: {
      fileId: 0,
      associationMethod: "manual",
      confidence: 100,
      notes: "",
    },
  });
  
  // Mutation for associating a file with this PO
  const associateMutation = useMutation({
    mutationFn: async (values: AssociationFormValues) => {
      const response = await fetch('/api/associations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...values, 
          poId
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to associate file");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/purchase-orders/${poId}/files`] });
      setAssociateDialogOpen(false);
      form.reset();
      toast({
        title: "File Associated",
        description: "The EPCIS file has been successfully associated with this purchase order.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (values: AssociationFormValues) => {
    associateMutation.mutate(values);
  };
  
  // Filter out already associated files from the dropdown
  const availableFiles = allFiles.filter(file => {
    return !associatedFiles.some(association => association.file && association.file.id === file.id);
  });
  
  // Status badge color mapping
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'open':
        return 'bg-blue-500';
      case 'received':
        return 'bg-green-500';
      case 'closed':
        return 'bg-gray-500';
      case 'cancelled':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };
  
  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  };
  
  return (
    <Layout title={isLoadingPO ? "Purchase Order Details" : `Purchase Order: ${purchaseOrder?.poNumber}`}>
      <div className="flex items-center mb-6">
        <Link href="/purchase-orders">
          <Button variant="ghost" size="sm" className="mr-2">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isLoadingPO ? <Skeleton className="h-9 w-48" /> : `PO: ${purchaseOrder?.poNumber}`}
          </h1>
          <p className="text-muted-foreground">
            {isLoadingPO ? <Skeleton className="h-5 w-64 mt-1" /> : 
              `${purchaseOrder?.customer || 'Internal Customer'} — ${formatDate(purchaseOrder?.orderDate)}`}
          </p>
        </div>
      </div>
      
      <Tabs value={currentTab} onValueChange={setCurrentTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="files">EPCIS Files</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Purchase Order Details</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingPO ? (
                  <div className="space-y-4">
                    {Array(5).fill(0).map((_, i) => (
                      <div key={i} className="grid grid-cols-2 gap-4">
                        <Skeleton className="h-5 w-24" />
                        <Skeleton className="h-5 w-48" />
                      </div>
                    ))}
                  </div>
                ) : purchaseOrder ? (
                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <div className="text-sm font-medium">Status:</div>
                      <div>
                        <Badge className={getStatusColor(purchaseOrder.status)}>
                          {purchaseOrder.status.charAt(0).toUpperCase() + purchaseOrder.status.slice(1)}
                        </Badge>
                      </div>
                      
                      <div className="text-sm font-medium">PO Number:</div>
                      <div>{purchaseOrder.poNumber}</div>
                      
                      <div className="text-sm font-medium">Partner:</div>
                      <div>{purchaseOrder.partnerId || "N/A"}</div>
                      
                      <div className="text-sm font-medium">Supplier GLN:</div>
                      <div>{purchaseOrder.supplierGln}</div>
                      
                      <div className="text-sm font-medium">Customer:</div>
                      <div>{purchaseOrder.customer || "N/A"}</div>
                      
                      <div className="text-sm font-medium">Order Date:</div>
                      <div>{formatDate(purchaseOrder.orderDate)}</div>
                      
                      <div className="text-sm font-medium">Expected Delivery:</div>
                      <div>{formatDate(purchaseOrder.expectedDeliveryDate)}</div>
                      
                      <div className="text-sm font-medium">Created By:</div>
                      <div>{purchaseOrder.createdBy}</div>
                      
                      <div className="text-sm font-medium">Created At:</div>
                      <div>{new Date(purchaseOrder.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    Purchase order not found
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                <Button 
                  variant="default" 
                  onClick={() => setCurrentTab("files")}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  View Associated Files
                </Button>
                <Button 
                  variant="secondary"
                  onClick={() => setCurrentTab("products")}
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  View Products
                </Button>
              </CardFooter>
            </Card>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Associated Files</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {isLoadingFiles ? <Skeleton className="h-8 w-12" /> : 
                      associatedFiles?.length || 0}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Product Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {isLoadingItems ? <Skeleton className="h-8 w-12" /> : 
                      productItems?.length || 0}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Last Updated</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="font-medium">
                    {isLoadingPO ? <Skeleton className="h-6 w-24" /> : 
                      new Date(purchaseOrder?.createdAt).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="files">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Associated EPCIS Files</CardTitle>
              <Button onClick={() => setAssociateDialogOpen(true)}>
                <LinkIcon className="mr-2 h-4 w-4" /> Associate File
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File Name</TableHead>
                    <TableHead>Association Method</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Date Added</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingFiles ? (
                    Array(3).fill(0).map((_, index) => (
                      <TableRow key={index}>
                        <TableCell><Skeleton className="h-6 w-40" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-24 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : associatedFiles?.length > 0 ? (
                    associatedFiles.map((association) => (
                      <TableRow key={association.id}>
                        <TableCell className="font-medium">{association.file.originalName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {association.associationMethod.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>{association.confidence || 'N/A'}</TableCell>
                        <TableCell>{new Date(association.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => window.open(`/api/files/${association.file.id}/download`, '_blank')}
                            >
                              <Download className="h-4 w-4" />
                              <span className="sr-only">Download</span>
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => window.location.href = `/files/${association.file.id}`}
                            >
                              <FileText className="h-4 w-4" />
                              <span className="sr-only">View</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        No files associated with this purchase order yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="products">
          <Card>
            <CardHeader>
              <CardTitle>Product Items</CardTitle>
              <CardDescription>
                Products associated with this purchase order from EPCIS files
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>GTIN</TableHead>
                    <TableHead>Serial Number</TableHead>
                    <TableHead>Lot Number</TableHead>
                    <TableHead>Expiration Date</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Destination</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingItems ? (
                    Array(5).fill(0).map((_, index) => (
                      <TableRow key={index}>
                        <TableCell><Skeleton className="h-6 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                      </TableRow>
                    ))
                  ) : productItems?.length > 0 ? (
                    productItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.gtin}</TableCell>
                        <TableCell>{item.serialNumber}</TableCell>
                        <TableCell>{item.lotNumber}</TableCell>
                        <TableCell>{formatDate(item.expirationDate)}</TableCell>
                        <TableCell>{item.sourceGln || 'N/A'}</TableCell>
                        <TableCell>{item.destinationGln || 'N/A'}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        No product items associated with this purchase order yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter>
              <Button variant="outline" onClick={() => window.location.href = `/purchase-orders/${poId}/validate`}>
                <QrCode className="mr-2 h-4 w-4" />
                Start Validation Session
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Associate File Dialog */}
      <Dialog open={associateDialogOpen} onOpenChange={setAssociateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Associate EPCIS File</DialogTitle>
            <DialogDescription>
              Link an EPCIS file to this purchase order.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="fileId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>EPCIS File</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(parseInt(value))} 
                      defaultValue={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a file" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isLoadingAllFiles ? (
                          <div className="p-2">Loading files...</div>
                        ) : availableFiles.length > 0 ? (
                          availableFiles.map((file) => (
                            <SelectItem key={file.id} value={file.id.toString()}>
                              {file.originalName}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-2">No available files to associate</div>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="associationMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Association Method</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="direct">Direct Reference</SelectItem>
                        <SelectItem value="inferred_date">Inferred by Date</SelectItem>
                        <SelectItem value="inferred_gtin">Inferred by GTIN</SelectItem>
                        <SelectItem value="manual">Manual Association</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="confidence"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confidence Level (0-100)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0" 
                        max="100" 
                        {...field} 
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      How confident are you in this association? 100 = certain.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional notes about this association" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setAssociateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={associateMutation.isPending || !availableFiles.length}
                >
                  {associateMutation.isPending ? "Associating..." : "Associate File"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}