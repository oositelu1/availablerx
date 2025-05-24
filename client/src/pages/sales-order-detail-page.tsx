import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Calendar, FileText, Download, Plus, Truck, PackageCheck } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/layout/layout";

// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";


export default function SalesOrderDetailPage() {
  const [, params] = useRoute("/sales-orders/:id");
  const { toast } = useToast();
  const [currentTab, setCurrentTab] = useState("overview");
  
  // Get the sales order ID from the route
  const soId = params?.id ? parseInt(params.id) : 0;
  
  // Fetch sales order details
  const { data: salesOrder, isLoading: isLoadingSO } = useQuery({
    queryKey: [`/api/sales-orders/${soId}`],
    enabled: !!soId,
  });
  
  // Fetch linked EPCIS file details  
  const { data: linkedFiles, isLoading: isLoadingFiles } = useQuery({
    queryKey: [`/api/files/linked/${soId}`],
    enabled: !!soId && !!salesOrder?.linkedFileIds,
  });
  
  
  // Remove form setup since we're not adding items anymore
  
  // Mutation for adding a new item
  const addItemMutation = useMutation({
    mutationFn: async (values: SalesOrderItemFormValues) => {
      const response = await fetch('/api/sales-order-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add item to sales order");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/sales-order-items/so/${soId}`] });
      setAddItemDialogOpen(false);
      form.reset({
        soId: soId,
        gtin: "",
        ndc: "",
        productName: "",
        manufacturer: "",
        quantity: 1,
        lineNumber: (soItems?.length || 0) + 2,
        status: "pending",
      });
      toast({
        title: "Item Added",
        description: "The item has been successfully added to the sales order.",
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
  
  // Mutation for updating SO status
  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const response = await fetch(`/api/sales-orders/${soId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update sales order status");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/sales-orders/${soId}`] });
      toast({
        title: "Status Updated",
        description: "The sales order status has been successfully updated.",
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
  
  const onSubmit = (values: SalesOrderItemFormValues) => {
    addItemMutation.mutate(values);
  };
  
  // Calculate shipping progress based on shipped vs total
  const getTotalShippingProgress = () => {
    if (!salesOrder) return 0;
    const total = salesOrder.totalItems || 0;
    const shipped = salesOrder.totalShipped || 0;
    return total > 0 ? Math.round((shipped / total) * 100) : 0;
  };
  
  // Status badge color mapping
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'draft':
        return 'bg-gray-400';
      case 'approved':
        return 'bg-blue-500';
      case 'picking':
        return 'bg-yellow-500';
      case 'shipped':
        return 'bg-green-500';
      case 'delivered':
        return 'bg-green-700';
      case 'cancelled':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };
  
  // Handle status update
  const handleStatusUpdate = (newStatus: string) => {
    updateStatusMutation.mutate(newStatus);
  };
  
  
  if (isLoadingSO) {
    return (
      <Layout title="Sales Order Details">
        <div className="flex items-center space-x-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 gap-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout title={`Sales Order: ${salesOrder?.soNumber}`}>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Sales Order: {salesOrder?.soNumber}</h1>
            <div className="flex items-center space-x-2 mt-1">
              <Badge className={getStatusColor(salesOrder?.status)}>
                {salesOrder?.status.charAt(0).toUpperCase() + salesOrder?.status.slice(1)}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Ordered {new Date(salesOrder?.orderDate).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        <div className="flex space-x-2">
          {salesOrder?.status === 'draft' && (
            <Button onClick={() => handleStatusUpdate('approved')}>
              Approve Order
            </Button>
          )}
          {salesOrder?.status === 'approved' && (
            <Button onClick={() => handleStatusUpdate('picking')}>
              Start Picking
            </Button>
          )}
          {salesOrder?.status === 'picking' && (
            <Button onClick={() => handleStatusUpdate('shipped')}>
              <Truck className="mr-2 h-4 w-4" />
              Mark as Shipped
            </Button>
          )}
          {salesOrder?.status === 'shipped' && (
            <Button onClick={() => handleStatusUpdate('delivered')}>
              <PackageCheck className="mr-2 h-4 w-4" />
              Mark as Delivered
            </Button>
          )}
        </div>
      </div>
      
      <Tabs value={currentTab} onValueChange={setCurrentTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="items">EPCIS Files & Items</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Order Information</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="font-medium">SO Number</dt>
                  <dd>{salesOrder?.soNumber}</dd>
                  
                  <dt className="font-medium">Customer</dt>
                  <dd>{salesOrder?.customer}</dd>
                  
                  <dt className="font-medium">Customer GLN</dt>
                  <dd>{salesOrder?.customerGln || "N/A"}</dd>
                  
                  <dt className="font-medium">Order Date</dt>
                  <dd>{new Date(salesOrder?.orderDate).toLocaleDateString()}</dd>
                  
                  <dt className="font-medium">Requested Ship Date</dt>
                  <dd>{salesOrder?.requestedShipDate ? new Date(salesOrder.requestedShipDate).toLocaleDateString() : "Not specified"}</dd>
                  
                  <dt className="font-medium">Actual Ship Date</dt>
                  <dd>{salesOrder?.actualShipDate ? new Date(salesOrder.actualShipDate).toLocaleDateString() : "Not shipped yet"}</dd>
                </dl>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Shipping Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Overall Shipping Progress</span>
                      <span>{getTotalShippingProgress()}%</span>
                    </div>
                    <Progress value={getTotalShippingProgress()} />
                  </div>
                  
                  <div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <dt className="font-medium">Linked EPCIS Files</dt>
                      <dd>{salesOrder?.linkedFileIds?.length || 0}</dd>
                      
                      <dt className="font-medium">Total Shipped</dt>
                      <dd>{salesOrder?.totalShipped || 0}</dd>
                      
                      <dt className="font-medium">Ship From Location</dt>
                      <dd>{salesOrder?.shipFromLocationName || "Default Warehouse"}</dd>
                      
                      <dt className="font-medium">Ship To Location</dt>
                      <dd>{salesOrder?.shipToLocationName || "Customer Default Address"}</dd>
                    </dl>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {salesOrder?.notes && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{salesOrder.notes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="items" className="space-y-4 mt-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">Linked EPCIS Files & Products</h3>
            <div className="text-sm text-muted-foreground">
              Use "Inventory → Scan Product Out" to ship items for this order
            </div>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Linked EPCIS Files</CardTitle>
              <CardDescription>
                These files contain the products that can be scanned out for this order
              </CardDescription>
            </CardHeader>
            <CardContent>
              {salesOrder?.linkedFileIds && salesOrder.linkedFileIds.length > 0 ? (
                <div className="space-y-3">
                  {salesOrder.linkedFileIds.map((fileId: number, index: number) => (
                    <div key={fileId} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">EPCIS File #{fileId}</p>
                          <p className="text-sm text-muted-foreground">Use "Inventory → Scan Product Out" to ship items</p>
                        </div>
                      </div>
                      <Badge variant="outline">Linked</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p>No EPCIS files linked to this sales order</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
      </Tabs>
      
      {/* Add Item Dialog */}
      <Dialog open={addItemDialogOpen} onOpenChange={setAddItemDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add Line Item</DialogTitle>
            <DialogDescription>
              Add a new item to this sales order.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="lineNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Line Number</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} value={field.value || ''} onChange={e => field.onChange(parseInt(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="allocated">Allocated</SelectItem>
                          <SelectItem value="backordered">Backordered</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="gtin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GTIN</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="ndc"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>NDC (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="productName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="manufacturer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Manufacturer (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="1" 
                          {...field} 
                          value={field.value || ''}
                          onChange={e => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="packageSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Package Size (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="packageType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Package Type</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="each">Each</SelectItem>
                          <SelectItem value="case">Case</SelectItem>
                          <SelectItem value="box">Box</SelectItem>
                          <SelectItem value="pallet">Pallet</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setAddItemDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={addItemMutation.isPending}
                >
                  {addItemMutation.isPending ? "Adding..." : "Add Item"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}