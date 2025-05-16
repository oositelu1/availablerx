import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/layout/layout";
import { format } from "date-fns";
import { 
  Search, 
  Filter, 
  Package, 
  AlertTriangle, 
  Calendar, 
  Warehouse, 
  ArrowDownUp, 
  FileText 
} from "lucide-react";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function InventoryPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [packageTypeFilter, setPackageTypeFilter] = useState("all");
  const [expirationFilter, setExpirationFilter] = useState("all");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [itemDetailsOpen, setItemDetailsOpen] = useState(false);
  const [sortField, setSortField] = useState("receivedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Fetch inventory items
  const { data: inventoryItems, isLoading, error } = useQuery({
    queryKey: ['/api/inventory', statusFilter, packageTypeFilter, expirationFilter],
    enabled: !!user,
  });

  // Function to filter inventory items based on search query and filters
  const getFilteredItems = () => {
    if (!inventoryItems) return [];
    
    const filters: any = {};
    
    if (statusFilter !== "all") {
      filters.status = statusFilter;
    }
    
    if (packageTypeFilter !== "all") {
      filters.packageType = packageTypeFilter;
    }
    
    if (expirationFilter === "expiringSoon") {
      // Items expiring within 90 days
      const ninetyDaysFromNow = new Date();
      ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
      filters.expirationDateBefore = ninetyDaysFromNow.toISOString();
    } else if (expirationFilter === "expired") {
      // Already expired items
      const today = new Date();
      filters.expirationDateBefore = today.toISOString();
    }
    
    let filtered = Array.isArray(inventoryItems) 
      ? inventoryItems
      : [];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.gtin?.toLowerCase().includes(query) ||
        item.serialNumber?.toLowerCase().includes(query) ||
        item.lotNumber?.toLowerCase().includes(query) ||
        item.productName?.toLowerCase().includes(query) ||
        item.ndc?.toLowerCase().includes(query)
      );
    }
    
    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];
      
      // Handle dates
      if (sortField === "expirationDate" || sortField === "receivedAt") {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }
      
      // Handle strings
      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortOrder === "asc" 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      // Handle numbers and dates
      return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
    });
    
    return filtered;
  };

  // Get inventory statistics
  const getInventoryStats = () => {
    if (!inventoryItems || !Array.isArray(inventoryItems)) return {
      total: 0,
      available: 0,
      allocated: 0,
      expiringSoon: 0,
      expired: 0
    };
    
    const today = new Date();
    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(today.getDate() + 90);
    
    return {
      total: inventoryItems.length,
      available: inventoryItems.filter(item => item.status === "available").length,
      allocated: inventoryItems.filter(item => item.status === "allocated").length,
      expiringSoon: inventoryItems.filter(item => {
        const expDate = new Date(item.expirationDate);
        return expDate > today && expDate <= ninetyDaysFromNow;
      }).length,
      expired: inventoryItems.filter(item => {
        const expDate = new Date(item.expirationDate);
        return expDate <= today;
      }).length
    };
  };

  // Calculate expiration warning
  const getExpirationWarning = (expirationDate: string) => {
    const today = new Date();
    const expDate = new Date(expirationDate);
    const daysUntilExpiration = Math.floor((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiration < 0) {
      return { severity: "critical", message: "Expired" };
    } else if (daysUntilExpiration <= 30) {
      return { severity: "high", message: "< 30 days" };
    } else if (daysUntilExpiration <= 90) {
      return { severity: "medium", message: "< 90 days" };
    } else {
      return { severity: "none", message: "" };
    }
  };

  // Function to get badge color based on status
  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'available':
        return 'bg-green-500';
      case 'allocated':
        return 'bg-yellow-500';
      case 'shipped':
        return 'bg-blue-500';
      case 'damaged':
        return 'bg-red-500';
      case 'expired':
        return 'bg-red-700';
      case 'quarantined':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };
  
  const filteredItems = getFilteredItems();
  const stats = getInventoryStats();

  return (
    <Layout title="Inventory">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory Management</h1>
          <p className="text-muted-foreground">Track and manage serialized pharmaceutical inventory</p>
        </div>
        <Button onClick={() => window.location.href = '/inventory/add'}>
          Add Inventory Item
        </Button>
      </div>
      
      {/* Inventory Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-base font-medium">Total Items</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-base font-medium">Available</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl font-bold text-green-600">{stats.available}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-base font-medium">Allocated</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl font-bold text-yellow-600">{stats.allocated}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-base font-medium">Expiring Soon</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl font-bold text-amber-600">{stats.expiringSoon}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-base font-medium">Expired</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by GTIN, Serial, Lot, NDC..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 md:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="allocated">Allocated</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="damaged">Damaged</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="quarantined">Quarantined</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={packageTypeFilter} onValueChange={setPackageTypeFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Package Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Packages</SelectItem>
              <SelectItem value="each">Item/Each</SelectItem>
              <SelectItem value="case">Case</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={expirationFilter} onValueChange={setExpirationFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Expiration" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Dates</SelectItem>
              <SelectItem value="expiringSoon">Expiring Soon (90 days)</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Inventory Table */}
      <Card>
        <CardHeader className="px-6 py-4">
          <CardTitle>Serialized Inventory</CardTitle>
          <CardDescription>
            {filteredItems.length} items {searchQuery && `matching "${searchQuery}"`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">
                  <button 
                    className="flex items-center"
                    onClick={() => {
                      if (sortField === "gtin") {
                        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                      } else {
                        setSortField("gtin");
                        setSortOrder("asc");
                      }
                    }}
                  >
                    GTIN
                    {sortField === "gtin" && (
                      <ArrowDownUp className={`ml-1 h-4 w-4 ${sortOrder === "asc" ? "rotate-180" : ""}`} />
                    )}
                  </button>
                </TableHead>
                <TableHead>
                  <button 
                    className="flex items-center"
                    onClick={() => {
                      if (sortField === "serialNumber") {
                        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                      } else {
                        setSortField("serialNumber");
                        setSortOrder("asc");
                      }
                    }}
                  >
                    Serial
                    {sortField === "serialNumber" && (
                      <ArrowDownUp className={`ml-1 h-4 w-4 ${sortOrder === "asc" ? "rotate-180" : ""}`} />
                    )}
                  </button>
                </TableHead>
                <TableHead>
                  <button 
                    className="flex items-center"
                    onClick={() => {
                      if (sortField === "lotNumber") {
                        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                      } else {
                        setSortField("lotNumber");
                        setSortOrder("asc");
                      }
                    }}
                  >
                    Lot
                    {sortField === "lotNumber" && (
                      <ArrowDownUp className={`ml-1 h-4 w-4 ${sortOrder === "asc" ? "rotate-180" : ""}`} />
                    )}
                  </button>
                </TableHead>
                <TableHead>
                  <button 
                    className="flex items-center"
                    onClick={() => {
                      if (sortField === "expirationDate") {
                        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                      } else {
                        setSortField("expirationDate");
                        setSortOrder("asc");
                      }
                    }}
                  >
                    Expiration
                    {sortField === "expirationDate" && (
                      <ArrowDownUp className={`ml-1 h-4 w-4 ${sortOrder === "asc" ? "rotate-180" : ""}`} />
                    )}
                  </button>
                </TableHead>
                <TableHead>Product</TableHead>
                <TableHead>
                  <button 
                    className="flex items-center"
                    onClick={() => {
                      if (sortField === "status") {
                        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                      } else {
                        setSortField("status");
                        setSortOrder("asc");
                      }
                    }}
                  >
                    Status
                    {sortField === "status" && (
                      <ArrowDownUp className={`ml-1 h-4 w-4 ${sortOrder === "asc" ? "rotate-180" : ""}`} />
                    )}
                  </button>
                </TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredItems.length > 0 ? (
                filteredItems.map((item) => {
                  const expWarning = getExpirationWarning(item.expirationDate);
                  
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.gtin}</TableCell>
                      <TableCell>{item.serialNumber}</TableCell>
                      <TableCell>{item.lotNumber}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center">
                          {format(new Date(item.expirationDate), 'yyyy-MM-dd')}
                          {expWarning.severity !== "none" && (
                            <AlertTriangle 
                              className={`ml-1 h-4 w-4 ${
                                expWarning.severity === "critical" ? "text-red-500" :
                                expWarning.severity === "high" ? "text-amber-500" :
                                "text-yellow-500"
                              }`} 
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{item.productName || 'N/A'}</span>
                          {item.ndc && <span className="text-xs text-muted-foreground">NDC: {item.ndc}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBadgeColor(item.status)}>
                          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{item.warehouse}</span>
                          {item.location && <span className="text-xs text-muted-foreground">{item.location}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            setSelectedItem(item);
                            setItemDetailsOpen(true);
                          }}
                        >
                          <FileText className="h-4 w-4" />
                          <span className="sr-only">View</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    No inventory items found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Item Details Dialog */}
      {selectedItem && (
        <Dialog open={itemDetailsOpen} onOpenChange={setItemDetailsOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Inventory Item Details</DialogTitle>
              <DialogDescription>
                Detailed information about this inventory item
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-2">Product Information</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">GTIN:</span>
                    <span className="font-medium">{selectedItem.gtin}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Serial Number:</span>
                    <span className="font-medium">{selectedItem.serialNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lot Number:</span>
                    <span className="font-medium">{selectedItem.lotNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expiration Date:</span>
                    <span className="font-medium">{format(new Date(selectedItem.expirationDate), 'yyyy-MM-dd')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">NDC:</span>
                    <span className="font-medium">{selectedItem.ndc || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Product Name:</span>
                    <span className="font-medium">{selectedItem.productName || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Manufacturer:</span>
                    <span className="font-medium">{selectedItem.manufacturer || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Package Type:</span>
                    <span className="font-medium">{selectedItem.packageType}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Tracking Information</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge className={getStatusBadgeColor(selectedItem.status)}>
                      {selectedItem.status.charAt(0).toUpperCase() + selectedItem.status.slice(1)}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Warehouse:</span>
                    <span className="font-medium">{selectedItem.warehouse}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location:</span>
                    <span className="font-medium">{selectedItem.location || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Received Via:</span>
                    <span className="font-medium">{selectedItem.receivedVia}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Received At:</span>
                    <span className="font-medium">{format(new Date(selectedItem.receivedAt), 'yyyy-MM-dd HH:mm')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Source PO:</span>
                    <span className="font-medium">{selectedItem.sourcePoId || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Source File:</span>
                    <span className="font-medium">{selectedItem.sourceFileId || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Scanned:</span>
                    <span className="font-medium">
                      {selectedItem.lastScannedAt 
                        ? format(new Date(selectedItem.lastScannedAt), 'yyyy-MM-dd HH:mm')
                        : 'Never'
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button onClick={() => setItemDetailsOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  );
}