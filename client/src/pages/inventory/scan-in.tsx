import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

// Components
import { Layout } from '@/components/layout/layout';
import ProductValidationDialog from '@/components/product-validation-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, PackageCheck, QrCode } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Form schema for barcode entry
const scanProductSchema = z.object({
  barcode: z.string().min(1, "Please enter the barcode data"),
  notes: z.string().optional(),
});

type ScanProductFormValues = z.infer<typeof scanProductSchema>;

export default function ScanProductInPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [validationOpen, setValidationOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<number | null>(null);
  const [scannedItems, setScannedItems] = useState<any[]>([]);
  const [isSuccess, setIsSuccess] = useState(false);

  // Form for manual barcode entry
  const form = useForm<ScanProductFormValues>({
    resolver: zodResolver(scanProductSchema),
    defaultValues: {
      barcode: '',
      notes: '',
    },
  });

  // Fetch files for dropdown
  const { data: filesData, isLoading: isLoadingFiles } = useQuery({
    queryKey: ['/api/files'],
    enabled: !!user,
  });
  
  // Extract files array safely
  const files = filesData?.files || [];

  // Fetch product items for a selected file
  const { data: productItemsData, isLoading: isLoadingProductItems } = useQuery({
    queryKey: ['/api/product-items/file', selectedFile],
    enabled: !!selectedFile && !!user,
  });
  
  // Fetch file metadata
  const { data: fileMetadata, isLoading: isLoadingFileMetadata } = useQuery({
    queryKey: ['/api/files', selectedFile],
    enabled: !!selectedFile && !!user,
  });

  // Mutation for adding a product to inventory
  const addToInventoryMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/inventory/receive', data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Product received',
        description: 'The product has been added to inventory',
        variant: 'default',
      });
      // Add to scanned items list
      setScannedItems(prev => [...prev, data]);
      setIsSuccess(true);
      // Reset form
      form.reset();
      // Clear success message after a delay
      setTimeout(() => setIsSuccess(false), 3000);
      // Invalidate inventory queries
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add product to inventory',
        variant: 'destructive',
      });
    }
  });

  // Handle submit - open validation dialog with barcode data
  const onSubmit = (data: ScanProductFormValues) => {
    if (!selectedFile) {
      toast({
        title: 'Error',
        description: 'Please select a file to validate against',
        variant: 'destructive',
      });
      return;
    }
    
    // Set form values to be accessed later
    form.setValue('barcode', data.barcode);
    
    // Open validation dialog
    setValidationOpen(true);
  };

  // Handle successful validation
  const handleValidationSuccess = (validatedItem: any) => {
    if (!validatedItem || !selectedFile) return;
    
    setValidationOpen(false);
    
    // Add to inventory
    addToInventoryMutation.mutate({
      fileId: selectedFile,
      gtin: validatedItem.gtin,
      serialNumber: validatedItem.serialNumber,
      lotNumber: validatedItem.lotNumber,
      expirationDate: validatedItem.expirationDate,
      notes: form.getValues().notes,
    });
  };

  return (
    <Layout title="Scan Product In">
      <div className="container mx-auto py-4 px-2 md:px-4 max-w-4xl">
        <div className="flex items-center mb-4">
          <Button 
            variant="ghost" 
            className="mr-2" 
            onClick={() => setLocation("/inventory")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Scan Product In</h1>
        </div>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-lg">
              <PackageCheck className="h-5 w-5 mr-2 text-primary" />
              Receive Product
            </CardTitle>
            <CardDescription>
              Validate and add products to inventory
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* File selection */}
              <div>
                <FormLabel>Select EPCIS File</FormLabel>
                <Select
                  value={selectedFile?.toString() || ''}
                  onValueChange={(value) => setSelectedFile(Number(value))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a file to validate against" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingFiles ? (
                      <SelectItem value="loading" disabled>Loading files...</SelectItem>
                    ) : (
                      <>
                        <SelectItem value="" disabled>Select a file</SelectItem>
                        {files.map((file: any) => (
                          <SelectItem key={file.id} value={file.id.toString()}>
                            {file.originalName} ({new Date(file.createdAt).toLocaleDateString()})
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-1">
                  Products will be validated against the selected EPCIS file
                </p>
              </div>

              {/* Form */}
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="barcode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Scanner Output</FormLabel>
                        <div className="flex gap-2">
                          <FormControl>
                            <Textarea 
                              placeholder="Paste the output from your scanner here" 
                              {...field} 
                              className="font-mono h-24 resize-none"
                            />
                          </FormControl>
                        </div>
                        <div className="flex justify-between mt-2">
                          <FormDescription>
                            Paste the complete output from your third-party scanner
                          </FormDescription>
                          <Button 
                            type="submit" 
                            disabled={!selectedFile || form.formState.isSubmitting}
                            className="shrink-0"
                          >
                            {form.formState.isSubmitting ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <>
                                Validate & Receive
                              </>
                            )}
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes (Optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Add any notes about this product" 
                            className="h-20"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {isSuccess && (
                    <Alert className="bg-green-50 border-green-200">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertTitle className="text-green-800">Product Added to Inventory</AlertTitle>
                      <AlertDescription className="text-green-700">
                        Successfully received and added to inventory
                      </AlertDescription>
                    </Alert>
                  )}
                </form>
              </Form>
            </div>
          </CardContent>
        </Card>

        {/* Recently scanned items */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Recently Received Items</CardTitle>
            <CardDescription>
              Products that have been scanned and added to inventory
            </CardDescription>
          </CardHeader>
          <CardContent>
            {scannedItems.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>GTIN</TableHead>
                    <TableHead>Serial Number</TableHead>
                    <TableHead>Lot</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scannedItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-xs">{item.gtin}</TableCell>
                      <TableCell className="font-mono text-xs">{item.serialNumber}</TableCell>
                      <TableCell>{item.lotNumber}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          Available
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <QrCode className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p>No products scanned yet</p>
                <p className="text-sm">Paste scanner output to validate and receive products</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Product Validation Dialog */}
        {selectedFile && (
          <ProductValidationDialog
            isOpen={validationOpen}
            onClose={() => setValidationOpen(false)}
            productItems={productItemsData || []}
            fileMetadata={fileMetadata}
          />
        )}
      </div>
    </Layout>
  );
}