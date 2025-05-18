import { useState, useEffect } from "react";
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

// Create form schema for step 1
const step1Schema = z.object({
  name: z.string().min(2, { message: "Partner name must be at least 2 characters" }),
  partnerType: z.string().min(1, { message: "Please select a partner type" }),
  contactEmail: z.string().email({ message: "Please enter a valid email address" }),
  notes: z.string().optional(),
});

// Step 2 schema
const step2Schema = z.object({
  transportType: z.enum(["AS2", "HTTPS", "PRESIGNED"], { 
    required_error: "Please select a transport method" 
  }),
  endpointUrl: z.string().optional(),
  as2Id: z.string().optional(),
  as2From: z.string().optional(),
  as2To: z.string().optional(),
  as2Url: z.string().optional(),
  gln: z.string().optional(),
});

// Step 3 schema for AS2
const step3AS2Schema = z.object({
  signingCertificate: z.string().optional(),
  encryptionCertificate: z.string().optional(),
  partnerSigningCertificate: z.string().optional(),
  partnerEncryptionCertificate: z.string().optional(),
  enableEncryption: z.boolean().default(true),
  enableSigning: z.boolean().default(true),
  enableCompression: z.boolean().default(false),
  mdn: z.enum(["sync", "async", "none"]).default("sync"),
});

// Step 3 schema for HTTPS
const step3HTTPSSchema = z.object({
  authToken: z.string().optional(),
  certificate: z.string().optional(),
});

// Combined schema for final validation
const partnerSchema = z.object({
  // Basic info fields
  name: step1Schema.shape.name,
  partnerType: step1Schema.shape.partnerType,
  contactEmail: step1Schema.shape.contactEmail,
  notes: step1Schema.shape.notes,
  
  // Connection fields
  transportType: step2Schema.shape.transportType,
  endpointUrl: step2Schema.shape.endpointUrl,
  as2Id: step2Schema.shape.as2Id,
  as2From: step2Schema.shape.as2From,
  as2To: step2Schema.shape.as2To,
  as2Url: step2Schema.shape.as2Url,
  gln: step2Schema.shape.gln,
  
  // Security fields - AS2
  signingCertificate: step3AS2Schema.shape.signingCertificate,
  encryptionCertificate: step3AS2Schema.shape.encryptionCertificate,
  partnerSigningCertificate: step3AS2Schema.shape.partnerSigningCertificate,
  partnerEncryptionCertificate: step3AS2Schema.shape.partnerEncryptionCertificate,
  enableEncryption: step3AS2Schema.shape.enableEncryption,
  enableSigning: step3AS2Schema.shape.enableSigning,
  enableCompression: step3AS2Schema.shape.enableCompression,
  mdn: step3AS2Schema.shape.mdn,
  
  // Security fields - HTTPS
  certificate: step3HTTPSSchema.shape.certificate,
  authToken: step3HTTPSSchema.shape.authToken,
}).refine((data) => {
  // If transport type is not PRESIGNED, endpoint URL is required
  if (data.transportType === "HTTPS") {
    return !!data.endpointUrl && data.endpointUrl.length > 0;
  }
  return true;
}, {
  message: "Endpoint URL is required for HTTPS transport method",
  path: ["endpointUrl"]
}).refine((data) => {
  // If transport type is AS2, validate required AS2 fields
  if (data.transportType === "AS2") {
    return (
      !!data.as2From && data.as2From.length > 0 &&
      !!data.as2To && data.as2To.length > 0 &&
      !!data.as2Url && data.as2Url.length > 0
    );
  }
  return true;
}, {
  message: "AS2 From ID, AS2 To ID, and AS2 URL are required for AS2 transport method",
  path: ["as2To"]
});

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
      // Basic Info
      name: "",
      partnerType: "",
      contactEmail: "",
      notes: "",
      
      // Connection
      transportType: "PRESIGNED", // Default to Pre-Signed URLs
      endpointUrl: "",
      as2Id: "",
      as2From: "",
      as2To: "",
      as2Url: "",
      gln: "",
      
      // Security - AS2
      signingCertificate: "",
      encryptionCertificate: "",
      partnerSigningCertificate: "",
      partnerEncryptionCertificate: "",
      enableEncryption: true,
      enableSigning: true,
      enableCompression: false,
      mdn: "sync" as const,
      
      // Security - HTTPS
      certificate: "",
      authToken: "",
    },
    mode: "onChange"
  });

  // Watch for changes to transportType field
  const transportType = form.watch("transportType");
  
  // When transportType changes to PRESIGNED, clear endpoint URL validation errors
  useEffect(() => {
    if (transportType === "PRESIGNED") {
      form.clearErrors("endpointUrl");
    }
  }, [transportType, form]);
  
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
  
  // Handle next button click
  const handleNext = () => {
    // Define fields to validate based on current step and selected transport type
    let fieldsToValidate: any[] = [];
    
    if (step === 1) {
      // Basic info validation
      fieldsToValidate = ["name", "partnerType", "contactEmail"];
    } 
    else if (step === 2) {
      // Connection settings validation - different fields based on transport type
      fieldsToValidate = ["transportType"];
      
      if (transportType === "HTTPS") {
        fieldsToValidate.push("endpointUrl");
      } 
      else if (transportType === "AS2") {
        fieldsToValidate.push("as2From", "as2To", "as2Url");
      }
    } 
    else if (step === 3) {
      // Security settings validation - different fields based on transport type
      if (transportType === "HTTPS") {
        fieldsToValidate = ["authToken", "certificate"];
      } 
      else if (transportType === "AS2") {
        fieldsToValidate = ["partnerSigningCertificate", "partnerEncryptionCertificate", "mdn"];
        // Only validate signing certificate if signing is enabled
        if (form.watch("enableSigning")) {
          fieldsToValidate.push("signingCertificate");
        }
        // Only validate encryption certificate if encryption is enabled
        if (form.watch("enableEncryption")) {
          fieldsToValidate.push("encryptionCertificate");
        }
      }
    }
    
    // Trigger validation for the selected fields
    form.trigger(fieldsToValidate as any).then((isValid) => {
      if (isValid) {
        if (step < STEPS.length) {
          setStep(step + 1);
        } else {
          form.handleSubmit(onSubmit)();
        }
      }
    });
  };
  
  // Handle form submission
  const onSubmit = (data: PartnerWizardFormValues) => {
    createPartnerMutation.mutate(data);
  };
  
  // Mutation for creating a partner
  const createPartnerMutation = useMutation({
    mutationFn: async (data: PartnerWizardFormValues) => {
      // If using Pre-Signed URLs, set endpointUrl to empty string
      if (data.transportType === "PRESIGNED") {
        data.endpointUrl = "";
      }
      
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
              <>
                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-2">AS2 Security Configuration</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Configure how messages will be secured during AS2 transmission
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <FormField
                    control={form.control}
                    name="enableSigning"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <input
                            type="checkbox"
                            className="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1">
                          <FormLabel>Enable Message Signing</FormLabel>
                          <FormDescription>
                            Sign messages to verify sender authenticity
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="enableEncryption"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <input
                            type="checkbox"
                            className="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1">
                          <FormLabel>Enable Encryption</FormLabel>
                          <FormDescription>
                            Encrypt messages for secure transmission
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <FormField
                    control={form.control}
                    name="enableCompression"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <input
                            type="checkbox"
                            className="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1">
                          <FormLabel>Enable Compression</FormLabel>
                          <FormDescription>
                            Compress data before transmission
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="mdn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>MDN (Receipt) Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select MDN type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="sync">Synchronous</SelectItem>
                            <SelectItem value="async">Asynchronous</SelectItem>
                            <SelectItem value="none">None</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          How to receive Message Disposition Notifications
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                {form.watch("enableSigning") && (
                  <FormField
                    control={form.control}
                    name="signingCertificate"
                    render={({ field }) => (
                      <FormItem className="mb-4">
                        <FormLabel>Your Signing Certificate</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Paste your PEM-encoded signing certificate"
                            className="font-mono text-xs h-32"
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Certificate used to sign outgoing messages
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                {form.watch("enableEncryption") && (
                  <FormField
                    control={form.control}
                    name="encryptionCertificate"
                    render={({ field }) => (
                      <FormItem className="mb-4">
                        <FormLabel>Your Encryption Certificate</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Paste your PEM-encoded encryption certificate"
                            className="font-mono text-xs h-32"
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Certificate used to decrypt incoming messages
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                <FormField
                  control={form.control}
                  name="partnerSigningCertificate"
                  render={({ field }) => (
                    <FormItem className="mb-4">
                      <FormLabel>Partner's Signing Certificate</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Paste your partner's PEM-encoded signing certificate"
                          className="font-mono text-xs h-32"
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Certificate to verify signatures from partner
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="partnerEncryptionCertificate"
                  render={({ field }) => (
                    <FormItem className="mb-4">
                      <FormLabel>Partner's Encryption Certificate</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Paste your partner's PEM-encoded encryption certificate"
                          className="font-mono text-xs h-32"
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Certificate to encrypt messages to partner
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
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
