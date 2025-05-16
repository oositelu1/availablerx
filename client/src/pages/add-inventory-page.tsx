import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/layout/layout";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { format } from "date-fns";

// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ArrowLeft } from "lucide-react";

// Form schema for adding inventory items
const inventoryFormSchema = z.object({
  gtin: z.string().min(1, "GTIN is required"),
  serialNumber: z.string().min(1, "Serial number is required"),
  lotNumber: z.string().min(1, "Lot number is required"),
  expirationDate: z.date({
    required_error: "Expiration date is required",
  }),
  ndc: z.string().optional(),
  productName: z.string().min(1, "Product name is required"),
  manufacturer: z.string().optional(),
  status: z.string().default("available"),
  packageType: z.string().default("each"),
  receivedVia: z.string().default("manual"),
  warehouse: z.string().default("default"),
  location: z.string().optional(),
  notes: z.string().optional(),
});

type InventoryFormValues = z.infer<typeof inventoryFormSchema>;

export default function AddInventoryPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Default form values
  const defaultValues: Partial<InventoryFormValues> = {
    status: "available",
    packageType: "each",
    receivedVia: "manual",
    warehouse: "default",
    expirationDate: new Date(new Date().setFullYear(new Date().getFullYear() + 2)) // Default to 2 years from now
  };

  // Initialize form
  const form = useForm<InventoryFormValues>({
    resolver: zodResolver(inventoryFormSchema),
    defaultValues,
  });

  // Create mutation for adding inventory
  const createInventoryMutation = useMutation({
    mutationFn: async (formData: InventoryFormValues) => {
      const result = await apiRequest("POST", "/api/inventory", {
        ...formData,
        receivedAt: new Date().toISOString()
      });
      
      if (!result.ok) {
        const errorData = await result.json();
        throw new Error(errorData.message || "Failed to create inventory item");
      }
      
      return result.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Inventory item has been added",
        variant: "default",
      });
      
      // Invalidate inventory queries and navigate back to inventory list
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      setLocation("/inventory");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Form submission handler
  const onSubmit = (data: InventoryFormValues) => {
    createInventoryMutation.mutate(data);
  };

  return (
    <Layout title="Add Inventory Item">
      <div className="container mx-auto py-6">
        <div className="flex items-center mb-6">
          <Button 
            variant="ghost" 
            className="mr-2" 
            onClick={() => setLocation("/inventory")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Inventory
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Add Inventory Item</h1>
        </div>

        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle>Inventory Details</CardTitle>
            <CardDescription>
              Add a new serialized inventory item manually.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Product Identification Section */}
                  <div className="md:col-span-2">
                    <h3 className="text-lg font-medium mb-2">Product Identification</h3>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="gtin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>GTIN*</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter GTIN" {...field} />
                        </FormControl>
                        <FormDescription>
                          Global Trade Item Number (e.g., 00300450123456)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="serialNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Serial Number*</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter serial number" {...field} />
                        </FormControl>
                        <FormDescription>
                          Unique serial number for this item
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="lotNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lot Number*</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter lot number" {...field} />
                        </FormControl>
                        <FormDescription>
                          Manufacturing lot/batch number
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="expirationDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Expiration Date*</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={
                                  !field.value ? "text-muted-foreground" : ""
                                }
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormDescription>
                          Product expiration date
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="ndc"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>NDC</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter NDC code (optional)" {...field} />
                        </FormControl>
                        <FormDescription>
                          National Drug Code (e.g., 12345-678-90)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="productName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product Name*</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter product name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="manufacturer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Manufacturer</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter manufacturer (optional)" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Status and Packaging Section */}
                  <div className="md:col-span-2 mt-6">
                    <h3 className="text-lg font-medium mb-2">Status and Packaging</h3>
                  </div>
                  
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
                            <SelectItem value="available">Available</SelectItem>
                            <SelectItem value="allocated">Allocated</SelectItem>
                            <SelectItem value="shipped">Shipped</SelectItem>
                            <SelectItem value="damaged">Damaged</SelectItem>
                            <SelectItem value="expired">Expired</SelectItem>
                            <SelectItem value="quarantined">Quarantined</SelectItem>
                          </SelectContent>
                        </Select>
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
                              <SelectValue placeholder="Select package type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="each">Item/Each</SelectItem>
                            <SelectItem value="case">Case</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Item-level or case-level packaging
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="receivedVia"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Received Via</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select received method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="manual">Manual Entry</SelectItem>
                            <SelectItem value="epcis">EPCIS File</SelectItem>
                            <SelectItem value="transfer">Internal Transfer</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Location Section */}
                  <div className="md:col-span-2 mt-6">
                    <h3 className="text-lg font-medium mb-2">Location Information</h3>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="warehouse"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Warehouse</FormLabel>
                        <FormControl>
                          <Input placeholder="Warehouse name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <Input placeholder="Specific location in warehouse (optional)" {...field} />
                        </FormControl>
                        <FormDescription>
                          Shelf, bin, or specific area
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="md:col-span-2">
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Add any additional notes about this inventory item (optional)" 
                              className="h-24"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                <div className="flex justify-end gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation("/inventory")}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createInventoryMutation.isPending}
                  >
                    {createInventoryMutation.isPending ? "Saving..." : "Add Inventory Item"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}