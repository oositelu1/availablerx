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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  
  // Fetch recent inventory transactions to maintain state
  const { data: inventoryData, isLoading: isLoadingInventory } = useQuery({
    queryKey: ['/api/inventory/ledger'],
    enabled: !!user,
    staleTime: 5000, // Update frequently
  });
  
  // Extract files array safely
  const files = filesData?.files || [];
  
  // Initialize scanned items with recent 'received' transactions on component mount
  useEffect(() => {
    if (inventoryData?.transactions) {
      const recentReceived = inventoryData.transactions
        .filter((tx: any) => tx.transactionType === 'receive')
        .sort((a: any, b: any) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 10); // Show most recent 10 items
        
      setScannedItems(recentReceived);
    }
  }, [inventoryData]);

  // Mutation for adding a product to inventory
  const addToInventoryMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/inventory/receive', data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add product to inventory');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Product received',
        description: 'The product has been added to inventory',
        variant: 'default',
      });
      
      // Add to scanned items list
      setScannedItems(prev => [data, ...prev].slice(0, 10));
      setIsSuccess(true);
      
      // Reset form
      form.reset();
      
      // Clear success message after a delay
      setTimeout(() => setIsSuccess(false), 3000);
      
      // Invalidate both inventory and ledger queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/ledger'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add product to inventory',
        variant: 'destructive',
      });
      console.error('Inventory receive error:', error);
    }
  });

  // Validation mutation
  const validateProductMutation = useMutation({
    mutationFn: async (data: { fileId: number; barcodeData: string }) => {
      const response = await apiRequest('POST', '/api/inventory/validate', data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to validate product');
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (data.validated) {
        // Add to inventory using the validated data
        const product = data.product;
        
        addToInventoryMutation.mutate({
          fileId: selectedFile as number,
          gtin: product.gtin,
          serialNumber: product.serialNumber,
          lotNumber: product.lotNumber,
          expirationDate: product.expirationDate,
          notes: form.getValues('notes'),
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Validation failed',
        description: error.message || 'Could not validate product against the file',
        variant: 'destructive',
      });
    }
  });
  
  // Handle submit - validate and receive product
  const onSubmit = (data: ScanProductFormValues) => {
    if (!selectedFile) {
      toast({
        title: 'Error',
        description: 'Please select a file to validate against',
        variant: 'destructive',
      });
      return;
    }
    
    // Parse barcode data and validate against the file
    validateProductMutation.mutate({
      fileId: selectedFile,
      barcodeData: data.barcode
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
                <label className="text-sm font-medium leading-none mb-2 block">
                  Select EPCIS File
                </label>
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
                        <SelectItem value="none" disabled>Select a file</SelectItem>
                        {files.map((file: any) => (
                          <SelectItem key={file.id} value={file.id.toString()}>
                            {file.originalName} ({new Date(file.uploadedAt).toLocaleDateString()})
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
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="text-sm font-medium leading-none mb-2 block">
                    Scanner Output
                  </label>
                  <div className="flex gap-2">
                    <Textarea 
                      {...form.register('barcode')}
                      placeholder="Paste the output from your scanner here" 
                      className="font-mono h-24 resize-none"
                    />
                  </div>
                  <div className="flex justify-between mt-2">
                    <p className="text-sm text-muted-foreground">
                      Paste the complete output from your third-party scanner
                    </p>
                    <Button 
                      type="submit" 
                      disabled={!selectedFile || addToInventoryMutation.isPending}
                      className="shrink-0"
                    >
                      {addToInventoryMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <>
                          Validate & Receive
                        </>
                      )}
                    </Button>
                  </div>
                  {form.formState.errors.barcode && (
                    <p className="text-sm font-medium text-destructive mt-1">
                      {form.formState.errors.barcode.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium leading-none mb-2 block">
                    Notes (Optional)
                  </label>
                  <Textarea 
                    {...form.register('notes')}
                    placeholder="Add any notes about this product" 
                    className="h-20"
                  />
                  {form.formState.errors.notes && (
                    <p className="text-sm font-medium text-destructive mt-1">
                      {form.formState.errors.notes.message}
                    </p>
                  )}
                </div>

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
      </div>
    </Layout>
  );
}