import React, { useState, useRef, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Camera, AlertTriangle } from 'lucide-react';

interface QRScannerProps {
  onScanSuccess: (decodedText: string, decodedResult: any) => void;
  onScanError?: (error: string) => void;
  onClose?: () => void;
}

export default function QRScanner({ onScanSuccess, onScanError, onClose }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'html5qr-code-full-region';
  
  // Check if device has camera support
  useEffect(() => {
    // Check if navigator.mediaDevices is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraPermission(false);
      setError("Your browser doesn't support camera access. Try using a different browser or device.");
      return;
    }
    
    // Test camera permission
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        setCameraPermission(true);
        // Stop all tracks to release camera
        stream.getTracks().forEach(track => track.stop());
      })
      .catch(err => {
        setCameraPermission(false);
        if (err.name === 'NotAllowedError') {
          setError("Camera access was denied. Please allow camera access and try again.");
        } else if (err.name === 'NotFoundError') {
          setError("No camera found on your device.");
        } else {
          setError(`Camera error: ${err.message}`);
        }
      });
      
    // Cleanup function for component unmount
    return () => {
      cleanupScanner();
    };
  }, []);
  
  const cleanupScanner = () => {
    try {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(error => {
          console.error("Error stopping scanner:", error);
        });
      }
      
      // Clear scanner HTML
      const container = document.getElementById(scannerContainerId);
      if (container) {
        container.innerHTML = '';
      }
    } catch (err) {
      console.error("Error during scanner cleanup:", err);
    }
  };

  const startScanner = async () => {
    setIsScanning(true);
    setError(null);
    
    try {
      // Clean up any existing scanner instance
      cleanupScanner();
      
      // Create a new scanner instance
      const html5QrCode = new Html5Qrcode(scannerContainerId);
      scannerRef.current = html5QrCode;
      
      // Configure scanner with optimal settings for reliability
      const config = { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        formatsToSupport: [Html5Qrcode.FORMATS.DATA_MATRIX, Html5Qrcode.FORMATS.QR_CODE]
      };
      
      // Basic camera with environment (rear) preference
      await html5QrCode.start(
        { facingMode: "environment" }, 
        config,
        (decodedText, decodedResult) => {
          onScanSuccess(decodedText, decodedResult);
          stopScanner();
        },
        (errorMessage) => {
          // Common scanning errors - just log them but don't show to user
          // as they happen constantly during normal scanning
          console.log("Scanning error:", errorMessage);
        }
      );
    } catch (err) {
      setIsScanning(false);
      let errorMsg = err instanceof Error ? err.message : String(err);
      
      // Make error messages more user-friendly
      if (errorMsg.includes("OverconstrainedError")) {
        errorMsg = "Camera constraints cannot be satisfied. Try with a different device.";
      } else if (errorMsg.includes("NotAllowedError")) {
        errorMsg = "Camera access was denied. Please allow camera access in your browser settings.";
      } else if (errorMsg.includes("NotFoundError")) {
        errorMsg = "No camera found. Please ensure your device has a camera.";
      } else if (errorMsg.includes("NotReadableError")) {
        errorMsg = "Camera is in use by another application or not accessible.";
      }
      
      setError(`Failed to start camera: ${errorMsg}`);
      if (onScanError) onScanError(`Failed to start camera: ${errorMsg}`);
    }
  };

  const stopScanner = () => {
    try {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop()
          .then(() => setIsScanning(false))
          .catch((error) => {
            console.error("Error stopping scanner:", error);
            setIsScanning(false);
          });
      } else {
        setIsScanning(false);
      }
    } catch (error) {
      console.error("Error stopping scanner:", error);
      setIsScanning(false);
    }
  };

  if (cameraPermission === false) {
    // Camera not available or permission denied
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-center">Camera Not Available</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Camera Access Issue</AlertTitle>
            <AlertDescription>
              {error || "Unable to access camera. This may be due to browser restrictions or permission settings."}
            </AlertDescription>
          </Alert>
          
          <div className="text-center p-4 bg-muted/50 rounded-md border border-dashed border-muted-foreground/30">
            <p className="text-sm text-muted-foreground">
              Try the following:
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside mt-2 text-left">
              <li>Ensure camera permissions are enabled in your browser</li>
              <li>Use a secure (HTTPS) connection</li>
              <li>Try a different browser (Chrome is recommended)</li>
              <li>Use the "Sample Data" option instead</li>
            </ul>
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-center">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </CardFooter>
      </Card>
    );
  }
  
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center flex items-center justify-center gap-2">
          <Camera className="h-5 w-5" />
          {isScanning ? "Scanning..." : "Scan Product Code"}
        </CardTitle>
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
              <div className="text-center p-4">
                <Camera className="h-12 w-12 text-muted-foreground mb-2 mx-auto" />
                <p className="text-muted-foreground">Click "Start Camera" to begin scanning</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Position the product's 2D barcode within the scanning area
                </p>
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-4 text-sm">
          <p className="text-muted-foreground text-xs">
            Note: Camera scanning may not work in some environments due to browser security restrictions.
            If you encounter issues, use the "Sample Data" option instead.
          </p>
        </div>
      </CardContent>
      
      <CardFooter className="flex gap-2 justify-between">
        {isScanning ? (
          <Button variant="destructive" onClick={stopScanner}>Stop Camera</Button>
        ) : (
          <Button onClick={startScanner}>Start Camera</Button>
        )}
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </CardFooter>
    </Card>
  );
}