import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSalesOrderSchema } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// UI Components
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// Form schema for sales orders
const salesOrderSchema = insertSalesOrderSchema.extend({
  orderDate: z.date(),
  requestedShipDate: z.date().nullable().optional(),
  soNumber: z.string().min(3, "SO number must be at least 3 characters"),
  customerGln: z.string().nullable().optional(),
});

type SalesOrderFormValues = z.infer<typeof salesOrderSchema>;

interface CreateSalesOrderFormProps {
  partners: any[];
  onSuccess: () => void;
}

export function CreateSalesOrderForm({ partners, onSuccess }: CreateSalesOrderFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set up form
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

  // Handle form submission
  const handleSubmit = async (values: SalesOrderFormValues) => {
    try {
      setIsSubmitting(true);
      console.log("Creating sales order with data:", values);

      // Make sure customerId is a number
      if (!values.customerId || isNaN(Number(values.customerId))) {
        toast({
          title: "Error",
          description: "Please select a customer",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Format dates for API
      const payload = {
        soNumber: values.soNumber,
        customerId: Number(values.customerId),
        customerGln: values.customerGln || null,
        status: values.status || "draft",
        notes: values.notes || null,
        shipToLocationId: values.shipToLocationId || null,
        orderDate: values.orderDate instanceof Date 
          ? values.orderDate.toISOString().split('T')[0] 
          : values.orderDate,
        requestedShipDate: values.requestedShipDate instanceof Date 
          ? values.requestedShipDate.toISOString().split('T')[0] 
          : null,
      };

      // Post to the correct API endpoint
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
          console.error("API error:", errorData);
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          const text = await response.text();
          console.error("API error (raw):", text);
          errorMessage = text || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log("Sales order created:", result);
      
      // Update UI
      queryClient.invalidateQueries({ queryKey: ['/api/sales-orders'] });
      form.reset();
      toast({
        title: "Success",
        description: "Sales order created successfully",
      });
      onSuccess();
    } catch (error) {
      console.error("Error creating sales order:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create sales order",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
                <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    const numericValue = parseInt(value, 10);
                    if (!isNaN(numericValue)) {
                      field.onChange(numericValue);
                      // Update GLN if available
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
                <DatePicker date={field.value} setDate={field.onChange} />
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
                <DatePicker date={field.value} setDate={field.onChange} />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Enter any additional notes here" 
                  {...field} 
                  value={field.value || ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onSuccess}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Sales Order"}
          </Button>
        </div>
      </form>
    </Form>
  );
}