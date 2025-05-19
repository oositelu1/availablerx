import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';

// Components
import { Layout } from '@/components/layout/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ArrowUpDown, 
  Box, 
  Boxes, 
  Calendar, 
  ClipboardList, 
  Loader2, 
  PackageCheck, 
  PackageOpen, 
  PackageX, 
  ShoppingCart 
} from 'lucide-react';

export default function InventoryDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Fetch inventory summary
  const { data: inventoryStats, isLoading } = useQuery({
    queryKey: ['/api/inventory/stats'],
    enabled: !!user,
  });

  // Calculate stats with safe fallbacks
  const stats = {
    total: inventoryStats?.total || 0,
    available: inventoryStats?.available || 0,
    allocated: inventoryStats?.allocated || 0,
    shipped: inventoryStats?.shipped || 0,
    expired: inventoryStats?.expired || 0,
    damaged: inventoryStats?.damaged || 0,
  };

  // EPCIS file count for receiving
  const { data: filesData } = useQuery({
    queryKey: ['/api/files/count'],
    enabled: !!user,
  });
  
  // Sales order count for shipping
  const { data: salesOrdersData } = useQuery({
    queryKey: ['/api/sales-orders/count'],
    enabled: !!user,
  });

  const fileCount = filesData?.count || 0;
  const orderCount = salesOrdersData?.count || 0;

  return (
    <Layout title="Inventory">
      <div className="container mx-auto py-6 px-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Inventory Workflows</h1>
            <p className="text-muted-foreground">
              Track and manage serialized pharmaceutical inventory
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              onClick={() => setLocation('/inventory/scan-in')}
              className="flex items-center gap-2"
            >
              <PackageCheck className="h-4 w-4" />
              Scan Product In
            </Button>
            <Button 
              onClick={() => setLocation('/inventory/scan-out')}
              variant="outline"
              className="flex items-center gap-2"
            >
              <PackageX className="h-4 w-4" />
              Scan Product Out
            </Button>
          </div>
        </div>

        {/* Quick access workflow cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6">
              <div className="mb-4">
                <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center mb-4">
                  <PackageOpen className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-2xl font-bold">Receiving</h3>
                <p className="text-muted-foreground">Validate and add products to inventory</p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Available Files</p>
                  <p className="text-2xl font-bold">{fileCount}</p>
                </div>
                <Button 
                  onClick={() => setLocation('/inventory/scan-in')}
                  className="flex items-center gap-2"
                >
                  Scan Product In
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500/10 to-blue-500/5 p-6">
              <div className="mb-4">
                <div className="h-12 w-12 rounded-lg bg-blue-500/20 flex items-center justify-center mb-4">
                  <ShoppingCart className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-2xl font-bold">Shipping</h3>
                <p className="text-muted-foreground">Fulfill orders and ship products</p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Open Orders</p>
                  <p className="text-2xl font-bold">{orderCount}</p>
                </div>
                <Button 
                  onClick={() => setLocation('/inventory/scan-out')}
                  className="flex items-center gap-2"
                  variant="outline"
                >
                  Scan Product Out
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Inventory Summary */}
        <h2 className="text-xl font-bold mb-4">Inventory Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Boxes className="h-4 w-4 mr-2 text-muted-foreground" />
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="text-2xl font-bold">{stats.total}</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Available</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Box className="h-4 w-4 mr-2 text-green-600" />
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="text-2xl font-bold text-green-600">{stats.available}</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Allocated</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <ClipboardList className="h-4 w-4 mr-2 text-yellow-600" />
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="text-2xl font-bold text-yellow-600">{stats.allocated}</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Shipped</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <PackageX className="h-4 w-4 mr-2 text-blue-600" />
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="text-2xl font-bold text-blue-600">{stats.shipped}</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Expired</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-2 text-red-600" />
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="text-2xl font-bold text-red-600">{stats.expired}</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Damaged</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <PackageOpen className="h-4 w-4 mr-2 text-red-600" />
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="text-2xl font-bold text-red-600">{stats.damaged}</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Link to full inventory and ledger */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Inventory Search</CardTitle>
              <CardDescription>Search and view detailed inventory information</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setLocation('/inventory/list')}
              >
                View Full Inventory
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inventory Ledger</CardTitle>
              <CardDescription>Track all inventory movements and transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setLocation('/inventory/ledger')}
              >
                View Ledger
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}