import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
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
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Plus, 
  MoreHorizontal, 
  Eye, 
  Download, 
  ArrowUpDown, 
  Search,
  Calendar,
  X,
  CheckCircle,
  AlertCircle,
  Clock
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';

export default function T3ListPage() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  
  // Fetch T3 bundles with query and pagination
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/t3/bundles', { page, search: searchQuery }],
  });

  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Get status badge color and icon
  const getStatusBadge = (status: string) => {
    let color = '';
    let icon = null;
    
    switch (status?.toLowerCase()) {
      case 'sent':
        color = 'bg-blue-100 text-blue-800';
        icon = <Clock className="h-3 w-3 mr-1" />;
        break;
      case 'delivered':
        color = 'bg-green-100 text-green-800';
        icon = <CheckCircle className="h-3 w-3 mr-1" />;
        break;
      case 'failed':
        color = 'bg-red-100 text-red-800';
        icon = <X className="h-3 w-3 mr-1" />;
        break;
      case 'pending':
        color = 'bg-yellow-100 text-yellow-800';
        icon = <Clock className="h-3 w-3 mr-1" />;
        break;
      default:
        color = 'bg-gray-100 text-gray-800';
        icon = <AlertCircle className="h-3 w-3 mr-1" />;
    }
    
    return (
      <Badge className={`${color} flex items-center`}>
        {icon}
        {status?.toUpperCase() || 'UNKNOWN'}
      </Badge>
    );
  };

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1); // Reset to first page on new search
  };

  // Generate empty rows for loading state
  const emptyRows = Array(5).fill(0).map((_, i) => i);

  return (
    <Layout title="T3 Documents">
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">T3 Documents</h1>
            <p className="text-muted-foreground">
              Manage your DSCSA Transaction Information, History, and Statements (T3)
            </p>
          </div>
          <Button asChild>
            <Link href="/t3/create" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create T3 Document
            </Link>
          </Button>
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
                  placeholder="Search by ID, partner, etc."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Button type="submit">Apply Filters</Button>
          </form>
        </CardContent>
      </Card>
      
      {/* Results Table */}
      <Card>
        <CardHeader>
          <CardTitle>T3 Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">
                    <div className="flex items-center gap-1">
                      Bundle ID
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      Date
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  // Loading state - empty rows with shimmer effect
                  emptyRows.map((i) => (
                    <TableRow key={`loading-${i}`}>
                      <TableCell><div className="h-5 bg-muted animate-pulse rounded w-20"></div></TableCell>
                      <TableCell><div className="h-5 bg-muted animate-pulse rounded w-32"></div></TableCell>
                      <TableCell><div className="h-5 bg-muted animate-pulse rounded w-28"></div></TableCell>
                      <TableCell><div className="h-5 bg-muted animate-pulse rounded w-24"></div></TableCell>
                      <TableCell><div className="h-5 bg-muted animate-pulse rounded w-20"></div></TableCell>
                      <TableCell><div className="h-5 bg-muted animate-pulse rounded w-12"></div></TableCell>
                      <TableCell className="text-right"><div className="h-8 bg-muted animate-pulse rounded w-8 ml-auto"></div></TableCell>
                    </TableRow>
                  ))
                ) : error ? (
                  // Error state
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <AlertCircle className="h-8 w-8 mb-2" />
                        <p>Failed to load T3 documents</p>
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
                ) : data?.bundles?.length === 0 ? (
                  // Empty state
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <FileText className="h-8 w-8 mb-2" />
                        <p>No T3 documents found</p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-2"
                          asChild
                        >
                          <Link href="/t3/create">Create T3 Document</Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  // Data rows
                  data?.bundles?.map((bundle: any) => (
                    <TableRow key={bundle.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          {bundle.bundleId.substring(0, 8)}...
                        </div>
                      </TableCell>
                      <TableCell>
                        {bundle.transactionInformation?.productName || 'N/A'}
                      </TableCell>
                      <TableCell>{bundle.partnerName || 'N/A'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {formatDate(bundle.generatedAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(bundle.deliveryStatus)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {bundle.format?.toUpperCase() || 'XML'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => setLocation(`/t3/${bundle.bundleId}`)}
                              className="cursor-pointer"
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => window.open(`/api/t3/download/${bundle.bundleId}`, '_blank')}
                              className="cursor-pointer"  
                            >
                              <Download className="mr-2 h-4 w-4" />
                              Download
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination */}
          {!isLoading && !error && data?.bundles?.length > 0 && (
            <div className="mt-4">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
                    />
                  </PaginationItem>
                  {[...Array(Math.min(5, data.totalPages || 1))].map((_, i) => (
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
                      onClick={() => setPage(p => p + 1)}
                      className={page >= (data.totalPages || 1) ? 'pointer-events-none opacity-50' : ''}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}