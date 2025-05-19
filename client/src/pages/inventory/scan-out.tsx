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
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, PackageX, QrCode, ShoppingCart } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';

// Form schema for barcode entry
const scanProductSchema = z.object({
  barcode: z.string().min(1, "Please enter the barcode data"),
  notes: z.string().optional(),
});

type ScanProductFormValues = z.infer<typeof scanProductSchema>;

export default function ScanProductOutPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedOrder, setSelectedOrder] = useState<number | null>(null);
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

  // Fetch sales orders for dropdown
  const { data: salesOrdersData, isLoading: isLoadingOrders } = useQuery({
    queryKey: ['/api/sales-orders'],
    enabled: !!user,
  });
  
  // Extract orders array safely
  const salesOrders = salesOrdersData?.orders || [];

  // Fetch order details for selected order
  const { data: orderDetails, isLoading: isLoadingOrderDetails } = useQuery({
    queryKey: ['/api/sales-orders', selectedOrder],
    enabled: !!selectedOrder && !!user,
  });

  // Mutation for shipping a product
  const shipProductMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/inventory/ship', data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Product shipped',
        description: 'The product has been shipped and removed from available inventory',
        variant: 'default',
      });
      
      // Add to scanned items list
      setScannedItems(prev => [...prev, data]);
      setIsSuccess(true);
      
      // Reset form
      form.reset();
      
      // Clear success message after a delay
      setTimeout(() => setIsSuccess(false), 3000);
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sales-orders', selectedOrder] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to ship product',
        variant: 'destructive',
      });
    }
  });

  // Handle submit - validate and ship product
  const onSubmit = (data: ScanProductFormValues) => {
    if (!selectedOrder) {
      toast({
        title: 'Error',
        description: 'Please select a sales order',
        variant: 'destructive',
      });
      return;
    }
    
    // Process barcode data - in a real implementation, this would parse the scanner output
    // For now, we'll assume it provides a serial number
    const parsedBarcode = {
      serialNumber: data.barcode.trim(),
    };
    
    // Ship the product
    shipProductMutation.mutate({
      soId: selectedOrder,
      serialNumber: parsedBarcode.serialNumber,
      notes: data.notes,
    });
  };

  // Calculate order fulfillment percentage
  const calculateFulfillment = () => {
    if (!orderDetails?.items || orderDetails.items.length === 0) return 0;
    
    const totalItems = orderDetails.items.reduce((acc: number, item: any) => acc + item.quantity, 0);
    const shippedItems = orderDetails.items.reduce((acc: number, item: any) => acc + (item.quantityShipped || 0), 0);
    
    return Math.min(100, Math.round((shippedItems / totalItems) * 100));
  };

  const fulfillmentPercentage = orderDetails ? calculateFulfillment() : 0;

  return (
    <Layout title="Scan Product Out">
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
          <h1 className="text-2xl font-bold tracking-tight">Scan Product Out</h1>
        </div>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-lg">
              <PackageX className="h-5 w-5 mr-2 text-primary" />
              Ship Product
            </CardTitle>
            <CardDescription>
              Ship products by validating them against your available inventory
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Order selection */}
              <div>
                <FormLabel>Select Sales Order</FormLabel>
                <Select
                  value={selectedOrder?.toString() || ''}
                  onValueChange={(value) => setSelectedOrder(Number(value))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a sales order" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingOrders ? (
                      <SelectItem value="loading" disabled>Loading orders...</SelectItem>
                    ) : (
                      <>
                        <SelectItem value="" disabled>Select an order</SelectItem>
                        {salesOrders.map((order: any) => (
                          <SelectItem key={order.id} value={order.id.toString()}>
                            SO-{order.id}: {order.customerName} ({new Date(order.createdAt).toLocaleDateString()})
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-1">
                  Products will be linked to the selected sales order
                </p>
              </div>

              {/* Order progress card */}
              {selectedOrder && orderDetails && (
                <Card className="bg-muted/40">
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center">
                        <ShoppingCart className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span className="text-sm font-medium">Order #{selectedOrder}</span>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={
                          fulfillmentPercentage === 100 
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-yellow-50 text-yellow-700 border-yellow-200"
                        }
                      >
                        {fulfillmentPercentage === 100 ? "Fulfilled" : "In Progress"}
                      </Badge>
                    </div>
                    
                    {/* Progress bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Fulfillment</span>
                        <span>{fulfillmentPercentage}%</span>
                      </div>
                      <Progress value={fulfillmentPercentage} className="h-2" />
                    </div>
                    
                    {orderDetails.items && orderDetails.items.length > 0 && (
                      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                        {orderDetails.items.map((item: any, index: number) => (
                          <div key={index} className="flex justify-between">
                            <span>{item.productName || item.gtin}</span>
                            <span>{item.quantityShipped || 0} / {item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

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
                            disabled={!selectedOrder || form.formState.isSubmitting}
                            className="shrink-0"
                          >
                            {form.formState.isSubmitting ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <>
                                Validate & Ship
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
                            placeholder="Add any notes about this shipment" 
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
                      <AlertTitle className="text-green-800">Product Shipped</AlertTitle>
                      <AlertDescription className="text-green-700">
                        Successfully shipped and linked to sales order
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
            <CardTitle className="text-lg">Recently Shipped Items</CardTitle>
            <CardDescription>
              Products that have been scanned and shipped
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
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          Shipped
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
                <p className="text-sm">Paste scanner output to validate and ship products</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}