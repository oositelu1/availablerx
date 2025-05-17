import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Camera, X } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface HTML5ScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose?: () => void;
}

export default function HTML5Scanner({ onScanSuccess, onClose }: HTML5ScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('Ready to scan');
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'html5-qrcode-scanner';
  
  useEffect(() => {
    // Initialize scanner on component mount
    scannerRef.current = new Html5Qrcode(scannerContainerId);
    
    // Clean up when component unmounts
    return () => {
      stopScanner();
    };
  }, []);
  
  const startScanner = async () => {
    if (!scannerRef.current) {
      setError('Scanner not initialized');
      return;
    }
    
    setError(null);
    setIsScanning(true);
    setMessage('Starting camera...');
    
    try {
      const qrCodeSuccessCallback = (decodedText: string) => {
        console.log('Code scanned:', decodedText);
        setMessage(`Code found: ${decodedText.substring(0, 20)}...`);
        stopScanner();
        onScanSuccess(decodedText);
      };
      
      const qrCodeErrorCallback = (error: unknown) => {
        // This is called repeatedly when no code is found
        // We don't want to show these errors to the user
        console.debug('Scan error:', error);
      };
      
      // Scanner configuration
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        formatsToSupport: [
          Html5QrcodeSupportedFormats.DATA_MATRIX,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.CODE_128
        ],
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      };
      
      await scannerRef.current.start(
        { facingMode: "environment" },
        config,
        qrCodeSuccessCallback,
        qrCodeErrorCallback
      );
      
      setMessage('Scanning for barcodes...');
    } catch (err) {
      console.error('Error starting scanner:', err);
      setError(`Could not start camera: ${err instanceof Error ? err.message : String(err)}`);
      setIsScanning(false);
    }
  };
  
  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
      try {
        await scannerRef.current.stop();
        console.log('Scanner stopped');
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
    
    setIsScanning(false);
    setMessage('Ready to scan');
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="bg-primary/5 border-b">
        <CardTitle className="text-center flex items-center justify-center gap-2">
          <Camera className="h-5 w-5 text-primary" />
          {isScanning ? "Scanning for DataMatrix..." : "Scan Product Code"}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-4 space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Camera Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <div className="rounded-lg overflow-hidden border-2 border-muted">
          <div className="relative aspect-video bg-muted" style={{ minHeight: "300px" }}>
            {/* Scanner container */}
            <div 
              id={scannerContainerId} 
              className="w-full h-full"
              style={{
                position: 'relative',
                padding: '0',
                border: 'none'
              }}
            ></div>
            
            {/* Placeholder when not scanning */}
            {!isScanning && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                <div className="text-center p-4">
                  <Camera className="h-12 w-12 text-primary/50 mb-2 mx-auto" />
                  <p className="text-white/90">Click "Start Scanner" to begin scanning</p>
                </div>
              </div>
            )}
            
            {/* Status message */}
            <div className="absolute bottom-2 left-0 right-0 flex justify-center">
              <div className="px-2 py-1 bg-black/70 rounded-full">
                <p className="text-xs text-white">{message}</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="text-sm text-center text-muted-foreground">
          Position the DataMatrix code within the scanning area and hold steady.
          <p className="text-xs mt-1">Works with DataMatrix, QR, and standard barcodes</p>
        </div>
      </CardContent>
      
      <CardFooter className="flex gap-2 justify-between">
        {isScanning ? (
          <Button variant="destructive" onClick={stopScanner} className="flex-1 gap-2">
            <X className="h-4 w-4" />
            Stop Scanner
          </Button>
        ) : (
          <Button onClick={startScanner} className="flex-1 gap-2">
            <Camera className="h-4 w-4" />
            Start Scanner
          </Button>
        )}
        
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}