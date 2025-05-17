import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Camera } from 'lucide-react';
import jsQR from 'jsqr';

interface QRScannerProps {
  onScanSuccess: (decodedText: string, decodedResult: any) => void;
  onScanError?: (error: string) => void;
  onClose?: () => void;
}

export default function QRScanner({ onScanSuccess, onScanError, onClose }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawData, setRawData] = useState<string>("Scanning...");
  const [scanCount, setScanCount] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  // Start the camera and scanning process
  async function startScanning() {
    setIsScanning(true);
    setError(null);
    setRawData("Scanning...");
    setScanCount(0);
    
    try {
      // Clean up any existing scanning session
      stopScanning();
      
      console.log("Starting camera for barcode scanning...");
      
      // Check for video element
      if (!videoRef.current) {
        throw new Error("Video element not found");
      }
      
      // Request camera access with environment facing mode (back camera)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" }
      });
      
      // Store stream reference for cleanup
      streamRef.current = stream;
      
      // Set video source
      videoRef.current.srcObject = stream;
      
      // When video is ready, set up canvas and start scanning
      videoRef.current.onloadedmetadata = () => {
        if (videoRef.current && canvasRef.current) {
          // Set canvas dimensions to match video
          canvasRef.current.height = videoRef.current.videoHeight;
          canvasRef.current.width = videoRef.current.videoWidth;
          
          // Ensure video is playing
          if (videoRef.current.paused) {
            videoRef.current.play().catch(err => {
              console.error("Error playing video:", err);
              setError("Could not play video: " + err.message);
            });
          }
          
          // Start scanning loop
          scanFrame();
        }
      };
      
    } catch (err) {
      console.error("Error setting up camera:", err);
      setError("Camera access failed: " + 
               (err instanceof Error ? err.message : String(err)));
      setIsScanning(false);
    }
  }

  // Stop scanning and clean up resources
  function stopScanning() {
    console.log("Stopping scanner...");
    
    // Stop animation frame loop
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    
    // Stop and release camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        console.log("Stopping track:", track.kind, track.label);
        track.stop();
      });
      streamRef.current = null;
    }
    
    // Clear video source
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject = null;
    }
    
    setIsScanning(false);
    setRawData("Scanner stopped");
  }

  // Main scanning function that processes video frames
  function scanFrame() {
    if (!videoRef.current || !canvasRef.current) return;
    
    // Only process video if it has enough data and is playing
    if (videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA || 
        videoRef.current.paused) {
      // Keep trying if not ready yet
      animationFrameIdRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    
    const canvas = canvasRef.current.getContext('2d', { willReadFrequently: true });
    
    if (!canvas) {
      console.error("Could not get canvas context");
      return;
    }
    
    setScanCount(count => count + 1);
    
    try {
      // Draw current video frame to canvas for processing
      canvas.drawImage(
        videoRef.current, 
        0, 0, 
        canvasRef.current.width, 
        canvasRef.current.height
      );
      
      // Get image data for QR processing
      const imageData = canvas.getImageData(
        0, 0, 
        canvasRef.current.width, 
        canvasRef.current.height
      );
      
      // Scan for QR code
      const code = jsQR(
        imageData.data, 
        imageData.width, 
        imageData.height, 
        { inversionAttempts: "attemptBoth" }
      );
      
      // If code found, process it
      if (code) {
        console.log("QR Code found:", code.data);
        setRawData(code.data);
        
        // Draw a highlight around the detected code
        canvas.beginPath();
        canvas.lineWidth = 4;
        canvas.strokeStyle = "#FF3B58";
        canvas.moveTo(code.location.topLeftCorner.x, code.location.topLeftCorner.y);
        canvas.lineTo(code.location.topRightCorner.x, code.location.topRightCorner.y);
        canvas.lineTo(code.location.bottomRightCorner.x, code.location.bottomRightCorner.y);
        canvas.lineTo(code.location.bottomLeftCorner.x, code.location.bottomLeftCorner.y);
        canvas.lineTo(code.location.topLeftCorner.x, code.location.topLeftCorner.y);
        canvas.stroke();
        
        // Add a bit of fill to show detection more clearly
        canvas.fillStyle = "rgba(255, 59, 88, 0.2)";
        canvas.fill();
        
        // Stop scanning and call success handler
        stopScanning();
        onScanSuccess(code.data, { result: code });
        return;
      }
      
      // Draw scan line and scanning overlay
      drawScanOverlay(canvas, canvasRef.current.width, canvasRef.current.height);
      
    } catch (err) {
      console.error("Error in scanning loop:", err);
    }
    
    // Continue scanning loop
    if (isScanning) {
      animationFrameIdRef.current = requestAnimationFrame(scanFrame);
    }
  }
  
  // Draw visual indicators on the canvas
  function drawScanOverlay(ctx: CanvasRenderingContext2D, width: number, height: number) {
    // Draw a scan line that moves up and down
    const scanLineY = Math.sin(Date.now() / 500) * (height * 0.4) + (height * 0.5);
    ctx.beginPath();
    ctx.moveTo(0, scanLineY);
    ctx.lineTo(width, scanLineY);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
    ctx.stroke();
    
    // Draw a center targeting rectangle
    const centerX = width * 0.25;
    const centerY = height * 0.25;
    const centerWidth = width * 0.5;
    const centerHeight = height * 0.5;
    
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(centerX, centerY, centerWidth, centerHeight);
    ctx.setLineDash([]);
    
    // Add scan count
    ctx.font = '14px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(5, 5, 70, 20);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillText(`Scan: ${scanCount}`, 10, 20);
  }

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
        
        <div className="w-full relative rounded-md overflow-hidden border-2 border-gray-300">
          {/* Video container with scan animation */}
          <div className="relative aspect-video bg-muted">
            {/* Video element */}
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              muted
            />
            
            {/* Canvas element - positioned on top of video */}
            <canvas 
              ref={canvasRef}
              className={`absolute inset-0 w-full h-full ${isScanning ? 'block' : 'hidden'}`}
            />
            
            {/* Scanning line animation */}
            {isScanning && (
              <div 
                className="absolute left-0 right-0 h-0.5 bg-red-500 z-10"
                style={{
                  animation: 'scan 1.5s infinite linear',
                  top: '50%'
                }}
              />
            )}
            
            {/* Placeholder when not scanning */}
            {!isScanning && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/80">
                <div className="text-center p-4">
                  <Camera className="h-12 w-12 text-muted-foreground mb-2 mx-auto" />
                  <p className="text-muted-foreground">Click "Start Camera" to begin scanning</p>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Output display */}
        <div className="mt-4 border p-3 rounded-md bg-gray-50">
          <div className="font-medium text-sm mb-1">Raw Decoded Data:</div>
          <pre className="text-xs p-2 bg-white border rounded overflow-x-auto">
            {rawData}
          </pre>
        </div>
        

        
        <div className="mt-4 text-xs text-muted-foreground text-center">
          Position product barcode within the frame for scanning.
          Ensure good lighting for best results.
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