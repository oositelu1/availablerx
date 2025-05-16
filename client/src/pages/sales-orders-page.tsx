import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Calendar, FileText, Package, Plus, Search, Truck } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { insertSalesOrderSchema } from "@shared/schema";
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
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

// Form schema for creating/editing SOs
const salesOrderSchema = insertSalesOrderSchema.extend({
  orderDate: z.date(),
  requestedShipDate: z.date().nullable().optional(),
  soNumber: z.string().min(3, "SO number must be at least 3 characters"),
  customerGln: z.string().nullable().optional(),
});

type SalesOrderFormValues = z.infer<typeof salesOrderSchema>;

export default function SalesOrdersPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Define sales order interface
  interface SalesOrder {
    id: number;
    soNumber: string;
    customer: string;
    status: string;
    orderDate: string;
    // Add other fields as needed
  }
  
  // Define sales orders response interface
  interface SalesOrdersResponse {
    orders: SalesOrder[];
    total: number;
    page: number;
    limit: number;
  }

  // Fetch all sales orders
  const { data: salesOrders, isLoading } = useQuery<SalesOrdersResponse>({
    queryKey: ['/api/sales-orders'],
    enabled: !!user,
  });

  // Define partner interface
  interface Partner {
    id: number;
    name: string;
    gln: string | null;
    partnerType: string;
    // Add other fields as needed
  }

  // Fetch partners for customer selection
  const { data: partners } = useQuery<Partner[]>({
    queryKey: ['/api/partners'],
    enabled: !!user,
  });

  // Set up form for creating sales orders
  const form = useForm<SalesOrderFormValues>({
    resolver: zodResolver(salesOrderSchema),
    defaultValues: {
      soNumber: "",
      customerId: undefined,
      customerGln: null,
      orderDate: new Date(),
      requestedShipDate: null,
      status: "draft",
      notes: null,
      shipToLocationId: null,
    },
  });

  // Mutation for creating sales orders using API request helper
  const createMutation = useMutation({
    mutationFn: async (values: SalesOrderFormValues) => {
      // Validate customer selection
      if (!values.customerId || isNaN(Number(values.customerId))) {
        throw new Error("Please select a customer");
      }
      
      // Prepare minimal data required by the backend
      const payload = {
        soNumber: values.soNumber,
        customerId: Number(values.customerId),
        status: values.status || "draft",
        orderDate: values.orderDate instanceof Date 
          ? values.orderDate.toISOString().split('T')[0] // Format as YYYY-MM-DD
          : values.orderDate,
        notes: values.notes || null,
        customerGln: values.customerGln || null,
        shipToLocationId: values.shipToLocationId || null,
        requestedShipDate: values.requestedShipDate instanceof Date 
          ? values.requestedShipDate.toISOString().split('T')[0] 
          : null
      };
      
      console.log("Creating sales order with:", payload);
      
      // Use direct fetch for better error handling
      const response = await fetch('/api/sales-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        credentials: 'include'
      });
      
      if (!response.ok) {
        let errorMessage = "Failed to create sales order";
        try {
          const errorData = await response.json();
          console.error("Error creating sales order:", errorData);
          errorMessage = errorData.message || errorMessage;
          
          // Show validation errors if available
          if (errorData.errors && Array.isArray(errorData.errors)) {
            errorMessage = errorData.errors.map((e: any) => e.message || e.path).join(', ');
          }
        } catch (e) {
          // If we can't parse JSON, use the text
          const text = await response.text();
          console.error("Raw error response:", text);
          errorMessage = text || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales-orders'] });
      setCreateDialogOpen(false);
      form.reset();
      toast({
        title: "Sales Order Created",
        description: "The sales order has been successfully created.",
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

  const onSubmit = (values: SalesOrderFormValues) => {
    // Log the values for debugging
    console.log("Form values being submitted:", values);
    
    // Make sure customerId is provided and is a number
    if (!values.customerId) {
      toast({
        title: "Error",
        description: "Please select a customer",
        variant: "destructive",
      });
      return;
    }
    
    // Execute the mutation with the values
    createMutation.mutate(values);
  };

  // Extract and normalize the sales orders array from the API response
  const salesOrdersArray = salesOrders?.orders || [];
    
  // Filter sales orders based on search query and status
  const filteredSOs = salesOrdersArray.filter((so: SalesOrder) => {
    const matchesSearch = searchQuery === "" || 
      so.soNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (so.customer && so.customer.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === "all" || so.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

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

  return (
    <Layout title="Sales Orders">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales Orders</h1>
          <p className="text-muted-foreground">Manage sales orders and track inventory allocation</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create Sales Order
        </Button>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-4 items-center">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search SOs..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="picking">Picking</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="px-6 py-4">
          <CardTitle>Sales Orders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">SO Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Order Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredSOs.length > 0 ? (
                filteredSOs.map((so: SalesOrder) => (
                  <TableRow key={so.id}>
                    <TableCell className="font-medium">{so.soNumber}</TableCell>
                    <TableCell>{so.customer}</TableCell>
                    <TableCell>{new Date(so.orderDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(so.status)}>
                        {so.status.charAt(0).toUpperCase() + so.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setLocation(`/sales-orders/${so.id}`)}>
                          <FileText className="h-4 w-4" />
                          <span className="sr-only">View</span>
                        </Button>
                        {so.status === 'approved' && (
                          <Button variant="outline" size="sm" onClick={() => setLocation(`/sales-orders/${so.id}/allocate`)}>
                            <Package className="h-4 w-4" />
                            <span className="sr-only">Allocate</span>
                          </Button>
                        )}
                        {so.status === 'picking' && (
                          <Button variant="outline" size="sm" onClick={() => setLocation(`/sales-orders/${so.id}/ship`)}>
                            <Truck className="h-4 w-4" />
                            <span className="sr-only">Ship</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No sales orders found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Sales Order Dialog */}
      <Dialog 
        open={createDialogOpen} 
        onOpenChange={(open) => {
          console.log("Dialog open state changing to:", open);
          setCreateDialogOpen(open);
          // Reset form when closing dialog
          if (!open) {
            form.reset();
          }
        }}
      >
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create Sales Order</DialogTitle>
            <DialogDescription>
              Enter the sales order details. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="soNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SO Number</FormLabel>
                      <FormControl>
                        <Input placeholder="SO-12345" {...field} />
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
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="picking">Picking</SelectItem>
                          <SelectItem value="shipped">Shipped</SelectItem>
                          <SelectItem value="delivered">Delivered</SelectItem>
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
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          // Ensure we're setting a number value and not a string
                          const numericValue = parseInt(value, 10);
                          if (!isNaN(numericValue)) {
                            field.onChange(numericValue);
                            // Find the selected partner and update GLN if available
                            const selectedPartner = partners?.find(p => p.id === numericValue);
                            if (selectedPartner) {
                              form.setValue('customerGln', selectedPartner.gln || null);
                            }
                          }
                        }}
                        value={field.value !== undefined ? field.value.toString() : ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select customer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {partners?.map(partner => (
                            <SelectItem key={partner.id} value={partner.id.toString()}>
                              {partner.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Required to create a sales order
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="customerGln"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer GLN</FormLabel>
                      <FormControl>
                        <Input placeholder="0123456789012" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="orderDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Order Date</FormLabel>
                      <DatePicker 
                        date={field.value} 
                        setDate={field.onChange} 
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="requestedShipDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Requested Ship Date</FormLabel>
                      <DatePicker 
                        date={field.value} 
                        setDate={field.onChange} 
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? "Creating..." : "Create Sales Order"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}