import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Camera, AlertTriangle, Loader2 } from 'lucide-react';
import jsQR from 'jsqr';

interface QRScannerProps {
  onScanSuccess: (decodedText: string, decodedResult: any) => void;
  onScanError?: (error: string) => void;
  onClose?: () => void;
}

export default function QRScanner({ onScanSuccess, onScanError, onClose }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanningActive, setScanningActive] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  
  // Cleanup function to stop camera and scanning
  const stopScanning = () => {
    // Stop the scanning interval
    if (scanIntervalRef.current) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    // Stop the camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Reset UI state
    setIsScanning(false);
    setScanningActive(false);
    setCameraReady(false);
  };
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);
  
  // Function to parse a GS1 barcode (Data Matrix or QR)
  const parseGS1Barcode = (text: string) => {
    console.log("Parsing barcode:", text);
    
    // Return the raw text - it should be in GS1 format like "(01)12345678901234(17)220930(10)ABC123"
    return text;
  };
  
  // Function to scan for QR/Data Matrix codes in the video stream
  const scanVideoForCode = () => {
    if (!videoRef.current || !canvasRef.current || !cameraReady) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (!context) return;
    
    // Set the canvas dimensions to match the video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Only continue if the video is playing
    if (video.readyState !== video.HAVE_ENOUGH_DATA) return;
    
    try {
      // Draw the current video frame to the canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Get the image data for scanning
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      
      // Use jsQR to attempt to find a QR code in the image
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });
      
      // If a code was found, process it
      if (code) {
        console.log("QR Code found:", code);
        
        // Parse the barcode data
        const parsedCode = parseGS1Barcode(code.data);
        
        // Stop scanning and call the success handler
        stopScanning();
        onScanSuccess(parsedCode, { result: code });
      }
    } catch (err) {
      console.error("Error processing video frame:", err);
    }
  };
  
  // Start camera and scanning function
  const startScanning = async () => {
    setIsScanning(true);
    setError(null);
    
    try {
      // Cleanup any existing scanning/camera
      stopScanning();
      
      console.log("Starting camera for barcode scanning...");
      
      // Check camera support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser doesn't support camera access");
      }
      
      // Get available cameras
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      console.log("Available cameras:", cameras);
      
      // Request camera access - try environment facing camera first (back camera on phones)
      const constraints = {
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      // Set the stream to the video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Setup event for when video is ready
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            console.log("Video ready, dimensions:", videoRef.current.videoWidth, videoRef.current.videoHeight);
            videoRef.current.play().then(() => {
              setCameraReady(true);
              setScanningActive(true);
              
              // Start the scanning interval
              scanIntervalRef.current = window.setInterval(scanVideoForCode, 100); // scan every 100ms
            }).catch(err => {
              console.error("Error playing video:", err);
              setError("Could not start video stream: " + err.message);
              stopScanning();
            });
          }
        };
      } else {
        throw new Error("Video element not found");
      }
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("Camera error:", err);
      
      setError(`Camera issue: ${errorMsg}`);
      if (onScanError) onScanError(`Camera issue: ${errorMsg}`);
      stopScanning();
    }
  };
  
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center flex items-center justify-center gap-2">
          <Camera className="h-5 w-5" />
          {isScanning ? "Scanning for Barcodes..." : "Scan Product Code"}
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
          {/* Camera video element (always present but toggle display) */}
          <video
            ref={videoRef}
            className={`w-full h-full object-cover ${isScanning ? 'block' : 'hidden'}`}
            autoPlay
            playsInline
            muted
          />
          
          {/* Hidden canvas for image processing */}
          <canvas 
            ref={canvasRef} 
            className="hidden"
          />
          
          {/* Scanning indicator overlay */}
          {isScanning && scanningActive && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-black/40 rounded-lg p-3 flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-white" />
                <span className="text-white font-medium">Scanning...</span>
              </div>
              <div className="absolute inset-0 border-2 border-primary/50 rounded-md pointer-events-none"></div>
            </div>
          )}
          
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
        
        <div className="mt-4 text-sm">
          <p className="text-muted-foreground text-xs text-center">
            Camera scanning requires secure browsing (HTTPS) and camera permissions.
            Hold the camera steady over the barcode for best results.
          </p>
        </div>
      </CardContent>
      
      <CardFooter className="flex gap-2 justify-between">
        {isScanning ? (
          <Button variant="destructive" onClick={stopScanning}>Stop Camera</Button>
        ) : (
          <Button onClick={startScanning}>Start Camera</Button>
        )}
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </CardFooter>
    </Card>
  );
}