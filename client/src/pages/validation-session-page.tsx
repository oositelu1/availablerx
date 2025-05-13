import { useState, useEffect, useRef } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, QrCode, Camera, CheckCircle, XCircle, AlertCircle, Loader2, Clipboard } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertValidationSessionSchema, insertScannedItemSchema } from "@shared/schema";

// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

// Extend the insertValidationSessionSchema
const validationSessionSchema = z.object({
  poId: z.number().min(1, "Please select a purchase order"),
  location: z.string().min(1, "Location is required"),
  notes: z.string().optional(),
});

type ValidationSessionFormValues = z.infer<typeof validationSessionSchema>;

// Scan form schema
const scanFormSchema = z.object({
  gtin: z.string().min(1, "GTIN is required"),
  serialNumber: z.string().min(1, "Serial number is required"),
  lotNumber: z.string().min(1, "Lot number is required"),
  expirationDate: z.date(),
  rawData: z.string().min(1, "Raw barcode data is required"),
  scannedVia: z.enum(["mobile", "dedicated_scanner", "manual"]),
});

type ScanFormValues = z.infer<typeof scanFormSchema>;

export default function ValidationSessionPage() {
  const [, params] = useRoute("/purchase-orders/:id/validate");
  const { toast } = useToast();
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(true);
  const [manualScanDialogOpen, setManualScanDialogOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState("scanner");
  const [scanInput, setScanInput] = useState("");
  const scanInputRef = useRef<HTMLInputElement>(null);
  
  // Get the purchase order ID from the route
  const poId = params?.id ? parseInt(params.id) : 0;
  
  // Fetch purchase order details
  const { data: purchaseOrder, isLoading: isLoadingPO } = useQuery({
    queryKey: [`/api/purchase-orders/${poId}`],
    enabled: !!poId,
  });
  
  // Set up form for creating validation session
  const sessionForm = useForm<ValidationSessionFormValues>({
    resolver: zodResolver(validationSessionSchema),
    defaultValues: {
      poId,
      location: "",
      notes: "",
    },
  });
  
  // Set up form for manual scanning
  const scanForm = useForm<ScanFormValues>({
    resolver: zodResolver(scanFormSchema),
    defaultValues: {
      gtin: "",
      serialNumber: "",
      lotNumber: "",
      expirationDate: new Date(),
      rawData: "",
      scannedVia: "manual",
    },
  });
  
  // Create validation session
  const createSessionMutation = useMutation({
    mutationFn: async (values: ValidationSessionFormValues) => {
      const response = await fetch('/api/validation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create validation session");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setSessionId(data.id);
      setSessionStarted(true);
      setCreateDialogOpen(false);
      toast({
        title: "Validation Session Started",
        description: "You can now begin scanning product items.",
      });
      
      // Focus the scan input
      setTimeout(() => {
        if (scanInputRef.current) {
          scanInputRef.current.focus();
        }
      }, 100);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Submit scan
  const submitScanMutation = useMutation({
    mutationFn: async (scanData: any) => {
      if (!sessionId) throw new Error("No active validation session");
      
      const response = await fetch(`/api/validation/${sessionId}/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scanData),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to process scan");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/validation/${sessionId}/scans`] });
      setScanInput("");
      toast({
        title: data.matchStatus.includes("MATCH") ? "Product Matched" : "Product Not Found",
        description: getMatchDescription(data.matchStatus),
        variant: data.matchStatus.includes("MATCH") ? "default" : "destructive",
      });
      
      // Focus the scan input
      setTimeout(() => {
        if (scanInputRef.current) {
          scanInputRef.current.focus();
        }
      }, 100);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Fetch scanned items if session is active
  const { data: scannedItems, isLoading: isLoadingScans } = useQuery({
    queryKey: [`/api/validation/${sessionId}/scans`],
    enabled: !!sessionId,
    refetchInterval: 5000, // Refresh every 5 seconds
  });
  
  // Complete session
  const completeSessionMutation = useMutation({
    mutationFn: async () => {
      if (!sessionId) throw new Error("No active validation session");
      
      const response = await fetch(`/api/validation/${sessionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: "completed"
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to complete session");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Validation Complete",
        description: "The validation session has been completed successfully.",
      });
      window.location.href = `/purchase-orders/${poId}`;
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const onSubmitSession = (values: ValidationSessionFormValues) => {
    createSessionMutation.mutate(values);
  };
  
  const onSubmitScan = (values: ScanFormValues) => {
    submitScanMutation.mutate(values);
    setManualScanDialogOpen(false);
    scanForm.reset();
  };
  
  const handleScanSubmit = () => {
    if (!scanInput.trim()) return;
    
    // Simple parsing for demonstration - in a real implementation, 
    // you'd use a proper barcode parser library to extract GTIN, serial, lot, and expiration
    const mockParsedData = {
      gtin: scanInput.substring(0, 14) || "0123456789123",
      serialNumber: scanInput.substring(15, 25) || "SN" + Math.floor(Math.random() * 10000),
      lotNumber: "LOT" + Math.floor(Math.random() * 1000),
      expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      rawData: scanInput,
      scannedVia: "mobile"
    };
    
    submitScanMutation.mutate(mockParsedData);
  };
  
  // Calculate statistics
  const sessionStats = scannedItems ? {
    total: scannedItems.length,
    matched: scannedItems.filter(item => item.matchStatus.includes("MATCH")).length,
    matchedPO: scannedItems.filter(item => item.matchStatus === "MATCH_PO").length,
    matchedOther: scannedItems.filter(item => item.matchStatus === "MATCH_DIFFERENT_PO" || item.matchStatus === "MATCH_NO_PO").length,
    notFound: scannedItems.filter(item => item.matchStatus === "NO_MATCH").length,
  } : {
    total: 0,
    matched: 0,
    matchedPO: 0,
    matchedOther: 0,
    notFound: 0,
  };
  
  // Get match description
  const getMatchDescription = (matchStatus: string) => {
    switch (matchStatus) {
      case "MATCH_PO":
        return "Product found and matched to this purchase order.";
      case "MATCH_DIFFERENT_PO":
        return "Product found but associated with a different purchase order.";
      case "MATCH_NO_PO":
        return "Product found but not associated with any purchase order.";
      case "NO_MATCH":
        return "Product not found in the system.";
      default:
        return "Unknown match status.";
    }
  };
  
  // Get status badge styling
  const getStatusBadge = (matchStatus: string) => {
    switch (matchStatus) {
      case "MATCH_PO":
        return <Badge className="bg-green-500">Match</Badge>;
      case "MATCH_DIFFERENT_PO":
        return <Badge className="bg-yellow-500">Different PO</Badge>;
      case "MATCH_NO_PO":
        return <Badge className="bg-blue-500">No PO</Badge>;
      case "NO_MATCH":
        return <Badge className="bg-red-500">Not Found</Badge>;
      default:
        return <Badge className="bg-gray-500">Unknown</Badge>;
    }
  };
  
  // Focus input when tab changes to scanner
  useEffect(() => {
    if (currentTab === "scanner" && scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, [currentTab]);
  
  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <Link href={`/purchase-orders/${poId}`}>
            <Button variant="ghost" size="sm" className="mr-2">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {isLoadingPO ? <Skeleton className="h-9 w-48" /> : `Validate PO: ${purchaseOrder?.poNumber}`}
            </h1>
            <p className="text-muted-foreground">
              {sessionStarted 
                ? "Scan products to validate against EPCIS records" 
                : "Start a new validation session for this purchase order"}
            </p>
          </div>
        </div>
        
        {sessionStarted && (
          <Button 
            variant="default" 
            onClick={() => completeSessionMutation.mutate()}
            disabled={completeSessionMutation.isPending}
          >
            {completeSessionMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Completing...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Complete Session
              </>
            )}
          </Button>
        )}
      </div>
      
      {sessionStarted ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Total Scans</CardTitle>
              </CardHeader>
              <CardContent className="py-1 px-4">
                <div className="text-2xl font-bold">{sessionStats.total}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Matched to PO</CardTitle>
              </CardHeader>
              <CardContent className="py-1 px-4">
                <div className="text-2xl font-bold text-green-600">{sessionStats.matchedPO}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Other Matches</CardTitle>
              </CardHeader>
              <CardContent className="py-1 px-4">
                <div className="text-2xl font-bold text-yellow-600">{sessionStats.matchedOther}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Not Found</CardTitle>
              </CardHeader>
              <CardContent className="py-1 px-4">
                <div className="text-2xl font-bold text-red-600">{sessionStats.notFound}</div>
              </CardContent>
            </Card>
          </div>
          
          <Tabs value={currentTab} onValueChange={setCurrentTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="scanner">
                <Camera className="mr-2 h-4 w-4" />
                Scanner
              </TabsTrigger>
              <TabsTrigger value="results">
                <Clipboard className="mr-2 h-4 w-4" />
                Results
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="scanner" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Scanner</CardTitle>
                  <CardDescription>
                    Scan a barcode or enter the code manually
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        ref={scanInputRef}
                        placeholder="Scan barcode or enter manually..."
                        value={scanInput}
                        onChange={(e) => setScanInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleScanSubmit();
                          }
                        }}
                        className="text-lg p-6"
                        autoFocus
                      />
                    </div>
                    <Button onClick={handleScanSubmit} disabled={!scanInput.trim() || submitScanMutation.isPending}>
                      {submitScanMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <QrCode className="h-4 w-4" />
                      )}
                      <span className="ml-2">Submit</span>
                    </Button>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" onClick={() => setManualScanDialogOpen(true)}>
                    Manual Entry
                  </Button>
                  <div className="text-sm text-muted-foreground">
                    {scannedItems && scannedItems.length > 0 
                      ? `Last scan: ${new Date(scannedItems[0].scannedAt).toLocaleTimeString()}`
                      : 'No scans yet'}
                  </div>
                </CardFooter>
              </Card>
              
              {scannedItems && scannedItems.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Scans</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>GTIN</TableHead>
                          <TableHead>Serial</TableHead>
                          <TableHead>Time</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {scannedItems.slice(0, 5).map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.gtin}</TableCell>
                            <TableCell>{item.serialNumber}</TableCell>
                            <TableCell>{new Date(item.scannedAt).toLocaleTimeString()}</TableCell>
                            <TableCell>{getStatusBadge(item.matchStatus)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            
            <TabsContent value="results">
              <Card>
                <CardHeader>
                  <CardTitle>Validation Results</CardTitle>
                  <CardDescription>
                    All scanned items in this validation session
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingScans ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : scannedItems && scannedItems.length > 0 ? (
                    <ScrollArea className="h-[450px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>GTIN</TableHead>
                            <TableHead>Serial Number</TableHead>
                            <TableHead>Lot</TableHead>
                            <TableHead>Scan Time</TableHead>
                            <TableHead>Match Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {scannedItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.gtin}</TableCell>
                              <TableCell>{item.serialNumber}</TableCell>
                              <TableCell>{item.lotNumber}</TableCell>
                              <TableCell>{new Date(item.scannedAt).toLocaleTimeString()}</TableCell>
                              <TableCell>{getStatusBadge(item.matchStatus)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No items have been scanned yet. Switch to the Scanner tab to begin.
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <div className="w-full">
                    <div className="flex justify-between text-sm mb-2">
                      <span>Match Rate</span>
                      <span>{sessionStats.total > 0 
                        ? Math.round((sessionStats.matched / sessionStats.total) * 100) 
                        : 0}%</span>
                    </div>
                    <Progress value={sessionStats.total > 0 
                      ? (sessionStats.matched / sessionStats.total) * 100 
                      : 0} 
                      className="h-2"
                    />
                  </div>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
          
          {/* Manual Entry Dialog */}
          <Dialog open={manualScanDialogOpen} onOpenChange={setManualScanDialogOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Manual Item Entry</DialogTitle>
                <DialogDescription>
                  Enter the product details manually.
                </DialogDescription>
              </DialogHeader>
              
              <Form {...scanForm}>
                <form onSubmit={scanForm.handleSubmit(onSubmitScan)} className="space-y-4">
                  <FormField
                    control={scanForm.control}
                    name="gtin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>GTIN</FormLabel>
                        <FormControl>
                          <Input placeholder="0123456789012" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={scanForm.control}
                    name="serialNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Serial Number</FormLabel>
                        <FormControl>
                          <Input placeholder="123ABC456" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={scanForm.control}
                    name="lotNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lot Number</FormLabel>
                        <FormControl>
                          <Input placeholder="LOT12345" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={scanForm.control}
                    name="rawData"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Raw Barcode Data</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter the full barcode data if available" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <DialogFooter>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setManualScanDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={submitScanMutation.isPending}
                    >
                      {submitScanMutation.isPending ? "Processing..." : "Submit"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Start Validation Session</CardTitle>
            <CardDescription>
              Enter the details for this validation session.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...sessionForm}>
              <form onSubmit={sessionForm.handleSubmit(onSubmitSession)} className="space-y-4">
                <FormField
                  control={sessionForm.control}
                  name="poId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Order</FormLabel>
                      <FormControl>
                        <Input 
                          value={`${purchaseOrder?.poNumber || ''} (ID: ${poId})`} 
                          disabled 
                        />
                      </FormControl>
                      <FormDescription>
                        Validating products for this purchase order.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={sessionForm.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input placeholder="Warehouse A, Shipping Dock, etc." {...field} />
                      </FormControl>
                      <FormDescription>
                        Where this validation is taking place.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={sessionForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Any additional notes about this validation session" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={createSessionMutation.isPending}
                >
                  {createSessionMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting Session...
                    </>
                  ) : (
                    <>
                      <QrCode className="mr-2 h-4 w-4" />
                      Start Validation Session
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}