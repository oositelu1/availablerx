import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

// Define the association method options
const associationMethods = [
  { value: "direct", label: "Direct (In EPCIS File)" },
  { value: "inferred_date", label: "Inferred by Date" },
  { value: "inferred_gtin", label: "Inferred by Product" },
  { value: "manual", label: "Manual Association" },
];

// Define the form schema
const associationSchema = z.object({
  poId: z.coerce.number().min(1, "Please select a purchase order"),
  associationMethod: z.enum(["direct", "inferred_date", "inferred_gtin", "manual"]),
  confidence: z.coerce.number().min(0).max(100),
  notes: z.string().optional(),
});

type AssociationFormValues = z.infer<typeof associationSchema>;

interface AssociatePODialogProps {
  fileId: number;
  onClose: () => void;
  children?: React.ReactNode;
}

export function AssociatePODialog({ fileId, onClose, children }: AssociatePODialogProps) {
  const { toast } = useToast();

  // Fetch user data
  const { data: user } = useQuery<{ id: number; username: string }>({
    queryKey: ['/api/user'],
  });

  // Fetch purchase orders for dropdown
  const { data: purchaseOrdersData } = useQuery<{ orders: Array<{ id: number; poNumber: string }> }>({
    queryKey: ['/api/purchase-orders'],
  });
  
  const purchaseOrders = purchaseOrdersData?.orders || [];

  // Set up form
  const form = useForm<AssociationFormValues>({
    resolver: zodResolver(associationSchema),
    defaultValues: {
      poId: 0,
      associationMethod: "manual",
      confidence: 100,
      notes: "",
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    form.reset({
      poId: 0,
      associationMethod: "manual", 
      confidence: 100,
      notes: ""
    });
  }, [form]);

  // Mutation for associating a PO with the file
  const associateMutation = useMutation({
    mutationFn: async (values: AssociationFormValues) => {
      if (!user?.id) {
        throw new Error("You must be logged in to associate purchase orders");
      }
      
      const payload = {
        ...values,
        fileId,
        createdBy: user.id
      };
      
      const response = await apiRequest("POST", "/api/associations", payload);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/associations/file/${fileId}`] });
      onClose();
      toast({
        title: "Success",
        description: "Purchase order successfully associated with this file.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to associate purchase order",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: AssociationFormValues) => {
    associateMutation.mutate(values);
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      
      <DialogContent className="w-full max-w-md overflow-hidden" aria-describedby="associate-po-description">
        <DialogHeader>
          <DialogTitle className="text-xl">Associate with Purchase Order</DialogTitle>
          <div id="associate-po-description" className="sr-only">
            Associate this EPCIS file with a purchase order
          </div>
        </DialogHeader>

        <div className="mt-4 max-h-[60vh] overflow-y-auto pr-2">
          <Form {...form}>
            <form id="associate-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="poId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Order</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(parseInt(value))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a purchase order" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {purchaseOrders.length > 0 ? (
                          purchaseOrders.map((po) => (
                            <SelectItem key={po.id} value={po.id.toString()}>
                              {po.poNumber}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="none" disabled>No purchase orders found</SelectItem>
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
                        {associationMethods.map((method) => (
                          <SelectItem key={method.value} value={method.value}>
                            {method.label}
                          </SelectItem>
                        ))}
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
                    <FormLabel>Confidence Score (0-100)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} min="0" max="100" />
                    </FormControl>
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
                      <Textarea {...field} placeholder="Optional notes about this association" rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button 
            type="submit"
            form="associate-form"
            disabled={associateMutation.isPending}
          >
            {associateMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Associate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}