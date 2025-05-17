import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, AlertTriangle, CircleAlert, Scan, ShoppingCart, Camera, Info } from "lucide-react";
import SimpleScanner from "@/components/simple-scanner";
import { parseQRCode, compareWithEPCISData, type ParsedQRData } from "@/lib/qr-code-parser";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
    bizTransactionList?: string[];
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

  // We don't derive NDC from GTIN anymore - only use what's in the file metadata

  // Content to display
  const renderContent = () => {
    if (showScanner) {
      return (
        <SimpleScanner 
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
                <AlertDescription className="flex flex-col gap-1">
                  <span>This product matches an item in the EPCIS data.</span>
                  
                  {/* Show PO information more prominently if available */}
                  {(poId || (bestMatch.productItem.bizTransactionList && bestMatch.productItem.bizTransactionList.length > 0)) && (
                    <Badge variant="outline" className="mt-1 bg-primary/5 text-primary border-primary/20 flex items-center gap-1 w-fit">
                      <ShoppingCart className="h-3 w-3" />
                      PO: {poId || bestMatch.productItem.bizTransactionList[0]}
                    </Badge>
                  )}
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <CircleAlert className="h-5 w-5" />
                <AlertTitle>No Match Found</AlertTitle>
                <AlertDescription className="flex flex-col gap-1">
                  <span>This product does not match any items in the EPCIS data.</span>
                  <span className="text-xs mt-1">Check that the scanned product's GTIN and lot number match those in the EPCIS file.</span>
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
                  {scannedData.gtin && (
                    <span className="text-xs mt-1 inline-block">
                      {scannedData.gtin.charAt(8) === '5' ? (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          Case
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          Item/Each
                        </Badge>
                      )}
                    </span>
                  )}
                </div>
                
                {/* Add NDC display if available in file metadata */}
                {(fileMetadata?.productInfo?.ndc || bestMatch?.productItem?.metadata?.productInfo?.ndc) && (
                  <div className="bg-muted p-2 rounded">
                    <span className="text-xs text-muted-foreground block">NDC:</span>
                    <span className="font-mono">
                      {bestMatch?.productItem?.metadata?.productInfo?.ndc || 
                      fileMetadata?.productInfo?.ndc || 'N/A'}
                    </span>
                  </div>
                )}
                
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
                      <h4 className="font-medium text-primary/80 mb-2 flex items-center justify-between">
                        <span>Product Information</span>
                        
                        {/* Display match quality indicator */}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                {bestMatch.matchResult.gtinMatch && bestMatch.matchResult.lotMatch && bestMatch.matchResult.serialMatch ? (
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    Perfect Match
                                  </Badge>
                                ) : (bestMatch.matchResult.gtinMatch && bestMatch.matchResult.lotMatch) ? (
                                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                    Good Match
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                    Partial Match
                                  </Badge>
                                )}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Quality of match between scanned code and EPCIS data</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </h4>
                      
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
                        <div className={`p-1 rounded ${bestMatch.matchResult.gtinMatch ? 'bg-green-50' : 'bg-amber-50'}`}>
                          <p className="text-xs text-gray-500 flex items-center">
                            GTIN
                            {!bestMatch.matchResult.gtinMatch && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertTriangle className="h-3 w-3 ml-1 text-amber-500" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">GTIN mismatch detected</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </p>
                          <p className="font-mono text-sm">{bestMatch.productItem.gtin}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">NDC</p>
                          <p className="font-mono text-sm">{bestMatch.productItem.metadata?.productInfo?.ndc || ''}</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Lot and serial information */}
                    <div className="bg-white border p-3 rounded-md shadow-sm">
                      <h4 className="font-medium text-primary/80 mb-2">Serialization Details</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div className={`p-1 rounded ${bestMatch.matchResult.lotMatch ? 'bg-green-50' : 'bg-amber-50'}`}>
                          <p className="text-xs text-gray-500 flex items-center">
                            Lot Number
                            {!bestMatch.matchResult.lotMatch && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertTriangle className="h-3 w-3 ml-1 text-amber-500" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">Lot number mismatch detected</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </p>
                          <p className="font-mono text-sm">{bestMatch.productItem.lotNumber}</p>
                        </div>
                        <div className={`p-1 rounded ${bestMatch.matchResult.serialMatch ? 'bg-green-50' : 'bg-amber-50'}`}>
                          <p className="text-xs text-gray-500 flex items-center">
                            Serial Number
                            {!bestMatch.matchResult.serialMatch && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertTriangle className="h-3 w-3 ml-1 text-amber-500" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">Serial number mismatch detected</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </p>
                          <p className="font-mono text-sm">{bestMatch.productItem.serialNumber}</p>
                        </div>
                        <div className={`col-span-2 p-1 rounded ${bestMatch.matchResult.expirationMatch ? 'bg-green-50' : 'bg-amber-50'}`}>
                          <p className="text-xs text-gray-500 flex items-center">
                            Expiration Date
                            {!bestMatch.matchResult.expirationMatch && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertTriangle className="h-3 w-3 ml-1 text-amber-500" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">Expiration date mismatch detected</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </p>
                          <p className="font-mono text-sm">{formatDate(bestMatch.productItem.expirationDate)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Purchase Order Information */}
            {(scanResult && poId) && (
              <div className="mt-4 pt-2 border-t">
                <div className="bg-blue-50 border border-blue-100 rounded-md p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <ShoppingCart className="h-4 w-4 text-blue-700" />
                    <span className="text-sm font-medium text-blue-700">
                      Purchase Order Information
                    </span>
                  </div>
                  
                  <div className="pl-6">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="bg-blue-100 border-blue-200 text-blue-800">
                        Associated PO #{poId}
                      </Badge>
                    </div>
                    
                    <p className="text-xs text-blue-600 mt-2">
                      <Info className="h-3 w-3 inline mr-1" />
                      This product is part of the purchase order shown above
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Transaction List from EPCIS */}
            {(scanResult && bestMatch && bestMatch.productItem.bizTransactionList && bestMatch.productItem.bizTransactionList.length > 0) && (
              <div className="mt-4 pt-2 border-t">
                <div className="bg-blue-50 border border-blue-100 rounded-md p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <ShoppingCart className="h-4 w-4 text-blue-700" />
                    <span className="text-sm font-medium text-blue-700">
                      EPCIS Business Transaction References
                    </span>
                  </div>
                  
                  <div className="pl-6">
                    <div className="mt-1">
                      <div className="text-xs text-blue-700 mb-1">From EPCIS File:</div>
                      {bestMatch.productItem.bizTransactionList.map((poRef: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-1 mb-1">
                          <Badge variant="outline" className="bg-white text-blue-800 border-blue-200">
                            PO Reference: {poRef}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
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