import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Package, Filter, Calendar, Tag, ArrowDownUp } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/layout/layout";

// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function InventoryPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [packageTypeFilter, setPackageTypeFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [dateRangeFilter, setDateRangeFilter] = useState<{
    startDate: Date | null;
    endDate: Date | null;
  }>({
    startDate: null,
    endDate: null,
  });
  const [sortField, setSortField] = useState("expirationDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Fetch inventory items
  const { data, isLoading } = useQuery({
    queryKey: ['/api/inventory'],
    enabled: !!user,
  });

  // Extract items from response data and add debugging
  console.log("Raw inventory data:", data);
  const inventoryItems = data?.items || [];
  console.log("Extracted inventory items:", inventoryItems);

  // Filter inventory items based on search query and filters
  const filteredItems = inventoryItems.filter(item => {
    const matchesSearch = searchQuery === "" || 
      item.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.gtin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.productName && item.productName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.lotNumber && item.lotNumber.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const matchesPackageType = packageTypeFilter === "all" || item.packageType === packageTypeFilter;
    const matchesWarehouse = warehouseFilter === "all" || item.warehouse === warehouseFilter;
    
    // Check date range for expiration if specified
    let matchesDateRange = true;
    if (dateRangeFilter.startDate && dateRangeFilter.endDate) {
      const expirationDate = new Date(item.expirationDate);
      matchesDateRange = expirationDate >= dateRangeFilter.startDate && expirationDate <= dateRangeFilter.endDate;
    } else if (dateRangeFilter.startDate) {
      const expirationDate = new Date(item.expirationDate);
      matchesDateRange = expirationDate >= dateRangeFilter.startDate;
    } else if (dateRangeFilter.endDate) {
      const expirationDate = new Date(item.expirationDate);
      matchesDateRange = expirationDate <= dateRangeFilter.endDate;
    }
    
    return matchesSearch && matchesStatus && matchesPackageType && matchesWarehouse && matchesDateRange;
  }) || [];
  
  // Sort items based on sort field and order
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sortField === "expirationDate") {
      const dateA = new Date(a.expirationDate).getTime();
      const dateB = new Date(b.expirationDate).getTime();
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    } else if (sortField === "productName") {
      const nameA = a.productName || "";
      const nameB = b.productName || "";
      return sortOrder === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    } else if (sortField === "gtin") {
      return sortOrder === "asc" ? a.gtin.localeCompare(b.gtin) : b.gtin.localeCompare(a.gtin);
    } else if (sortField === "lotNumber") {
      const lotA = a.lotNumber || "";
      const lotB = b.lotNumber || "";
      return sortOrder === "asc" ? lotA.localeCompare(lotB) : lotB.localeCompare(lotA);
    }
    return 0;
  });

  // Get unique warehouses for filter
  const warehouses = inventoryItems ? [...new Set(inventoryItems.map(item => item.warehouse))] : [];

  // Status badge color mapping
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'available':
        return 'bg-green-500';
      case 'allocated':
        return 'bg-blue-500';
      case 'shipped':
        return 'bg-purple-500';
      case 'damaged':
        return 'bg-red-500';
      case 'expired':
        return 'bg-red-700';
      case 'quarantined':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Check if a product is close to expiration (within 90 days)
  const isCloseToExpiration = (expirationDate: string) => {
    const expDate = new Date(expirationDate);
    const now = new Date();
    const daysUntilExpiration = Math.floor((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiration <= 90 && daysUntilExpiration > 0;
  };

  // Toggle sort order
  const handleSortChange = (field: string) => {
    if (field === sortField) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Summary cards data
  const getSummaryData = () => {
    if (!inventoryItems) return { total: 0, available: 0, allocated: 0, shipped: 0, expired: 0 };
    
    return {
      total: inventoryItems.length,
      available: inventoryItems.filter(item => item.status === 'available').length,
      allocated: inventoryItems.filter(item => item.status === 'allocated').length,
      shipped: inventoryItems.filter(item => item.status === 'shipped').length,
      expired: inventoryItems.filter(item => item.status === 'expired').length,
    };
  };
  
  const summaryData = getSummaryData();

  return (
    <Layout title="Inventory">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory Management</h1>
          <p className="text-muted-foreground">Track and manage serialized pharmaceutical products</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Items</CardTitle>
          </CardHeader>
          <CardContent className="py-0 px-4">
            <div className="text-2xl font-bold">{summaryData.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Available</CardTitle>
          </CardHeader>
          <CardContent className="py-0 px-4">
            <div className="text-2xl font-bold text-green-600">{summaryData.available}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Allocated</CardTitle>
          </CardHeader>
          <CardContent className="py-0 px-4">
            <div className="text-2xl font-bold text-blue-600">{summaryData.allocated}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Shipped</CardTitle>
          </CardHeader>
          <CardContent className="py-0 px-4">
            <div className="text-2xl font-bold text-purple-600">{summaryData.shipped}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expired</CardTitle>
          </CardHeader>
          <CardContent className="py-0 px-4">
            <div className="text-2xl font-bold text-red-600">{summaryData.expired}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search inventory..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="allocated">Allocated</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="damaged">Damaged</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="quarantined">Quarantined</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={packageTypeFilter} onValueChange={setPackageTypeFilter}>
            <SelectTrigger className="w-full md:w-36">
              <SelectValue placeholder="Package Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Packages</SelectItem>
              <SelectItem value="each">Each</SelectItem>
              <SelectItem value="case">Case</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex gap-4 w-full md:w-auto">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full md:w-auto">
                <Filter className="mr-2 h-4 w-4" />
                Advanced Filters
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-4">
                <h4 className="font-medium">Filter By Warehouse</h4>
                <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Warehouses</SelectItem>
                    {warehouses.map(warehouse => (
                      <SelectItem key={warehouse} value={warehouse}>{warehouse}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <h4 className="font-medium">Expiration Date Range</h4>
                <div className="grid gap-2">
                  <div className="grid gap-1">
                    <div className="grid grid-cols-3 items-center gap-4">
                      <label htmlFor="expStartDate" className="text-sm font-medium">From</label>
                      <div className="col-span-2">
                        <DatePicker
                          date={dateRangeFilter.startDate}
                          setDate={(date) => setDateRangeFilter({...dateRangeFilter, startDate: date})}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-1">
                    <div className="grid grid-cols-3 items-center gap-4">
                      <label htmlFor="expEndDate" className="text-sm font-medium">To</label>
                      <div className="col-span-2">
                        <DatePicker
                          date={dateRangeFilter.endDate}
                          setDate={(date) => setDateRangeFilter({...dateRangeFilter, endDate: date})}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={() => setDateRangeFilter({ startDate: null, endDate: null })}
                >
                  Clear Date Filters
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          
          <Button variant="outline" onClick={() => handleSortChange(sortField)}>
            <ArrowDownUp className="mr-2 h-4 w-4" />
            {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="px-6 py-4">
          <CardTitle>Inventory Items</CardTitle>
          <CardDescription>
            {filteredItems.length} items found
            {statusFilter !== 'all' && ` with status: ${statusFilter}`}
            {packageTypeFilter !== 'all' && ` of type: ${packageTypeFilter}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px] cursor-pointer" onClick={() => handleSortChange("gtin")}>
                  GTIN {sortField === 'gtin' && (sortOrder === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSortChange("productName")}>
                  Product Name {sortField === 'productName' && (sortOrder === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead>Serial Number</TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSortChange("lotNumber")}>
                  Lot Number {sortField === 'lotNumber' && (sortOrder === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSortChange("expirationDate")}>
                  Expiration {sortField === 'expirationDate' && (sortOrder === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Location</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  </TableRow>
                ))
              ) : sortedItems.length > 0 ? (
                sortedItems.map((item) => (
                  <TableRow key={`${item.gtin}-${item.serialNumber}`}>
                    <TableCell>{item.gtin}</TableCell>
                    <TableCell>{item.productName || "Unknown Product"}</TableCell>
                    <TableCell>{item.serialNumber}</TableCell>
                    <TableCell>{item.lotNumber}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        {new Date(item.expirationDate).toLocaleDateString()}
                        {isCloseToExpiration(item.expirationDate) && (
                          <Badge className="ml-2 bg-yellow-500">Soon</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(item.status)}>
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.location ? `${item.warehouse}: ${item.location}` : item.warehouse}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    No inventory items found matching your criteria.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Layout>
  );
}