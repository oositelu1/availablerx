import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, AlertTriangle, CircleAlert, Scan, ShoppingCart, Camera } from "lucide-react";
import QRScanner from "@/components/qr-scanner";
import { parseQRCode, compareWithEPCISData, type ParsedQRData } from "@/lib/qr-code-parser";

interface ProductValidationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  productItems: Array<{
    id: number;
    gtin: string;
    serialNumber: string;
    lotNumber: string;
    expirationDate: string;
    fileId?: number;
    bizTransactionList?: any;
    metadata?: {
      productInfo?: {
        name?: string;
        manufacturer?: string;
        dosageForm?: string;
        strength?: string;
        ndc?: string;
      }
    };
  }>;
  poId?: number | null;
  fileMetadata?: {
    productInfo?: {
      name?: string;
      manufacturer?: string;
      dosageForm?: string;
      strength?: string;
      ndc?: string;
    }
  };
}

export default function ProductValidationDialog({
  isOpen,
  onClose,
  productItems,
  poId,
  fileMetadata
}: ProductValidationDialogProps) {
  const [showScanner, setShowScanner] = useState(false);
  const [scanResult, setScanResult] = useState<{
    timestamp: Date;
    scannedData: ParsedQRData;
    matches: Array<{
      productItem: typeof productItems[0];
      matchResult: {
        matches: boolean;
        gtinMatch: boolean;
        lotMatch: boolean;
        serialMatch: boolean;
        expirationMatch: boolean;
      }
    }>;
  } | null>(null);
  
  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setScanResult(null);
      setShowScanner(false);
    }
  }, [isOpen]);

  // Handle successful scan
  const handleScanSuccess = (decodedText: string) => {
    try {
      // Parse the QR code data
      const parsedData = parseQRCode(decodedText);
      
      // Find matching products
      const matches = productItems.map(productItem => {
        const matchResult = compareWithEPCISData(parsedData, {
          gtin: productItem.gtin,
          lotNumber: productItem.lotNumber,
          expirationDate: productItem.expirationDate,
          serialNumber: productItem.serialNumber
        });
        
        return {
          productItem,
          matchResult
        };
      });
  
      // Set the scan result
      setScanResult({
        timestamp: new Date(),
        scannedData: parsedData,
        matches
      });
      
      // Hide scanner once we have a result
      setShowScanner(false);
    } catch (error) {
      console.error("Error processing scan:", error);
      // Could display an error message to the user here
    }
  };

  // Find the best match (if any)
  const findMatchingProduct = (qrData: ParsedQRData) => {
    // First check for exact matches (GTIN + lot number + serial number)
    const exactMatch = productItems.find(item => 
      item.gtin === qrData.gtin && 
      item.lotNumber?.toLowerCase() === qrData.lotNumber?.toLowerCase() &&
      item.serialNumber === qrData.serialNumber
    );
    
    if (exactMatch) return exactMatch;
    
    // Then check for GTIN + lot number matches
    const lotMatch = productItems.find(item => 
      item.gtin === qrData.gtin && 
      item.lotNumber?.toLowerCase() === qrData.lotNumber?.toLowerCase()
    );
    
    if (lotMatch) return lotMatch;
    
    // Finally, check for just GTIN matches
    const gtinMatch = productItems.find(item => 
      item.gtin === qrData.gtin
    );
    
    return gtinMatch;
  };

  // Reset scanning
  const handleReset = () => {
    setScanResult(null);
    setShowScanner(false);
  };

  // Format a date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch (e) {
      return dateString;
    }
  };

  // Helper to convert GTIN to NDC format if possible
  const gtinToNDC = (gtin: string | undefined) => {
    if (!gtin || gtin.length !== 14) return null;
    
    // Standard conversion: remove first 3 digits (usually '003') and checksum digit
    // Format as 5-4-2
    const ndc = gtin.substring(3, 12);
    if (ndc.length === 9) {
      return `${ndc.substring(0, 5)}-${ndc.substring(5, 9)}-${ndc.substring(9)}`;
    }
    
    return null;
  };

  // Content to display
  const renderContent = () => {
    if (showScanner) {
      return (
        <QRScanner 
          onScanSuccess={handleScanSuccess}
          onClose={() => setShowScanner(false)}
        />
      );
    }
    
    if (scanResult) {
      const { scannedData, matches } = scanResult;
      const foundMatches = matches.filter(m => m.matchResult.matches);
      const bestMatch = foundMatches.length > 0 ? foundMatches[0] : null;
      
      return (
        <div className="space-y-4">
          <div className="mb-4">
            <h3 className="text-lg font-medium mb-2">Scan Results</h3>
            
            {bestMatch ? (
              <Alert variant="default" className="bg-success/10 border-success">
                <CheckCircle className="h-5 w-5 text-success" />
                <AlertTitle>Valid Product!</AlertTitle>
                <AlertDescription>
                  This product matches an item in the EPCIS data.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <CircleAlert className="h-5 w-5" />
                <AlertTitle>No Match Found</AlertTitle>
                <AlertDescription>
                  This product does not match any items in the EPCIS data.
                </AlertDescription>
              </Alert>
            )}
          </div>
          
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium mb-1">Scanned Information</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-muted p-2 rounded">
                  <span className="text-xs text-muted-foreground block">GTIN:</span>
                  <span className="font-mono">{scannedData.gtin || 'N/A'}</span>
                </div>
                
                <div className="bg-muted p-2 rounded">
                  <span className="text-xs text-muted-foreground block">NDC:</span>
                  <span className="font-mono">{gtinToNDC(scannedData.gtin) || 'N/A'}</span>
                </div>
                
                <div className="bg-muted p-2 rounded">
                  <span className="text-xs text-muted-foreground block">Lot Number:</span>
                  <span className="font-mono">{scannedData.lotNumber || 'N/A'}</span>
                </div>
                
                <div className="bg-muted p-2 rounded">
                  <span className="text-xs text-muted-foreground block">Serial Number:</span>
                  <span className="font-mono">{scannedData.serialNumber || 'N/A'}</span>
                </div>
                
                <div className="bg-muted p-2 rounded">
                  <span className="text-xs text-muted-foreground block">Expiration Date:</span>
                  <span className="font-mono">{scannedData.expirationDate ? formatDate(scannedData.expirationDate) : 'N/A'}</span>
                </div>
                
                <div className="bg-muted p-2 rounded">
                  <span className="text-xs text-muted-foreground block">Format:</span>
                  <span className={`font-mono ${scannedData.isGS1Format ? 'text-success' : 'text-warning'}`}>
                    {scannedData.isGS1Format ? 'GS1 DataMatrix' : 'Non-GS1 Format'}
                  </span>
                </div>
              </div>
            </div>
            
            {bestMatch && (
              <div>
                <h4 className="text-sm font-medium mb-1">Match Details</h4>
                <div className="border rounded-md p-3 bg-muted/30">
                  <div className="flex flex-wrap gap-2 mb-2">
                    <Badge variant={bestMatch.matchResult.gtinMatch ? "success" : "destructive"}>
                      {bestMatch.matchResult.gtinMatch ? "GTIN Match" : "GTIN Mismatch"}
                    </Badge>
                    <Badge variant={bestMatch.matchResult.lotMatch ? "success" : "destructive"}>
                      {bestMatch.matchResult.lotMatch ? "Lot Match" : "Lot Mismatch"}
                    </Badge>
                    {bestMatch.matchResult.serialMatch !== undefined && (
                      <Badge variant={bestMatch.matchResult.serialMatch ? "success" : "destructive"}>
                        {bestMatch.matchResult.serialMatch ? "Serial Match" : "Serial Mismatch"}
                      </Badge>
                    )}
                    {bestMatch.matchResult.expirationMatch !== undefined && (
                      <Badge variant={bestMatch.matchResult.expirationMatch ? "success" : "destructive"}>
                        {bestMatch.matchResult.expirationMatch ? "Expiration Match" : "Expiration Mismatch"}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3">
                    {/* Product identity card */}
                    <div className="bg-white border p-3 rounded-md shadow-sm">
                      <h4 className="font-medium text-primary/80 mb-2">Product Information</h4>
                      {/* Try to get product name and manufacturer from metadata */}
                      {(() => {
                        // First try to get from product item metadata
                        if (bestMatch.productItem.metadata?.productInfo?.name) {
                          return (
                            <>
                              <p className="text-base font-semibold mb-1">
                                {bestMatch.productItem.metadata.productInfo.name}
                              </p>
                              <p className="text-sm text-gray-600 mb-2">
                                {bestMatch.productItem.metadata.productInfo.manufacturer || "Manufacturer information not available"}
                              </p>
                            </>
                          );
                        } 
                        // Then try to get from file metadata
                        else if (fileMetadata?.productInfo?.name) {
                          return (
                            <>
                              <p className="text-base font-semibold mb-1">
                                {fileMetadata.productInfo.name}
                              </p>
                              <p className="text-sm text-gray-600 mb-2">
                                {fileMetadata.productInfo.manufacturer || "Manufacturer information not available"}
                              </p>
                            </>
                          );
                        }
                        // Finally fallback to generic
                        else {
                          return (
                            <>
                              <p className="text-base font-semibold mb-1">Pharmaceutical Product</p>
                              <p className="text-sm text-gray-600 mb-2">Product information not available</p>
                            </>
                          );
                        }
                      })()}
                      
                      {/* Product identifiers in a cleaner grid */}
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div>
                          <p className="text-xs text-gray-500">GTIN</p>
                          <p className="font-mono text-sm">{bestMatch.productItem.gtin}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">NDC</p>
                          <p className="font-mono text-sm">{gtinToNDC(bestMatch.productItem.gtin) || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Lot and serial information */}
                    <div className="bg-white border p-3 rounded-md shadow-sm">
                      <h4 className="font-medium text-primary/80 mb-2">Serialization Details</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-gray-500">Lot Number</p>
                          <p className="font-mono text-sm">{bestMatch.productItem.lotNumber}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Serial Number</p>
                          <p className="font-mono text-sm">{bestMatch.productItem.serialNumber}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-gray-500">Expiration Date</p>
                          <p className="font-mono text-sm">{formatDate(bestMatch.productItem.expirationDate)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {poId && (
              <div className="mt-4 pt-2 border-t">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Associated with Purchase Order #{poId}
                  </span>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex justify-between mt-4 pt-4 border-t">
            <Button onClick={handleReset} variant="outline">
              Scan Another
            </Button>
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      );
    }
    
    return (
      <div className="space-y-6 py-4">
        <div className="text-center">
          <Scan className="h-12 w-12 text-primary/60 mx-auto mb-3" />
          <h3 className="text-lg font-medium mb-1">Scan Product Code</h3>
          <p className="text-sm text-muted-foreground">
            Scan a product's 2D DataMatrix or QR code to validate it against the EPCIS data.
          </p>
        </div>
        
        <div className="flex flex-col gap-3 items-center">
          <div className="w-full max-w-xs bg-blue-50 border border-blue-200 rounded-md p-4 text-sm shadow-sm">
            <div className="font-semibold text-blue-800 flex items-center mb-2">
              <CheckCircle className="h-5 w-5 mr-2 text-blue-600" />
              Test with Sample Data
            </div>
            <p className="text-blue-700 mb-3 text-sm">
              This option uses data from the current EPCIS file to create a valid GS1 code for testing.
            </p>
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => {
                // Use data from the first product item for testing
                if (productItems && productItems.length > 0) {
                  // Create an enhanced version of the first item with product info
                  const index = 0;
                  const firstItem = productItems[index];
                  
                  // Create a GS1 DataMatrix code format from actual product data
                  const sampleCode = `(01)${firstItem.gtin}(10)${firstItem.lotNumber}(17)${
                    new Date(firstItem.expirationDate).toISOString().split('T')[0].replace(/-/g, '').substring(2)
                  }(21)${firstItem.serialNumber}`;
                  
                  // Create a temporary enhanced copy of the product items array
                  // that includes the product name and manufacturer
                  const enhancedItems = [...productItems];
                  enhancedItems[index] = {
                    ...firstItem,
                    metadata: {
                      productInfo: {
                        name: fileMetadata?.productInfo?.name || "Acetaminophen",
                        manufacturer: fileMetadata?.productInfo?.manufacturer || "MedTech Pharmaceuticals",
                        dosageForm: fileMetadata?.productInfo?.dosageForm || "Tablet",
                        strength: fileMetadata?.productInfo?.strength || "500mg"
                      }
                    }
                  };
                  
                  // Parse the QR code data
                  const parsedData = parseQRCode(sampleCode);
                  
                  // Find matching products using the enhanced array
                  const matches = enhancedItems.map(productItem => {
                    const matchResult = compareWithEPCISData(parsedData, {
                      gtin: productItem.gtin,
                      lotNumber: productItem.lotNumber,
                      expirationDate: productItem.expirationDate,
                      serialNumber: productItem.serialNumber
                    });
                    
                    return {
                      productItem,
                      matchResult
                    };
                  });
              
                  // Set the scan result with the enhanced product items
                  setScanResult({
                    timestamp: new Date(),
                    scannedData: parsedData,
                    matches
                  });
                } else {
                  // Fallback sample if no product items are available
                  const sampleCode = "(01)03090123456789(10)ABC123(17)240530(21)XYZ987654321";
                  handleScanSuccess(sampleCode);
                }
              }}
            >
              Use Sample Data for Testing
            </Button>
          </div>
          
          <div className="w-full max-w-xs">
            <Button 
              variant="outline" 
              className="w-full flex items-center gap-2"
              onClick={() => setShowScanner(true)}
            >
              <Camera className="h-4 w-4" />
              Start Camera Scanning
            </Button>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Note: Camera may not work in some environments due to security restrictions.
            </p>
          </div>
        </div>
        
        <div className="bg-muted/40 rounded-md p-3 text-sm">
          <h4 className="font-medium mb-2">What Can Be Validated:</h4>
          <ul className="space-y-1 list-disc pl-5 text-muted-foreground">
            <li>Product GTIN (Global Trade Item Number)</li>
            <li>Lot/Batch number</li>
            <li>Serial number</li>
            <li>Expiration date</li>
          </ul>
          
          <div className="mt-2 pt-2 border-t border-dashed border-muted">
            <h4 className="font-medium mb-1">Important Note:</h4>
            <p className="text-xs text-muted-foreground">
              Camera access requires a secure context (HTTPS), appropriate camera permissions, 
              and often doesn't work in sandbox environments like Replit. <strong>Please use 
              the "Use Sample Data" option</strong> to test the functionality in this environment.
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Product Validation</DialogTitle>
          <DialogDescription>
            Validate physical products against EPCIS data by scanning product codes.
          </DialogDescription>
        </DialogHeader>
        
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}