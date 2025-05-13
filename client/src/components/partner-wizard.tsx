import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

// Partner wizard steps
const STEPS = [
  { id: 1, name: "Basic Info" },
  { id: 2, name: "Connection" },
  { id: 3, name: "Security" }
];

// Create form schema for each step
const step1Schema = z.object({
  name: z.string().min(2, { message: "Partner name must be at least 2 characters" }),
  partnerType: z.string().min(1, { message: "Please select a partner type" }),
  contactEmail: z.string().email({ message: "Please enter a valid email address" }),
  notes: z.string().optional(),
});

const step2Schema = z.object({
  endpointUrl: z.string().url({ message: "Please enter a valid URL" }).optional(),
  transportType: z.enum(["AS2", "HTTPS", "PRESIGNED"], { 
    required_error: "Please select a transport method" 
  }),
  as2Id: z.string().optional(),
});

const step3Schema = z.object({
  certificate: z.string().optional(),
  authToken: z.string().optional(),
});

// Combined schema
const partnerSchema = step1Schema.merge(step2Schema).merge(step3Schema);

type PartnerWizardFormValues = z.infer<typeof partnerSchema>;

interface PartnerWizardProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onPartnerAdded?: () => void;
}

export function PartnerWizard({ isOpen, setIsOpen, onPartnerAdded }: PartnerWizardProps) {
  const [step, setStep] = useState(1);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  // Initialize the form with all fields
  const form = useForm<PartnerWizardFormValues>({
    resolver: zodResolver(partnerSchema),
    defaultValues: {
      name: "",
      partnerType: "",
      contactEmail: "",
      notes: "",
      endpointUrl: "",
      transportType: "PRESIGNED",
      as2Id: "",
      certificate: "",
      authToken: "",
    },
  });

  // Mutation for creating a partner
  const createPartnerMutation = useMutation({
    mutationFn: async (data: PartnerWizardFormValues) => {
      const res = await apiRequest("POST", "/api/partners", {
        ...data,
        createdBy: user?.id,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partners"] });
      toast({
        title: "Partner added successfully",
        description: "The trading partner has been added to your network.",
      });
      setIsOpen(false);
      if (onPartnerAdded) onPartnerAdded();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add partner",
        description: error.message || "There was an error adding the partner. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Get the appropriate validation schema for the current step
  const getCurrentSchema = () => {
    switch (step) {
      case 1:
        return step1Schema;
      case 2:
        return step2Schema;
      case 3:
        return step3Schema;
      default:
        return step1Schema;
    }
  };

  // Handle next button click
  const handleNext = async () => {
    const schema = getCurrentSchema();
    
    try {
      // Validate current step fields
      await form.trigger(Object.keys(schema.shape) as any);
      
      const currentStepValid = await form.getValues(Object.keys(schema.shape) as any);
      const hasErrors = Object.keys(form.formState.errors).some(key => 
        Object.keys(schema.shape).includes(key)
      );
      
      if (!hasErrors) {
        if (step < STEPS.length) {
          setStep(step + 1);
        } else {
          // Submit the form if on the last step
          const formData = form.getValues();
          createPartnerMutation.mutate(formData);
        }
      }
    } catch (error) {
      console.error("Validation error:", error);
    }
  };

  // Handle back button click
  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  // Handle cancel button click
  const handleCancel = () => {
    form.reset();
    setStep(1);
    setIsOpen(false);
  };

  // Handle form submission
  const onSubmit = (data: PartnerWizardFormValues) => {
    if (step < STEPS.length) {
      handleNext();
    } else {
      createPartnerMutation.mutate(data);
    }
  };

  // Render progress bar
  const renderProgress = () => {
    return (
      <div className="flex items-center mb-6">
        {STEPS.map((s, index) => (
          <div key={s.id} className="flex items-center flex-1">
            <div className="flex items-center">
              <div 
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center
                  ${step >= s.id ? "bg-primary text-white" : "bg-neutral-200 text-neutral-700"}
                `}
              >
                {s.id}
              </div>
              <div className="ml-2">
                <p className="font-medium">{s.name}</p>
              </div>
            </div>
            
            {index < STEPS.length - 1 && (
              <div className="flex-1 h-1 bg-neutral-200 mx-4">
                <div 
                  className="h-1 bg-primary transition-all duration-300" 
                  style={{ width: step > s.id ? "100%" : "0%" }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Render the current step form
  const renderStepForm = () => {
    switch (step) {
      case 1:
        return (
          <>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="mb-4">
                  <FormLabel>Partner Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter the company name of your trading partner" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="partnerType"
              render={({ field }) => (
                <FormItem className="mb-4">
                  <FormLabel>Partner Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a partner type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="supplier">Supplier</SelectItem>
                      <SelectItem value="distributor">Distributor</SelectItem>
                      <SelectItem value="manufacturer">Manufacturer</SelectItem>
                      <SelectItem value="retailer">Retailer</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="contactEmail"
              render={({ field }) => (
                <FormItem className="mb-4">
                  <FormLabel>Contact Email</FormLabel>
                  <FormControl>
                    <Input 
                      type="email" 
                      placeholder="Contact person's email address" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    This email will receive connection confirmations
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem className="mb-4">
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Add any additional details about this partner" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        );
      
      case 2:
        return (
          <>
            <FormField
              control={form.control}
              name="transportType"
              render={({ field }) => (
                <FormItem className="mb-4">
                  <FormLabel>Transport Method</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex space-x-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="AS2" id="as2" />
                        <FormLabel htmlFor="as2" className="cursor-pointer">AS2</FormLabel>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="HTTPS" id="https" />
                        <FormLabel htmlFor="https" className="cursor-pointer">HTTPS</FormLabel>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="PRESIGNED" id="presigned" />
                        <FormLabel htmlFor="presigned" className="cursor-pointer">Pre-Signed URLs</FormLabel>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {form.watch("transportType") !== "PRESIGNED" && (
              <FormField
                control={form.control}
                name="endpointUrl"
                render={({ field }) => (
                  <FormItem className="mb-4">
                    <FormLabel>Endpoint URL</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="https://partner-endpoint.example.com" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      The URL where files will be sent to this partner
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            {form.watch("transportType") === "PRESIGNED" && (
              <div className="mb-4 p-4 bg-primary/5 rounded-md">
                <p className="text-sm">
                  <span className="font-medium">Pre-Signed URLs Selected:</span> Files will be shared with this partner 
                  via secure, expiring download links instead of direct transmission.
                </p>
              </div>
            )}
            
            {form.watch("transportType") === "AS2" && (
              <FormField
                control={form.control}
                name="as2Id"
                render={({ field }) => (
                  <FormItem className="mb-4">
                    <FormLabel>AS2 ID</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="PARTNER-AS2" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      The AS2 identifier for this partner
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </>
        );
      
      case 3:
        return (
          <>
            {form.watch("transportType") === "AS2" && (
              <FormField
                control={form.control}
                name="certificate"
                render={({ field }) => (
                  <FormItem className="mb-4">
                    <FormLabel>AS2 Certificate</FormLabel>
                    <FormControl>
                      <Input 
                        type="file" 
                        accept=".pem,.cert,.crt"
                        onChange={(e) => {
                          // In a real implementation, this would upload the certificate 
                          // and store the certificate path/content
                          if (e.target.files && e.target.files[0]) {
                            const fileName = e.target.files[0].name;
                            field.onChange(fileName);
                          }
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Upload the partner's public certificate for secure AS2 communication
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            {form.watch("transportType") === "HTTPS" && (
              <FormField
                control={form.control}
                name="authToken"
                render={({ field }) => (
                  <FormItem className="mb-4">
                    <FormLabel>Authentication Token</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="Basic authentication token or API key" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Used for authenticating with the partner's endpoint (optional)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            <div className="p-3 bg-neutral-100 rounded-md text-sm mt-6">
              <p className="font-medium">Connection Test</p>
              <p className="mt-2 text-neutral-700">
                After saving, you can test connectivity to ensure the partner is properly configured.
              </p>
              <Button 
                className="mt-3"
                variant="outline"
                type="button"
                disabled={true}
              >
                Send Test Ping
              </Button>
            </div>
          </>
        );
      
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold">Add New Trading Partner</DialogTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0" 
              onClick={handleCancel}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        {renderProgress()}
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            {renderStepForm()}
            
            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleCancel}
              >
                Cancel
              </Button>
              
              {step > 1 && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleBack}
                >
                  Back
                </Button>
              )}
              
              <Button 
                type={step === STEPS.length ? "submit" : "button"} 
                onClick={step < STEPS.length ? handleNext : undefined}
                disabled={createPartnerMutation.isPending}
              >
                {createPartnerMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing
                  </>
                ) : step === STEPS.length ? (
                  "Save Partner"
                ) : (
                  "Next"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
