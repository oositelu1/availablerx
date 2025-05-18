import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

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
  const { data: userData } = useQuery({
    queryKey: ['/api/user'],
    retry: false,
  });

  // Fetch all purchase orders for the dropdown
  const { data: purchaseOrdersData, isLoading: isLoadingPOs } = useQuery({
    queryKey: ['/api/purchase-orders'],
  });
  
  const purchaseOrders = purchaseOrdersData?.orders || [];

  // Set up form for associating purchase orders
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

  // Mutation for associating a PO with this file
  const associateMutation = useMutation({
    mutationFn: async (values: AssociationFormValues) => {
      if (!userData?.id) {
        throw new Error("You must be logged in to associate purchase orders");
      }
      
      console.log("Making POST request to /api/associations", {
        ...values,
        fileId,
        createdBy: userData.id
      });

      const response = await apiRequest("POST", "/api/associations", {
        ...values,
        fileId,
        createdBy: userData.id
      });
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/associations/file/${fileId}`] });
      onClose();
      toast({
        title: "Purchase Order Associated",
        description: "The purchase order has been successfully associated with this file.",
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Associate with Purchase Order</DialogTitle>
          <DialogDescription>
            Link this EPCIS file to an existing purchase order to track product items.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                      {isLoadingPOs ? (
                        <div className="flex items-center justify-center p-4">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : purchaseOrders && purchaseOrders.length > 0 ? (
                        purchaseOrders.map((po: any) => (
                          <SelectItem key={po.id} value={po.id.toString()}>
                            {po.poNumber}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="py-2 px-4 text-sm text-muted-foreground">
                          No purchase orders found
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select an existing purchase order to associate with this file.
                  </FormDescription>
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
                      <SelectItem value="direct">Direct (In EPCIS File)</SelectItem>
                      <SelectItem value="inferred_date">Inferred by Date</SelectItem>
                      <SelectItem value="inferred_gtin">Inferred by Product</SelectItem>
                      <SelectItem value="manual">Manual Association</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    How this file is related to the purchase order.
                  </FormDescription>
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
                  <FormDescription>
                    How confident are you about this association?
                  </FormDescription>
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
                    <Textarea {...field} placeholder="Optional notes about this association" />
                  </FormControl>
                  <FormDescription>
                    Additional context or details about this association.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={associateMutation.isPending}
              >
                {associateMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Associate
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}