import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ArrowLeft, ShieldCheck, History, FileText } from "lucide-react";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";

// Define the form schema
const createT3Schema = z.object({
  inventoryTransactionId: z.string().min(1, "Select an inventory transaction"),
  partnerId: z.string().min(1, "Select a trading partner"),
  format: z.enum(["xml", "json", "pdf"]).default("xml"),
  deliveryMethod: z.enum(["as2", "https", "presigned_url"]).default("as2"),
  referenceNumber: z.string().optional(),
  purchaseOrderNumber: z.string().optional(),
  invoiceNumber: z.string().optional(),
  includeCompleteHistory: z.boolean().default(true),
  includeStandardStatement: z.boolean().default(true),
  additionalNotes: z.string().optional(),
});

type CreateT3FormValues = z.infer<typeof createT3Schema>;

export default function T3CreatePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Get recent inventory transactions for dropdown
  const { data: inventoryData, isLoading: isLoadingInventory } = useQuery({
    queryKey: ['/api/inventory/ledger'],
  });
  
  // Get partners for dropdown
  const { data: partnersData, isLoading: isLoadingPartners } = useQuery({
    queryKey: ['/api/partners'],
  });
  
  // Set up form
  const form = useForm<CreateT3FormValues>({
    resolver: zodResolver(createT3Schema),
    defaultValues: {
      inventoryTransactionId: "",
      partnerId: "",
      format: "xml",
      deliveryMethod: "as2",
      includeCompleteHistory: true,
      includeStandardStatement: true,
    },
  });
  
  // Create T3 document mutation
  const createT3Mutation = useMutation({
    mutationFn: async (values: CreateT3FormValues) => {
      // Convert string IDs to numbers
      const payload = {
        ...values,
        inventoryTransactionId: parseInt(values.inventoryTransactionId),
        partnerId: parseInt(values.partnerId),
      };
      const res = await apiRequest('POST', '/api/t3/create', payload);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "T3 Document Created",
        description: `Successfully created T3 document ${data.bundleId}`,
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/t3/bundles'] });
      
      // Navigate to the created document
      navigate(`/t3/${data.bundleId}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create T3 document",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Handle form submission
  const onSubmit = (values: CreateT3FormValues) => {
    createT3Mutation.mutate(values);
  };
  
  // Get transactions
  const transactions = inventoryData?.transactions || [];
  
  // Get partners
  const partners = partnersData?.partners || [];
  
  return (
    <div className="container mx-auto py-6 space-y-8">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/t3">T3 Documents</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Create</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create T3 Document</h1>
          <p className="text-muted-foreground">
            Generate a new T3 (TI, TH, TS) for DSCSA compliance
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/t3')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to T3 Documents
        </Button>
      </div>
      
      {/* Create T3 Form */}
      <Card>
        <CardHeader>
          <CardTitle>T3 Document Required by DSCSA</CardTitle>
          <CardDescription>
            Complete all fields to create a DSCSA-compliant Transaction Information, Transaction History, and Transaction Statement (T3)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-md mb-6 text-sm">
            <p className="font-medium text-amber-800">Important Compliance Notice:</p>
            <p className="mt-1 text-amber-700">
              Per FDA regulations under DSCSA, all transactions of covered pharmaceutical products must be accompanied by Transaction Information (TI), 
              Transaction History (TH), and Transaction Statement (TS). Failure to provide compliant documentation may result in regulatory penalties.
            </p>
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Inventory Transaction Selection */}
              <FormField
                control={form.control}
                name="inventoryTransactionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Inventory Transaction</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                      disabled={isLoadingInventory}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an inventory transaction" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {transactions.length === 0 ? (
                          <SelectItem value="no-transactions" disabled>
                            No transactions available
                          </SelectItem>
                        ) : (
                          transactions.map((transaction: any) => (
                            <SelectItem key={transaction.id} value={transaction.id.toString()}>
                              {transaction.id} - {transaction.productName} ({transaction.lotNumber})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      The inventory transaction to associate with this T3 document
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Trading Partner Selection */}
              <FormField
                control={form.control}
                name="partnerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trading Partner</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                      disabled={isLoadingPartners}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a trading partner" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {partners.length === 0 ? (
                          <SelectItem value="no-partners" disabled>
                            No partners available
                          </SelectItem>
                        ) : (
                          partners.map((partner: any) => (
                            <SelectItem key={partner.id} value={partner.id.toString()}>
                              {partner.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      The trading partner who will receive this T3 document
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* File Format */}
              <FormField
                control={form.control}
                name="format"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Format</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a format" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="xml">XML</SelectItem>
                        <SelectItem value="json">JSON</SelectItem>
                        <SelectItem value="pdf">PDF</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      The file format for the T3 document
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Delivery Method */}
              <FormField
                control={form.control}
                name="deliveryMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Method</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a delivery method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="as2">AS2 Transfer</SelectItem>
                        <SelectItem value="https">HTTPS API</SelectItem>
                        <SelectItem value="presigned_url">Pre-signed URL</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      How the T3 document will be delivered to the trading partner
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Reference Information Section */}
              <div className="border p-4 rounded-md bg-muted/20 space-y-4">
                <h3 className="text-md font-medium">Transaction References</h3>
                
                {/* Reference Number */}
                <FormField
                  control={form.control}
                  name="referenceNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reference Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., REF-12345" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormDescription>
                        A unique reference number for this transaction
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Purchase Order */}
                <FormField
                  control={form.control}
                  name="purchaseOrderNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Order Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., PO-78910" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormDescription>
                        Related purchase order number, if applicable
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Invoice Number */}
                <FormField
                  control={form.control}
                  name="invoiceNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., INV-54321" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormDescription>
                        Related invoice number, if applicable
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* DSCSA Compliance Options */}
              <div className="border p-4 rounded-md bg-primary/5 space-y-4">
                <h3 className="text-md font-medium flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  DSCSA Compliance Options
                </h3>
                
                {/* Include Complete History */}
                <FormField
                  control={form.control}
                  name="includeCompleteHistory"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="flex items-center gap-2">
                          <History className="h-4 w-4" />
                          Include Complete Transaction History
                        </FormLabel>
                        <FormDescription>
                          Includes the full chain of ownership from manufacturer to current ownership
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
                
                {/* Include Standard Statement */}
                <FormField
                  control={form.control}
                  name="includeStandardStatement"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Include Standard Transaction Statement
                        </FormLabel>
                        <FormDescription>
                          Includes the standard FDCA Sec. 581 (27) (A)-(G) compliance statement
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              {/* Additional Notes */}
              <FormField
                control={form.control}
                name="additionalNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Any special notes or instructions" 
                        {...field} 
                        value={field.value || ""} 
                        className="min-h-[80px]"
                      />
                    </FormControl>
                    <FormDescription>
                      Optional notes to include with this T3 document
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Submit Button */}
              <div className="flex justify-end">
                <Button 
                  type="submit" 
                  disabled={createT3Mutation.isPending}
                  className="w-full md:w-auto"
                >
                  {createT3Mutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create T3 Document
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}