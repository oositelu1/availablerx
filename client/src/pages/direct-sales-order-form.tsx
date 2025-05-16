import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout/layout";
import { z } from "zod";

// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function DirectSalesOrderForm() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  
  // Form state
  const [soNumber, setSoNumber] = useState("");
  const [customerId, setCustomerId] = useState<string>("");
  const [status, setStatus] = useState("draft");
  
  // Fetch partners
  const { data: partners } = useQuery({
    queryKey: ['/api/partners'],
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
        status,
        orderDate: new Date().toISOString().split('T')[0],
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
          <p className="text-muted-foreground">Enter basic sales order details</p>
        </div>
        <Button variant="outline" onClick={() => setLocation('/sales-orders')}>
          Cancel
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
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
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                disabled={isLoading}
              >
                {isLoading ? "Creating..." : "Create Sales Order"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </Layout>
  );
}