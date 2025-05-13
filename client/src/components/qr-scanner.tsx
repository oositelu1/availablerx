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
      try {
        if (qrScannerRef.current) {
          // Check if it's scanning before attempting to stop
          if (qrScannerRef.current.isScanning) {
            qrScannerRef.current.stop()
              .catch((error) => console.error('Error stopping scanner:', error));
          }
          
          // Clear the scanner container to avoid DOM issues
          const container = document.getElementById(scannerContainerId);
          if (container) {
            while (container.firstChild) {
              container.removeChild(container.firstChild);
            }
          }
        }
      } catch (error) {
        console.error('Error during QR scanner cleanup:', error);
      }
    };
  }, []);

  const startScanner = async () => {
    setIsScanning(true);
    setError(null);
    
    try {
      const html5QrCode = new Html5Qrcode(scannerContainerId);
      qrScannerRef.current = html5QrCode;
      
      // Use fixed configuration to avoid calculation errors
      const config = { 
        fps: 10, 
        qrbox: { width: 250, height: 250 }, // Fixed size to avoid calculation errors
        aspectRatio: 1.0
      };
      
      // Use camera constraints with fewer restrictions
      const cameraConstraints = { facingMode: "environment" };
      
      // Start scanning
      await html5QrCode.start(
        cameraConstraints, 
        config,
        (decodedText, decodedResult) => {
          // On successful scan
          onScanSuccess(decodedText, decodedResult);
          handleStop(); // Stop scanning after a successful scan
        },
        (errorMessage) => {
          // Errors are common during scanning, so we don't show them
          console.log(`QR Code scanning error: ${errorMessage}`);
        }
      );
    } catch (err) {
      setIsScanning(false);
      let errorMsg = err instanceof Error ? err.message : String(err);
      
      // Make error messages more user-friendly
      if (errorMsg.includes("OverconstrainedError")) {
        errorMsg = "Camera constraints cannot be satisfied. This is common in sandboxed environments like Replit or when no camera is available.";
      } else if (errorMsg.includes("NotAllowedError")) {
        errorMsg = "Camera access was denied. Please allow camera access in your browser settings.";
      } else if (errorMsg.includes("NotFoundError")) {
        errorMsg = "No camera found. Please ensure your device has a camera and it's not being used by another application.";
      } else if (errorMsg.includes("NotReadableError")) {
        errorMsg = "Camera is in use by another application or not accessible.";
      } else if (errorMsg.includes("AbortError")) {
        errorMsg = "Camera access was aborted. Please try again.";
      }
      
      setError(`Failed to start camera: ${errorMsg}`);
      if (onScanError) onScanError(`Failed to start camera: ${errorMsg}`);
    }
  };

  const handleStop = () => {
    try {
      if (qrScannerRef.current) {
        if (qrScannerRef.current.isScanning) {
          qrScannerRef.current
            .stop()
            .then(() => {
              setIsScanning(false);
            })
            .catch((err) => {
              setError(`Error stopping scanner: ${err}`);
              setIsScanning(false);
            });
        } else {
          setIsScanning(false);
        }
        
        // Clean up the HTML elements to prevent DOM errors
        const container = document.getElementById(scannerContainerId);
        if (container) {
          setTimeout(() => {
            try {
              while (container.firstChild) {
                container.removeChild(container.firstChild);
              }
            } catch (cleanupErr) {
              console.error('Error cleaning up scanner DOM:', cleanupErr);
            }
          }, 300); // Small delay to ensure stop has completed
        }
      }
    } catch (err) {
      console.error('Error in handleStop:', err);
      setIsScanning(false);
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