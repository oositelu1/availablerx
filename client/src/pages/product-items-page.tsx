import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Layout } from '@/components/layout/layout';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';

// Define the product item type
interface ProductItem {
  id: number;
  fileId: number;
  gtin: string;
  serialNumber: string;
  lotNumber: string;
  expirationDate: string;
  eventTime: string;
  sourceGln: string | null;
  destinationGln: string | null;
  bizTransactionList: string[] | null;
  poId: number | null;
}

// Define the file type
interface File {
  id: number;
  originalName: string;
  uploadedAt: string;
  status: string;
  type: string;
  size: number;
  metadata: any;
}

export default function ProductItemsPage() {
  const [, setLocation] = useLocation();
  const params = useParams<{ fileId: string }>();
  const fileId = parseInt(params.fileId);
  
  const [backPath, setBackPath] = useState('/files');
  
  // Load product items for the file
  const {
    data: productItems,
    isLoading,
    error
  } = useQuery<ProductItem[]>({
    queryKey: [`/api/product-items/file/${fileId}`],
    enabled: !isNaN(fileId)
  });

  // Load file details
  const {
    data: file,
    isLoading: fileLoading
  } = useQuery<File>({
    queryKey: [`/api/files/${fileId}`],
    enabled: !isNaN(fileId)
  });
  
  useEffect(() => {
    // Set back path to file detail if we have a file ID
    if (!isNaN(fileId)) {
      setBackPath(`/files/${fileId}`);
    }
  }, [fileId]);
  
  return (
    <Layout title="Serial Numbers">
      <div className="container px-4 py-6 lg:px-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Serial Numbers</h1>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setLocation(backPath)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to File
          </Button>
        </div>
        
        {file && (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{file.originalName}</CardTitle>
              <CardDescription>
                Uploaded on {formatDate(file.uploadedAt)}
              </CardDescription>
            </CardHeader>
          </Card>
        )}
        
        {isLoading || fileLoading ? (
          <div className="flex justify-center items-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-destructive">
                <p>Error loading product items</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={() => setLocation(backPath)}
                >
                  Return to File
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : productItems && productItems.length > 0 ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">All Serial Numbers ({productItems.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serial Number</TableHead>
                    <TableHead>GTIN</TableHead>
                    <TableHead>Lot Number</TableHead>
                    <TableHead>Expiration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productItems.map((item: ProductItem) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">
                        {item.serialNumber}
                      </TableCell>
                      <TableCell>{item.gtin}</TableCell>
                      <TableCell>{item.lotNumber}</TableCell>
                      <TableCell>
                        {item.expirationDate ? formatDate(item.expirationDate) : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground">
                <p>No serial numbers found for this file</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}