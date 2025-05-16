import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Calendar, FileText, Package, Plus, Search, Trash2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { insertPurchaseOrderSchema } from "@shared/schema";
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

// Form schema for creating/editing POs
const purchaseOrderSchema = insertPurchaseOrderSchema.extend({
  orderDate: z.date(),
  expectedDeliveryDate: z.date().nullable().optional(),
  poNumber: z.string().min(3, "PO number must be at least 3 characters"),
  supplierGln: z.string().min(5, "Supplier GLN must be at least 5 characters").default("0000000000000"),
  partnerId: z.union([
    z.string().min(1).transform(val => parseInt(val)),
    z.number({
      required_error: "Please select a partner",
      invalid_type_error: "Partner ID must be a number"
    })
  ]),
  customer: z.string().min(2, "Customer name must be at least 2 characters").default("Internal Customer"),
});

type PurchaseOrderFormValues = z.infer<typeof purchaseOrderSchema>;

export default function PurchaseOrdersPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Fetch all purchase orders
  const { data: purchaseOrders, isLoading } = useQuery({
    queryKey: ['/api/purchase-orders'],
    enabled: !!user,
  });

  // Fetch all partners for dropdown selection
  const { data: partners } = useQuery({
    queryKey: ['/api/partners'],
    enabled: !!user,
  });

  // Set up form for creating purchase orders
  const form = useForm<PurchaseOrderFormValues>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      poNumber: "",
      supplierGln: "0000000000000",
      customer: "Internal Customer",
      orderDate: new Date(),
      expectedDeliveryDate: null,
      status: "open",
      partnerId: undefined,
    },
  });

  // Mutation for creating a new purchase order
  const createMutation = useMutation({
    mutationFn: async (values: PurchaseOrderFormValues) => {
      console.log("Submitting PO with values:", values);
      
      if (!values.partnerId) {
        throw new Error("Please select a partner");
      }
      
      // Prepare data for submission
      const payload = {
        ...values,
        // Ensure partnerId is a number
        partnerId: Number(values.partnerId),
        // Convert orderDate to proper format if it's a Date object
        orderDate: values.orderDate instanceof Date ? values.orderDate : new Date(values.orderDate),
        // Add default ship-to location if missing
        shipToLocationId: values.shipToLocationId || null,
        // Add required supplierGln
        supplierGln: values.supplierGln || "0000000000000", // Default GLN if missing
        // Add customer
        customer: values.customer || "Internal Customer",
        // Add default status if missing
        status: values.status || "open",
        // Add the current user as creator
        createdBy: user?.id,
      };
      
      console.log("Prepared payload for submission:", payload);
      
      try {
        // Log the request information for debugging
        console.log("Sending request to:", '/api/purchase-orders');
        console.log("Request method:", 'POST');
        console.log("Request headers:", {
          'Content-Type': 'application/json',
        });
        console.log("Request body:", JSON.stringify(payload));
        
        const response = await fetch('/api/purchase-orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        
        console.log("Response status:", response.status);
        console.log("Response headers:", [...response.headers.entries()]);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("Error response text:", errorText);
          
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch (e) {
            throw new Error(`Failed with status ${response.status}: ${errorText}`);
          }
          
          throw new Error(errorData.error || "Failed to create purchase order");
        }
        
        const result = await response.json();
        console.log("Success response:", result);
        return result;
      } catch (error) {
        console.error("Error during fetch:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/purchase-orders'] });
      setCreateDialogOpen(false);
      form.reset();
      toast({
        title: "Purchase Order Created",
        description: "The purchase order has been successfully created.",
      });
    },
    onError: (error: any) => {
      console.error("Error creating purchase order:", error);
      toast({
        title: "Error",
        description: error.message || "An error occurred while creating the purchase order",
        variant: "destructive",
      });
    },
  });

  // This function is called when the form is submitted
  function onSubmit(values: PurchaseOrderFormValues) {
    console.log("Form submitted with values:", values);
    createMutation.mutate(values);
  }

  // Filter purchase orders based on search query and status
  const purchaseOrdersArray = Array.isArray(purchaseOrders) ? purchaseOrders : 
    (purchaseOrders && purchaseOrders.orders ? purchaseOrders.orders : []);
    
  const filteredPOs = purchaseOrdersArray.filter(po => {
    const matchesSearch = searchQuery === "" || 
      po.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.supplierGln.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.customer.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || po.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Status badge color mapping
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
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

  return (
    <Layout title="Purchase Orders">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Purchase Orders</h1>
          <p className="text-muted-foreground">Manage purchase orders and link them to EPCIS files</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create Purchase Order
        </Button>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-4 items-center">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search POs..."
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
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="received">Received</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="px-6 py-4">
          <CardTitle>Purchase Orders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">PO Number</TableHead>
                <TableHead>Supplier</TableHead>
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
                    <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredPOs.length > 0 ? (
                filteredPOs.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-medium">{po.poNumber}</TableCell>
                    <TableCell>{po.supplier}</TableCell>
                    <TableCell>{po.customer}</TableCell>
                    <TableCell>{new Date(po.orderDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(po.status)}>
                        {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setLocation(`/purchase-orders/${po.id}`)}>
                          <FileText className="h-4 w-4" />
                          <span className="sr-only">View</span>
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setLocation(`/purchase-orders/${po.id}/validate`)}>
                          <Package className="h-4 w-4" />
                          <span className="sr-only">Validate</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No purchase orders found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Purchase Order Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create Purchase Order</DialogTitle>
            <DialogDescription>
              Enter the purchase order details. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="poNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PO Number</FormLabel>
                      <FormControl>
                        <Input placeholder="PO-12345" {...field} />
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
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="received">Received</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
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
                  name="supplierGln"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier GLN</FormLabel>
                      <FormControl>
                        <Input placeholder="0123456789012" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="partnerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Partner</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select partner" />
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
                        Select the supplier partner for this purchase order
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="customer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Name</FormLabel>
                    <FormControl>
                      <Input placeholder="XYZ Pharmacy" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
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
                  name="expectedDeliveryDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Expected Delivery Date</FormLabel>
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
                  type="button" 
                  disabled={createMutation.isPending}
                  onClick={() => {
                    console.log("Manual submit clicked");
                    const formValues = form.getValues();
                    console.log("Form values:", formValues);
                    onSubmit(formValues);
                  }}
                >
                  {createMutation.isPending ? "Creating..." : "Create Purchase Order"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}