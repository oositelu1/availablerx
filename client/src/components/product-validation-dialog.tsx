import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertTriangle, QrCode } from 'lucide-react';
import QRScanner from './qr-scanner';
import { parseQRCode, compareWithEPCISData, type ParsedQRData } from '@/lib/qr-code-parser';

interface ProductValidationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  productItems: Array<{
    id: number;
    gtin: string;
    serialNumber: string;
    lotNumber: string;
    expirationDate: string;
  }>;
  poId?: number | null;
}

export default function ProductValidationDialog({
  isOpen,
  onClose,
  productItems,
  poId
}: ProductValidationDialogProps) {
  const [showScanner, setShowScanner] = useState(false);
  const [scannedData, setScannedData] = useState<ParsedQRData | null>(null);
  const [matchResults, setMatchResults] = useState<{
    matchedItem?: any;
    matches: boolean;
    gtinMatch: boolean;
    lotMatch: boolean;
    expirationMatch: boolean;
    serialMatch: boolean;
  } | null>(null);
  const [currentStep, setCurrentStep] = useState<'initial' | 'scanning' | 'results'>('initial');
  const [validationHistory, setValidationHistory] = useState<Array<{
    timestamp: Date;
    scannedData: ParsedQRData;
    matchResults: any;
    matchedItem?: any;
  }>>([]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep('initial');
      setScannedData(null);
      setMatchResults(null);
    }
  }, [isOpen]);

  const handleStartScan = () => {
    setShowScanner(true);
    setCurrentStep('scanning');
  };

  const handleScanSuccess = (decodedText: string, decodedResult: any) => {
    const parsed = parseQRCode(decodedText);
    setScannedData(parsed);
    
    // Find matching product in EPCIS data
    const matchedItem = findMatchingProduct(parsed);
    
    if (matchedItem) {
      const comparison = compareWithEPCISData(parsed, matchedItem);
      setMatchResults({
        ...comparison,
        matchedItem
      });
    } else {
      setMatchResults({
        matches: false,
        gtinMatch: false,
        lotMatch: false,
        expirationMatch: false,
        serialMatch: false
      });
    }
    
    // Add to validation history
    setValidationHistory(prev => [
      {
        timestamp: new Date(),
        scannedData: parsed,
        matchResults: matchResults || {
          matches: false,
          gtinMatch: false,
          lotMatch: false,
          expirationMatch: false,
          serialMatch: false
        },
        matchedItem
      },
      ...prev
    ]);
    
    setShowScanner(false);
    setCurrentStep('results');
  };

  const handleScanError = (error: string) => {
    console.error('Scan error:', error);
    // Stay on scanning step but show an error
  };

  const handleCancelScan = () => {
    setShowScanner(false);
    setCurrentStep('initial');
  };

  const findMatchingProduct = (qrData: ParsedQRData) => {
    // Try to find an exact match with GTIN + serial number first
    if (qrData.gtin && qrData.serialNumber) {
      const exactMatch = productItems.find(
        item => item.gtin === qrData.gtin && item.serialNumber === qrData.serialNumber
      );
      if (exactMatch) return exactMatch;
    }
    
    // Try to find a match with GTIN + lot number if no exact match
    if (qrData.gtin && qrData.lotNumber) {
      const lotMatch = productItems.find(
        item => item.gtin === qrData.gtin && 
                item.lotNumber.toLowerCase() === qrData.lotNumber?.toLowerCase()
      );
      if (lotMatch) return lotMatch;
    }
    
    // Finally, just try to match by GTIN if nothing else matches
    if (qrData.gtin) {
      return productItems.find(item => item.gtin === qrData.gtin);
    }
    
    return null;
  };

  const renderStatus = (isMatch: boolean) => {
    if (isMatch) {
      return (
        <div className="flex items-center text-green-600">
          <CheckCircle2 className="w-4 h-4 mr-1" />
          <span>Match</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center text-red-600">
          <XCircle className="w-4 h-4 mr-1" />
          <span>No Match</span>
        </div>
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Product Verification</DialogTitle>
          <DialogDescription>
            Scan GS1 DataMatrix code from the physical product to verify against EPCIS data
          </DialogDescription>
        </DialogHeader>

        {currentStep === 'initial' && (
          <div className="py-4 text-center">
            <div className="bg-muted p-8 rounded-md mb-4 flex flex-col items-center justify-center">
              <QrCode className="h-16 w-16 mb-4 text-primary" />
              <h3 className="text-lg font-medium mb-2">Verify Physical Products</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Scan the DataMatrix code on the physical product to verify it matches EPCIS data
              </p>
              <Button onClick={handleStartScan} className="mt-2">
                Start Scanning
              </Button>
            </div>
            
            {validationHistory.length > 0 && (
              <div className="mt-4">
                <h3 className="text-md font-medium mb-2 text-left">Validation History</h3>
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Result</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validationHistory.slice(0, 5).map((record, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-xs">
                            {record.timestamp.toLocaleTimeString()}
                          </TableCell>
                          <TableCell>
                            <div className="text-xs font-medium">
                              {record.scannedData.gtin || 'Unknown GTIN'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Lot: {record.scannedData.lotNumber || 'N/A'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={record.matchResults.matches ? "success" : "destructive"}>
                              {record.matchResults.matches ? "Verified" : "Failed"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}

        {currentStep === 'scanning' && showScanner && (
          <QRScanner 
            onScanSuccess={handleScanSuccess} 
            onScanError={handleScanError}
            onClose={handleCancelScan}
          />
        )}

        {currentStep === 'results' && scannedData && matchResults && (
          <div className="py-2">
            <Alert variant={matchResults.matches ? "default" : "destructive"} className="mb-4">
              <AlertTitle className="flex items-center">
                {matchResults.matches ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Product Verified
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Verification Failed
                  </>
                )}
              </AlertTitle>
              <AlertDescription>
                {matchResults.matches
                  ? "The scanned product matches EPCIS data"
                  : "The scanned product does not match any product in EPCIS data"}
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Scanned Product</CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">GTIN:</span>
                      <span className="font-mono">{scannedData.gtin || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lot Number:</span>
                      <span>{scannedData.lotNumber || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Expiration:</span>
                      <span>{scannedData.expirationDate || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Serial Number:</span>
                      <span className="font-mono">{scannedData.serialNumber || 'N/A'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">EPCIS Data</CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  {matchResults.matchedItem ? (
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">GTIN:</span>
                        <span className="font-mono">{matchResults.matchedItem.gtin}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Lot Number:</span>
                        <span>{matchResults.matchedItem.lotNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Expiration:</span>
                        <span>{matchResults.matchedItem.expirationDate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Serial Number:</span>
                        <span className="font-mono">{matchResults.matchedItem.serialNumber}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      No matching product found
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {matchResults.matchedItem && (
              <Card className="mb-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Validation Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex justify-between items-center border p-2 rounded-md">
                      <span className="text-sm">GTIN</span>
                      {renderStatus(matchResults.gtinMatch)}
                    </div>
                    <div className="flex justify-between items-center border p-2 rounded-md">
                      <span className="text-sm">Lot Number</span>
                      {renderStatus(matchResults.lotMatch)}
                    </div>
                    <div className="flex justify-between items-center border p-2 rounded-md">
                      <span className="text-sm">Expiration Date</span>
                      {renderStatus(matchResults.expirationMatch)}
                    </div>
                    <div className="flex justify-between items-center border p-2 rounded-md">
                      <span className="text-sm">Serial Number</span>
                      {renderStatus(matchResults.serialMatch)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            <div className="flex gap-2">
              <Button onClick={handleStartScan}>Scan Another</Button>
              <Button variant="outline" onClick={() => setCurrentStep('initial')}>Back</Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}