import React, { useState, useRef, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

interface QRScannerProps {
  onScanSuccess: (decodedText: string, decodedResult: any) => void;
  onScanError?: (error: string) => void;
  onClose?: () => void;
}

export default function QRScanner({ onScanSuccess, onScanError, onClose }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'html5qr-code-full-region';

  useEffect(() => {
    // Clean up scanner on component unmount
    return () => {
      if (qrScannerRef.current && qrScannerRef.current.isScanning) {
        qrScannerRef.current
          .stop()
          .catch((error) => console.error('Error stopping scanner:', error));
      }
    };
  }, []);

  const startScanner = async () => {
    setIsScanning(true);
    setError(null);
    
    try {
      const html5QrCode = new Html5Qrcode(scannerContainerId);
      qrScannerRef.current = html5QrCode;
      
      const config = { fps: 10, qrbox: { width: 250, height: 250 } };
      
      // Start scanning
      await html5QrCode.start(
        { facingMode: "environment" }, // Use back camera
        config,
        (decodedText, decodedResult) => {
          // On successful scan
          onScanSuccess(decodedText, decodedResult);
          handleStop(); // Stop scanning after a successful scan
        },
        (errorMessage) => {
          // Errors are common during scanning, so we don't show them
          // console.log(`QR Code scanning error: ${errorMessage}`);
        }
      );
    } catch (err) {
      setIsScanning(false);
      setError(`Failed to start camera: ${err instanceof Error ? err.message : String(err)}`);
      if (onScanError) onScanError(`Failed to start camera: ${err}`);
    }
  };

  const handleStop = () => {
    if (qrScannerRef.current && qrScannerRef.current.isScanning) {
      qrScannerRef.current
        .stop()
        .then(() => {
          setIsScanning(false);
        })
        .catch((err) => {
          setError(`Error stopping scanner: ${err}`);
          setIsScanning(false);
        });
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center">Scan QR/DataMatrix Code</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <div id={scannerContainerId} className="w-full h-64 bg-muted relative rounded-md overflow-hidden">
          {!isScanning && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="mb-4 text-4xl">📷</div>
                <p className="text-muted-foreground">Camera preview will appear here</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-between">
        {isScanning ? (
          <Button variant="destructive" onClick={handleStop}>Stop Scanning</Button>
        ) : (
          <Button onClick={startScanner}>Start Camera</Button>
        )}
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </CardFooter>
    </Card>
  );
}