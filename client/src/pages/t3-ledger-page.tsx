import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Layout } from '@/components/layout/layout';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from '@/components/ui/pagination';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  ArrowUpDown, 
  Search,
  Calendar,
  Box,
  Tag,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Barcode,
  Package
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Transaction type for the ledger
interface Transaction {
  id: number;
  inventoryId: number;
  gtin: string;
  serialNumber: string;
  lotNumber: string;
  expirationDate: string;
  productName: string;
  manufacturer?: string;
  transactionType: 'receive' | 'ship';
  fromStatus: string | null;
  toStatus: string;
  reference: string;
  transactionDate: string;
  performedBy: number;
  notes?: string;
}

export default function T3LedgerPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [page, setPage] = useState(1);
  
  // Fetch inventory transactions
  const { data, isLoading, error } = useQuery<{transactions: Transaction[]}>({
    queryKey: ['/api/inventory/ledger'],
  });

  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  // Get status badge for transaction type
  const getTransactionBadge = (type: string) => {
    switch (type) {
      case 'receive':
        return (
          <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            RECEIVED
          </Badge>
        );
      case 'ship':
        return (
          <Badge className="bg-blue-100 text-blue-800 flex items-center gap-1">
            <ArrowRight className="h-3 w-3" />
            SHIPPED
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-100 text-gray-800">
            {type?.toUpperCase() || 'UNKNOWN'}
          </Badge>
        );
    }
  };

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1); // Reset to first page on new search
  };

  // Filter transactions based on search and filter type
  const filteredTransactions = data?.transactions.filter(transaction => {
    // Apply type filter
    if (filterType !== 'all' && transaction.transactionType !== filterType) {
      return false;
    }
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        transaction.gtin?.toLowerCase().includes(query) ||
        transaction.serialNumber?.toLowerCase().includes(query) ||
        transaction.lotNumber?.toLowerCase().includes(query) ||
        transaction.productName?.toLowerCase().includes(query) ||
        transaction.reference?.toLowerCase().includes(query)
      );
    }
    
    return true;
  }) || [];
  
  // Paginate transactions
  const pageSize = 10;
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);
  const totalPages = Math.ceil(filteredTransactions.length / pageSize);

  // Generate empty rows for loading state
  const emptyRows = Array(5).fill(0).map((_, i) => i);

  return (
    <Layout title="T3 Transaction Ledger">
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Transaction Ledger</h1>
            <p className="text-muted-foreground">
              Central record of all inventory transactions and T3 documents
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/t3" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                T3 Documents
              </Link>
            </Button>
            <Button asChild>
              <Link href="/t3/create" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Create T3
              </Link>
            </Button>
          </div>
        </div>
        
        {/* Filter Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Search & Filter</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search by GTIN, serial number, lot, etc."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="type-filter">Transaction Type</Label>
                <Select 
                  value={filterType} 
                  onValueChange={setFilterType}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="receive">Received</SelectItem>
                    <SelectItem value="ship">Shipped</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit">Apply Filters</Button>
            </form>
          </CardContent>
        </Card>
        
        {/* Results Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Box className="h-5 w-5" />
              Transaction Ledger
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">
                      <div className="flex items-center gap-1">
                        ID
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        Product
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        GTIN
                        <Barcode className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        Lot
                        <Tag className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        Transaction
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        Date
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    // Loading state - empty rows with shimmer effect
                    emptyRows.map((i) => (
                      <TableRow key={`loading-${i}`}>
                        <TableCell><div className="h-5 bg-muted animate-pulse rounded w-10"></div></TableCell>
                        <TableCell><div className="h-5 bg-muted animate-pulse rounded w-32"></div></TableCell>
                        <TableCell><div className="h-5 bg-muted animate-pulse rounded w-28"></div></TableCell>
                        <TableCell><div className="h-5 bg-muted animate-pulse rounded w-20"></div></TableCell>
                        <TableCell><div className="h-5 bg-muted animate-pulse rounded w-20"></div></TableCell>
                        <TableCell><div className="h-5 bg-muted animate-pulse rounded w-24"></div></TableCell>
                      </TableRow>
                    ))
                  ) : error ? (
                    // Error state
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <AlertCircle className="h-8 w-8 mb-2" />
                          <p>Failed to load transaction ledger</p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="mt-2"
                            onClick={() => window.location.reload()}
                          >
                            Try Again
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : paginatedTransactions.length === 0 ? (
                    // Empty state
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <FileText className="h-8 w-8 mb-2" />
                          <p>No transactions found</p>
                          {searchQuery || filterType !== 'all' ? (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="mt-2"
                              onClick={() => {
                                setSearchQuery('');
                                setFilterType('all');
                              }}
                            >
                              Clear Filters
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    // Data rows
                    paginatedTransactions.map((transaction) => (
                      <TableRow key={`transaction-${transaction.id}`}>
                        <TableCell className="font-medium">
                          {transaction.id}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{transaction.productName || 'Unknown Product'}</span>
                            <span className="text-xs text-muted-foreground">{transaction.serialNumber}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Barcode className="h-3 w-3 text-muted-foreground" />
                            <span className="font-mono text-xs">{transaction.gtin}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {transaction.lotNumber}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {getTransactionBadge(transaction.transactionType)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {formatDate(transaction.transactionDate)}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            
            {/* Pagination */}
            {!isLoading && !error && filteredTransactions.length > 0 && (
              <div className="mt-4">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                    {[...Array(Math.min(5, totalPages))].map((_, i) => (
                      <PaginationItem key={i}>
                        <PaginationLink
                          onClick={() => setPage(i + 1)}
                          isActive={page === i + 1}
                        >
                          {i + 1}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        className={page >= totalPages ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}