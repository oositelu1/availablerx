import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Layout } from '@/components/layout/layout';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload, FileText, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Form schema for invoice upload
const invoiceUploadSchema = z.object({
  invoice: z.instanceof(File)
    .refine(file => file.size <= 10 * 1024 * 1024, {
      message: 'Invoice file must be less than 10MB'
    })
    .refine(file => ['application/pdf'].includes(file.type), {
      message: 'Only PDF files are allowed'
    }),
  purchaseOrderId: z.string().optional(),
});

type InvoiceUploadFormValues = z.infer<typeof invoiceUploadSchema>;

export default function InvoiceUploadPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [extractedData, setExtractedData] = useState<any>(null);
  
  // Fetch purchase orders for dropdown
  const { data: purchaseOrders, isLoading: isLoadingPOs } = useQuery({
    queryKey: ['/api/purchase-orders'],
    enabled: true, // Always fetch POs when page loads
  });
  
  // Set up form
  const form = useForm<InvoiceUploadFormValues>({
    resolver: zodResolver(invoiceUploadSchema),
    defaultValues: {
      purchaseOrderId: "",
    },
  });
  
  // Handle file selection 
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      form.setValue('invoice', file);
    }
  };
  
  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (values: InvoiceUploadFormValues) => {
      const formData = new FormData();
      formData.append('invoice', values.invoice);
      
      if (values.purchaseOrderId) {
        formData.append('poIds', values.purchaseOrderId);
      }
      
      // Simulated progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 95) {
            clearInterval(progressInterval);
            return 95;
          }
          return prev + 5;
        });
      }, 300);
      
      try {
        const response = await apiRequest(
          'POST', 
          '/api/invoices/upload', 
          formData,
          { isFormData: true }
        );
        
        // Set progress to 100% when complete
        clearInterval(progressInterval);
        setUploadProgress(100);
        
        const data = await response.json();
        setExtractedData(data);
        return data;
      } catch (error) {
        clearInterval(progressInterval);
        setUploadProgress(0);
        throw error;
      }
    },
    onSuccess: (data) => {
      toast({
        title: "Invoice processed successfully",
        description: `Extracted data with ${data.matchScore ? Math.round(data.matchScore * 100) : 0}% confidence.`,
      });
      
      // Reset form after 5 seconds
      setTimeout(() => {
        setUploadProgress(0);
        // Uncomment this to navigate to a details page once we create it
        // navigate('/invoices/' + data.invoiceId);
      }, 5000);
    },
    onError: (error: Error) => {
      toast({
        title: "Invoice processing failed",
        description: error.message,
        variant: "destructive",
      });
      setUploadProgress(0);
    },
  });
  
  // Handle form submission
  const onSubmit = (values: InvoiceUploadFormValues) => {
    uploadMutation.mutate(values);
  };
  
  // Handle drag-and-drop
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'application/pdf') {
      form.setValue('invoice', file);
    }
  };
  
  return (
    <Layout title="Upload Invoice">
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Invoice Processing</h1>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Invoice
              </CardTitle>
              <CardDescription>
                Upload an invoice PDF to extract information and match with purchase orders
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="invoice"
                    render={({ field: { value, onChange, ...fieldProps } }) => (
                      <FormItem>
                        <FormLabel>Invoice File (PDF)</FormLabel>
                        <FormControl>
                          <div 
                            className="border-2 border-dashed rounded-md p-6 cursor-pointer hover:border-primary transition-colors"
                            onDragOver={onDragOver}
                            onDrop={onDrop}
                            onClick={() => document.getElementById('invoice-file')?.click()}
                          >
                            <input
                              id="invoice-file"
                              type="file"
                              accept="application/pdf"
                              className="hidden"
                              onChange={onFileChange}
                              {...fieldProps}
                            />
                            <div className="flex flex-col items-center justify-center text-center gap-2">
                              <FileText className="h-12 w-12 text-muted-foreground mb-2" />
                              {form.watch("invoice") ? (
                                <div>
                                  <p className="font-medium text-foreground">{(form.watch("invoice") as File).name}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {((form.watch("invoice") as File).size / 1024 / 1024).toFixed(2)} MB
                                  </p>
                                </div>
                              ) : (
                                <>
                                  <p className="font-medium text-foreground">Click to upload or drag and drop</p>
                                  <p className="text-sm text-muted-foreground">PDF files only (max 10MB)</p>
                                </>
                              )}
                            </div>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="purchaseOrderId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Match with Purchase Order (Optional)</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          disabled={isLoadingPOs}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select purchase order to match" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">None (Auto-detect)</SelectItem>
                            {purchaseOrders?.purchaseOrders?.map((po: any) => (
                              <SelectItem key={po.id} value={po.id.toString()}>
                                PO-{po.poNumber} ({new Date(po.orderDate).toLocaleDateString()})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          If selected, the system will attempt to match the invoice to this purchase order
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {uploadProgress > 0 && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Processing invoice...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} />
                    </div>
                  )}
                  
                  <Button
                    type="submit"
                    disabled={uploadMutation.isPending || !form.watch("invoice")}
                    className="w-full"
                  >
                    {uploadMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Process Invoice"
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Extracted Data
              </CardTitle>
              <CardDescription>
                Data extracted from the invoice using OCR technology
              </CardDescription>
            </CardHeader>
            <CardContent>
              {extractedData ? (
                <Tabs defaultValue="overview" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="products">Products</TabsTrigger>
                    <TabsTrigger value="json">Raw Data</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="overview" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground">Invoice Number</h3>
                        <p className="font-medium">{extractedData.extractedData.invoiceNumber || "Unknown"}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground">Invoice Date</h3>
                        <p className="font-medium">{extractedData.extractedData.invoiceDate || "Unknown"}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground">PO Number</h3>
                        <p className="font-medium">{extractedData.extractedData.poNumber || "Unknown"}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground">Total Amount</h3>
                        <p className="font-medium">${extractedData.extractedData.totals?.total?.toFixed(2) || "0.00"}</p>
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">Vendor</h3>
                      <Card className="bg-muted/50">
                        <CardContent className="p-3 text-sm">
                          <p className="font-medium">{extractedData.extractedData.vendor?.name || "Unknown vendor"}</p>
                          <p className="text-muted-foreground">{extractedData.extractedData.vendor?.address || ""}</p>
                          {extractedData.extractedData.vendor?.licenseNumber && (
                            <p className="text-muted-foreground">License: {extractedData.extractedData.vendor.licenseNumber}</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                    
                    <div className="mt-4">
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">Customer</h3>
                      <Card className="bg-muted/50">
                        <CardContent className="p-3 text-sm">
                          <p className="font-medium">{extractedData.extractedData.customer?.name || "Unknown customer"}</p>
                          <p className="text-muted-foreground">{extractedData.extractedData.customer?.address || ""}</p>
                        </CardContent>
                      </Card>
                    </div>
                    
                    {extractedData.matchedPO && (
                      <div className="mt-4">
                        <Badge variant="outline" className="text-green-600 border-green-400 bg-green-50">
                          Matched to PO #{extractedData.matchedPO}
                        </Badge>
                      </div>
                    )}
                    
                    {extractedData.issues && extractedData.issues.length > 0 && (
                      <Alert variant="destructive" className="mt-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Issues Found</AlertTitle>
                        <AlertDescription>
                          <ul className="list-disc pl-5 mt-2 text-sm">
                            {extractedData.issues.map((issue: string, i: number) => (
                              <li key={i}>{issue}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="products" className="mt-4">
                    {extractedData.extractedData.products?.length > 0 ? (
                      <div className="space-y-3">
                        {extractedData.extractedData.products.map((product: any, index: number) => (
                          <Card key={index} className="bg-muted/50">
                            <CardContent className="p-3 text-sm">
                              <p className="font-medium">{product.description || "Unknown product"}</p>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                                <p><span className="text-muted-foreground">Lot:</span> {product.lotNumber}</p>
                                <p><span className="text-muted-foreground">Expiry:</span> {product.expiryDate}</p>
                                <p><span className="text-muted-foreground">Qty:</span> {product.quantity}</p>
                                <p><span className="text-muted-foreground">Unit:</span> ${product.unitPrice?.toFixed(2) || "0.00"}</p>
                              </div>
                              <div className="mt-2 pt-2 border-t border-border flex justify-between">
                                <span className="font-medium">Total:</span>
                                <span className="font-medium">${product.totalPrice?.toFixed(2) || "0.00"}</span>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        No product information extracted
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="json" className="mt-4">
                    <div className="bg-muted rounded-md p-4">
                      <pre className="text-xs overflow-auto max-h-96">
                        {JSON.stringify(extractedData.extractedData, null, 2)}
                      </pre>
                    </div>
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="flex flex-col items-center justify-center text-center h-64">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No Data Yet</h3>
                  <p className="text-muted-foreground mt-2 max-w-md">
                    Upload an invoice PDF to extract data using OCR technology. The system will analyze the document and extract key information.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}