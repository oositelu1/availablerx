import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';

// Components
import { Layout } from '@/components/layout/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  ArrowUpDown,
  Calendar,
  Download,
  Loader2,
  PackageCheck,
  PackageX,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function InventoryLedgerPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState('all');
  const [sortField, setSortField] = useState('transactionDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Fetch inventory transactions
  const { data: ledgerData, isLoading } = useQuery({
    queryKey: ['/api/inventory/ledger', transactionTypeFilter, sortField, sortDirection],
    enabled: !!user,
  });

  // Extract and process ledger entries
  const ledgerEntries = ledgerData?.transactions || [];

  // Apply search filter
  const filteredEntries = ledgerEntries.filter((entry: any) => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      entry.gtin?.toLowerCase().includes(query) ||
      entry.serialNumber?.toLowerCase().includes(query) ||
      entry.lotNumber?.toLowerCase().includes(query) ||
      entry.reference?.toLowerCase().includes(query)
    );
  });

  // Helper function to format dates
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch (e) {
      return dateString;
    }
  };

  // Helper function to get badge styling based on transaction type
  const getTransactionBadge = (type: string) => {
    switch (type) {
      case 'receive':
        return {
          label: 'Received',
          class: 'bg-green-50 text-green-700 border-green-200',
          icon: <PackageCheck className="h-3 w-3 mr-1" />,
        };
      case 'ship':
        return {
          label: 'Shipped',
          class: 'bg-blue-50 text-blue-700 border-blue-200',
          icon: <PackageX className="h-3 w-3 mr-1" />,
        };
      case 'adjust':
        return {
          label: 'Adjusted',
          class: 'bg-amber-50 text-amber-700 border-amber-200',
          icon: <ArrowUpDown className="h-3 w-3 mr-1" />,
        };
      case 'expire':
        return {
          label: 'Expired',
          class: 'bg-red-50 text-red-700 border-red-200',
          icon: <Calendar className="h-3 w-3 mr-1" />,
        };
      default:
        return {
          label: type.charAt(0).toUpperCase() + type.slice(1),
          class: 'bg-gray-50 text-gray-700 border-gray-200',
          icon: null,
        };
    }
  };

  // Toggle sort direction
  const toggleSort = (field: string) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  return (
    <Layout title="Inventory Ledger">
      <div className="container mx-auto py-4 px-2 md:px-4">
        <div className="flex items-center mb-4">
          <Button 
            variant="ghost" 
            className="mr-2" 
            onClick={() => setLocation("/inventory")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Inventory Ledger</h1>
        </div>
        
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>
              Complete log of all inventory movements
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Filters and search */}
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <div className="relative w-full sm:w-auto flex-1">
                <Input
                  placeholder="Search by GTIN, serial, lot, or reference"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-8"
                />
              </div>
              
              <div className="flex gap-2">
                <Select
                  value={transactionTypeFilter}
                  onValueChange={setTransactionTypeFilter}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Transactions</SelectItem>
                    <SelectItem value="receive">Received</SelectItem>
                    <SelectItem value="ship">Shipped</SelectItem>
                    <SelectItem value="adjust">Adjustments</SelectItem>
                    <SelectItem value="expire">Expired</SelectItem>
                  </SelectContent>
                </Select>
                
                <Button variant="outline" size="icon">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Ledger table */}
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer"
                      onClick={() => toggleSort('transactionDate')}
                    >
                      <div className="flex items-center">
                        Date/Time
                        {sortField === 'transactionDate' && (
                          <ArrowUpDown className={`ml-1 h-3 w-3 ${sortDirection === 'asc' ? 'rotate-180' : ''}`} />
                        )}
                      </div>
                    </TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>GTIN</TableHead>
                    <TableHead>Serial Number</TableHead>
                    <TableHead>From Status</TableHead>
                    <TableHead>To Status</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        <Loader2 className="h-5 w-5 mx-auto animate-spin" />
                      </TableCell>
                    </TableRow>
                  ) : filteredEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        No transactions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEntries.map((entry: any) => {
                      const badge = getTransactionBadge(entry.transactionType);
                      
                      return (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium whitespace-nowrap">
                            {formatDate(entry.transactionDate)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={badge.class}>
                              <span className="flex items-center">
                                {badge.icon}
                                {badge.label}
                              </span>
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {entry.gtin}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {entry.serialNumber}
                          </TableCell>
                          <TableCell>
                            {entry.fromStatus ? (
                              <Badge variant="outline">
                                {entry.fromStatus.charAt(0).toUpperCase() + entry.fromStatus.slice(1)}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {entry.toStatus ? (
                              <Badge variant="outline">
                                {entry.toStatus.charAt(0).toUpperCase() + entry.toStatus.slice(1)}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {entry.reference ? (
                              <span className="text-xs">{entry.reference}</span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}