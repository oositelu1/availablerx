import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Camera, QrCode } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface QRScannerProps {
  onScanSuccess: (decodedText: string, decodedResult: any) => void;
  onScanError?: (error: string) => void;
  onClose?: () => void;
}

// Sample barcodes for testing - these match pharmaceutical format
const SAMPLE_BARCODES = [
  "(01)00312345678906(17)250101(10)ABC123(21)XYZ987654321", // GTIN with expiry and serial
  "(01)50380436543159(17)240630(10)LK8017R(21)H49K1LD94", // Another example
  "(01)00361234567890(17)230228(10)BATCH001(21)S12345" // Another format
];

export default function QRScanner({ onScanSuccess, onScanError, onClose }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState<string>("");
  
  // Handle manual input for barcode
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!manualInput.trim()) {
      setError("Please enter a barcode value");
      return;
    }
    
    // Process the manually entered barcode
    console.log("Processing manually entered barcode:", manualInput);
    onScanSuccess(manualInput, { result: { data: manualInput } });
  };
  
  // Use sample barcode data for testing
  const useSampleBarcode = (index: number) => {
    const barcode = SAMPLE_BARCODES[index];
    console.log("Using sample barcode:", barcode);
    onScanSuccess(barcode, { result: { data: barcode } });
  };
  
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center flex items-center justify-center gap-2">
          <QrCode className="h-5 w-5" />
          Enter Product Code
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Manual Barcode Entry:</h3>
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <Input 
                type="text" 
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Enter barcode value..."
                className="flex-1"
              />
              <Button type="submit">Submit</Button>
            </form>
            <p className="text-xs text-muted-foreground">
              Enter the barcode value exactly as it appears on the product
            </p>
          </div>
          
          <div className="border-t pt-4 space-y-2">
            <h3 className="text-sm font-medium">Sample Data:</h3>
            <div className="grid grid-cols-1 gap-2">
              {SAMPLE_BARCODES.map((barcode, index) => (
                <Button 
                  key={index}
                  variant="outline" 
                  className="text-left h-auto py-2 justify-start"
                  onClick={() => useSampleBarcode(index)}
                >
                  <div>
                    <span className="font-medium">Example {index + 1}</span>
                    <p className="text-xs text-muted-foreground truncate" style={{maxWidth: '280px'}}>
                      {barcode}
                    </p>
                  </div>
                </Button>
              ))}
            </div>
          </div>
          
          <div className="border-t pt-4">
            <Alert className="bg-blue-50">
              <Camera className="h-4 w-4" />
              <AlertTitle>Camera Scanning Unavailable</AlertTitle>
              <AlertDescription>
                Camera-based scanning is currently unavailable in this environment. 
                Please use manual entry or sample data instead.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="justify-end">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </CardFooter>
    </Card>
  );
}