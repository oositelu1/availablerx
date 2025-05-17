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
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef<number | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  async function startCamera() {
    try {
      setIsScanning(true);
      setError(null);
      setRawData("Scanning...");
      
      // Get camera stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true,
        audio: false
      });
      
      // Store stream for cleanup
      streamRef.current = stream;
      
      // Connect to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        
        // Start scanning
        scanQRCode();
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError("Could not access camera. Please check permissions and try again.");
      setIsScanning(false);
    }
  }

  function stopCamera() {
    // Cancel animation frame
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    
    // Stop all tracks in the stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Clear video source
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsScanning(false);
    setRawData("Scanner stopped");
  }

  function scanQRCode() {
    if (!videoRef.current || !canvasRef.current || !isScanning) {
      return;
    }
    
    // Check if video is ready
    if (videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      // Try again when not ready
      requestRef.current = requestAnimationFrame(scanQRCode);
      return;
    }
    
    // Get canvas context
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    
    if (!context) {
      requestRef.current = requestAnimationFrame(scanQRCode);
      return;
    }
    
    // Set canvas size to match video
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    
    // Draw the video frame to the canvas
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    
    try {
      // Get image data for processing
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      
      // Try to find QR code in the image
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "attemptBoth"
      });
      
      // Process if code found
      if (code) {
        console.log("QR code found:", code.data);
        setRawData(code.data);
        
        // Highlight the code
        context.beginPath();
        context.lineWidth = 4;
        context.strokeStyle = "#FF3B58";
        context.moveTo(code.location.topLeftCorner.x, code.location.topLeftCorner.y);
        context.lineTo(code.location.topRightCorner.x, code.location.topRightCorner.y);
        context.lineTo(code.location.bottomRightCorner.x, code.location.bottomRightCorner.y);
        context.lineTo(code.location.bottomLeftCorner.x, code.location.bottomLeftCorner.y);
        context.lineTo(code.location.topLeftCorner.x, code.location.topLeftCorner.y);
        context.stroke();
        
        // Stop scanning and return the result
        stopCamera();
        onScanSuccess(code.data, { result: code });
        return;
      }
      
      // Draw a targeting guide
      drawTargetGuide(context, canvas.width, canvas.height);
    } catch (err) {
      console.error("Error scanning frame:", err);
    }
    
    // Continue scanning
    requestRef.current = requestAnimationFrame(scanQRCode);
  }

  function drawTargetGuide(ctx: CanvasRenderingContext2D, width: number, height: number) {
    // Draw center rectangle
    const centerX = width * 0.25;
    const centerY = height * 0.25;
    const centerWidth = width * 0.5;
    const centerHeight = height * 0.5;
    
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(centerX, centerY, centerWidth, centerHeight);
    ctx.setLineDash([]);
    
    // Draw scan line that moves up and down
    const scanLineY = Math.sin(Date.now() / 500) * (height * 0.4) + (height * 0.5);
    ctx.beginPath();
    ctx.moveTo(0, scanLineY);
    ctx.lineTo(width, scanLineY);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
    ctx.stroke();
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center flex items-center justify-center gap-2">
          <Camera className="h-5 w-5" />
          {isScanning ? "Scanning for Codes..." : "Scan Product Code"}
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
          <div className="relative aspect-video bg-black">
            {/* Video element */}
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              autoPlay
            />
            
            {/* Canvas for processing and display */}
            <canvas 
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
              style={{ display: isScanning ? 'block' : 'none' }}
            />
            
            {/* Placeholder when not scanning */}
            {!isScanning && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="text-center p-4">
                  <Camera className="h-12 w-12 text-white/60 mb-2 mx-auto" />
                  <p className="text-white/80">Click "Start Camera" to begin scanning</p>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-4 text-xs text-muted-foreground text-center">
          Position product barcode within the green frame for scanning.
          Hold steady with good lighting.
        </div>
      </CardContent>
      
      <CardFooter className="flex gap-2 justify-between">
        {isScanning ? (
          <Button variant="destructive" onClick={stopCamera}>Stop Camera</Button>
        ) : (
          <Button onClick={startCamera}>Start Camera</Button>
        )}
        {onClose && (
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        )}
      </CardFooter>
    </Card>
  );
}