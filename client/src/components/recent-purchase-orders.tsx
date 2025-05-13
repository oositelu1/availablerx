import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function RecentPurchaseOrders({ limit = 5 }: { limit?: number }) {
  const [, setLocation] = useLocation();
  
  // Fetch purchase orders
  const { data: purchaseOrders, isLoading } = useQuery({
    queryKey: ['/api/purchase-orders'],
  });
  
  // Status badge color mapping
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open':
        return 'bg-blue-500';
      case 'received':
        return 'bg-green-500';
      case 'closed':
        return 'bg-gray-500';
      case 'cancelled':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };
  
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[120px]">PO Number</TableHead>
          <TableHead>Supplier</TableHead>
          <TableHead>Order Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          Array(limit).fill(0).map((_, index) => (
            <TableRow key={index}>
              <TableCell><Skeleton className="h-6 w-20" /></TableCell>
              <TableCell><Skeleton className="h-6 w-32" /></TableCell>
              <TableCell><Skeleton className="h-6 w-24" /></TableCell>
              <TableCell><Skeleton className="h-6 w-16" /></TableCell>
              <TableCell><Skeleton className="h-6 w-24 ml-auto" /></TableCell>
            </TableRow>
          ))
        ) : purchaseOrders && purchaseOrders.length > 0 ? (
          purchaseOrders.slice(0, limit).map((po) => (
            <TableRow key={po.id}>
              <TableCell className="font-medium">{po.poNumber}</TableCell>
              <TableCell>{po.supplier}</TableCell>
              <TableCell>{new Date(po.orderDate).toLocaleDateString()}</TableCell>
              <TableCell>
                <Badge className={getStatusColor(po.status)}>
                  {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setLocation(`/purchase-orders/${po.id}`)}
                  >
                    <FileText className="h-4 w-4" />
                    <span className="sr-only">View</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setLocation(`/purchase-orders/${po.id}/validate`)}
                  >
                    <Package className="h-4 w-4" />
                    <span className="sr-only">Validate</span>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={5} className="h-24 text-center">
              No purchase orders found.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}