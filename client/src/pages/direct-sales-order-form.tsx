import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout/layout";
import { z } from "zod";
import { queryClient } from "@/lib/queryClient";

// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { FileText, Package } from "lucide-react";

export default function DirectSalesOrderForm() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  
  // Form state
  const [soNumber, setSoNumber] = useState("");
  const [customerId, setCustomerId] = useState<string>("");
  const [selectedFileIds, setSelectedFileIds] = useState<Set<number>>(new Set());
  
  // Fetch partners
  const { data: partners } = useQuery({
    queryKey: ['/api/partners'],
    enabled: !!user,
  });
  
  // Fetch EPCIS files
  const { data: filesData } = useQuery({
    queryKey: ['/api/files?type=epcis'],
    enabled: !!user,
  });
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!soNumber) {
      toast({
        title: "Error",
        description: "Please enter a sales order number",
        variant: "destructive",
      });
      return;
    }
    
    if (!customerId) {
      toast({
        title: "Error",
        description: "Please select a customer",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Simple payload
      const payload = {
        soNumber,
        customerId: parseInt(customerId, 10),
        status: 'approved', // Auto-approve for simplicity
        orderDate: new Date().toISOString().split('T')[0],
        linkedFileIds: Array.from(selectedFileIds)
      };
      
      console.log("Creating sales order with:", payload);
      
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
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          const text = await response.text();
          errorMessage = text || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      console.log("Sales order created:", result);
      
      toast({
        title: "Success",
        description: "Sales order created successfully",
      });
      
      // Invalidate sales orders query to refresh the list
      await queryClient.invalidateQueries({ queryKey: ['/api/sales-orders'] });
      
      // Navigate back to sales orders list
      setLocation('/sales-orders');
    } catch (error) {
      console.error("Error creating sales order:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create sales order",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Layout title="Create Sales Order">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Sales Order</h1>
          <p className="text-muted-foreground">Link EPCIS files to track outbound inventory</p>
        </div>
        <Button variant="outline" onClick={() => setLocation('/sales-orders')}>
          Cancel
        </Button>
      </div>
      
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Sales Order Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="soNumber">SO Number</Label>
                  <Input
                    id="soNumber"
                    value={soNumber}
                    onChange={(e) => setSoNumber(e.target.value)}
                    placeholder="SO-12345"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="customer">Customer</Label>
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {partners ? partners.map((partner: any) => (
                        <SelectItem key={partner.id} value={partner.id.toString()}>
                          {partner.name}
                        </SelectItem>
                      )) : (
                        <SelectItem value="loading" disabled>Loading partners...</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setLocation('/sales-orders')}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isLoading || selectedFileIds.size === 0}
                >
                  {isLoading ? "Creating..." : "Create Sales Order"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      
        {/* EPCIS Files Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select EPCIS Files</CardTitle>
            <p className="text-sm text-muted-foreground">
              Select shipment files to link with this sales order. Products from these files can be scanned out.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {selectedFileIds.size > 0 && (
                <div className="text-sm font-medium text-primary">
                  Selected files: {selectedFileIds.size}
                </div>
              )}
              <div className="grid gap-3">
                {filesData?.files ? (
                  filesData.files
                    .filter((file: any) => file.type === 'epcis')
                    .map((file: any) => {
                      const isSelected = selectedFileIds.has(file.id);
                      return (
                        <div 
                          key={file.id} 
                          className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                            isSelected ? 'border-primary bg-primary/5' : 'hover:border-gray-400'
                          }`}
                          onClick={() => {
                            const newSet = new Set(selectedFileIds);
                            if (isSelected) {
                              newSet.delete(file.id);
                            } else {
                              newSet.add(file.id);
                            }
                            setSelectedFileIds(newSet);
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <FileText className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <p className="font-medium">{file.filename}</p>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                                  <span>Uploaded: {new Date(file.uploadedAt).toLocaleDateString()}</span>
                                  {file.totalItems && <span>{file.totalItems} items</span>}
                                  {file.poNumber && <Badge variant="outline" className="text-xs">PO: {file.poNumber}</Badge>}
                                </div>
                              </div>
                            </div>
                            <Checkbox 
                              checked={isSelected}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <p className="text-sm text-muted-foreground">No EPCIS files available</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}