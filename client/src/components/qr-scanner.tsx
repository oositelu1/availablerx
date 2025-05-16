import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Camera, AlertTriangle } from 'lucide-react';

interface QRScannerProps {
  onScanSuccess: (decodedText: string, decodedResult: any) => void;
  onScanError?: (error: string) => void;
  onClose?: () => void;
}

// Fallback sample barcode for testing
const SAMPLE_BARCODE = "(01)03090123456789(10)ABC123(17)240530(21)XYZ987654321";

export default function QRScanner({ onScanSuccess, onScanError, onClose }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Cleanup function to stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);
  
  // Start camera function
  const startCamera = async () => {
    setIsScanning(true);
    setError(null);
    
    try {
      // Stop any existing stream
      stopCamera();
      
      console.log("Starting camera...");
      
      // Check camera support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser doesn't support camera access");
      }
      
      // Try to get available cameras
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      console.log("Available cameras:", cameras);
      
      // Request camera access - try rear camera first if available
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      
      // Store the stream reference for cleanup
      streamRef.current = stream;
      
      // Set stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.style.display = "block";
        
        // Log video dimensions once loaded
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            console.log("Video dimensions:", videoRef.current.videoWidth, videoRef.current.videoHeight);
          }
        };
      }
      
      // For now, show a success message that camera is working
      console.log("Camera started successfully");
    } catch (err) {
      stopCamera();
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("Camera error:", err);
      
      setError(`Camera issue: ${errorMsg}`);
      if (onScanError) onScanError(`Camera issue: ${errorMsg}`);
    }
  };

  // Use sample data for testing - directly uses the hardcoded barcode value
  const useSampleData = () => {
    console.log("Using sample data:", SAMPLE_BARCODE);
    onScanSuccess(SAMPLE_BARCODE, { result: SAMPLE_BARCODE });
    if (onClose) onClose();
  };
  
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center flex items-center justify-center gap-2">
          <Camera className="h-5 w-5" />
          {isScanning ? "Camera Active" : "Scan Product Code"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <div className="w-full h-64 bg-muted relative rounded-md overflow-hidden flex items-center justify-center">
          {/* Camera video element */}
          <video
            ref={videoRef}
            className={`w-full h-full object-cover ${isScanning ? 'block' : 'hidden'}`}
            autoPlay
            playsInline
            muted
          />
          
          {/* Placeholder when camera is not active */}
          {!isScanning && (
            <div className="text-center p-4">
              <Camera className="h-12 w-12 text-muted-foreground mb-2 mx-auto" />
              <p className="text-muted-foreground">Click "Start Camera" to begin scanning</p>
              <p className="text-xs text-muted-foreground mt-2">
                Position the product's 2D barcode within the scanning area
              </p>
            </div>
          )}
        </div>
        
        <div className="mt-4 flex justify-center gap-4">
          <Button 
            variant="secondary" 
            onClick={useSampleData}
            className="text-sm"
          >
            Use Sample Data
          </Button>
        </div>
        
        <div className="mt-4 text-sm">
          <p className="text-muted-foreground text-xs text-center">
            Note: Camera scanning may not work in some environments due to browser security restrictions.
            Use the "Sample Data" option for testing.
          </p>
        </div>
      </CardContent>
      
      <CardFooter className="flex gap-2 justify-between">
        {isScanning ? (
          <Button variant="destructive" onClick={stopCamera}>Stop Camera</Button>
        ) : (
          <Button onClick={startCamera}>Start Camera</Button>
        )}
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </CardFooter>
    </Card>
  );
}