import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Camera } from 'lucide-react';
import jsQR from 'jsqr';

interface SimpleScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose?: () => void;
}

export default function SimpleScanner({ onScanSuccess, onClose }: SimpleScannerProps) {
  // State
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs
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

  // Start camera and scanning
  async function startCamera() {
    try {
      setIsScanning(true);
      setError(null);
      
      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true 
      });
      
      // Store stream for cleanup
      streamRef.current = stream;
      
      // Connect to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        
        // Start scanning
        scanCode();
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError("Could not access camera. Please check permissions and try again.");
      setIsScanning(false);
    }
  }

  // Stop camera and clean up
  function stopCamera() {
    // Cancel animation frame
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    
    // Stop all camera tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Clear video source
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsScanning(false);
  }

  // Process video frames to find QR codes
  function scanCode() {
    if (!videoRef.current || !canvasRef.current || !isScanning) {
      return;
    }
    
    // Check if video is ready
    if (videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      // Not ready yet, try again next frame
      requestRef.current = requestAnimationFrame(scanCode);
      return;
    }
    
    // Get canvas and context
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    
    if (!context) {
      requestRef.current = requestAnimationFrame(scanCode);
      return;
    }
    
    // Set canvas size to match video
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    
    // Draw video frame to canvas
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    
    try {
      // Get image data for QR processing
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      
      // Try to find QR code in the image
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "attemptBoth"
      });
      
      // If code found
      if (code) {
        console.log("QR code found:", code.data);
        
        // Highlight the found code
        context.beginPath();
        context.lineWidth = 4;
        context.strokeStyle = "#00FF00";
        context.moveTo(code.location.topLeftCorner.x, code.location.topLeftCorner.y);
        context.lineTo(code.location.topRightCorner.x, code.location.topRightCorner.y);
        context.lineTo(code.location.bottomRightCorner.x, code.location.bottomRightCorner.y);
        context.lineTo(code.location.bottomLeftCorner.x, code.location.bottomLeftCorner.y);
        context.lineTo(code.location.topLeftCorner.x, code.location.topLeftCorner.y);
        context.stroke();
        
        // Stop camera and return the result
        stopCamera();
        onScanSuccess(code.data);
        return;
      }
      
      // Draw targeting guide while scanning
      drawTargetingGuide(context, canvas.width, canvas.height);
    } catch (err) {
      console.error("Error scanning frame:", err);
    }
    
    // Continue scanning
    requestRef.current = requestAnimationFrame(scanCode);
  }

  // Draw visual guide to help user position barcode
  function drawTargetingGuide(ctx: CanvasRenderingContext2D, width: number, height: number) {
    // Draw scan box in center
    const centerX = width * 0.25;
    const centerY = height * 0.25;
    const centerWidth = width * 0.5;
    const centerHeight = height * 0.5;
    
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(centerX, centerY, centerWidth, centerHeight);
    ctx.setLineDash([]);
    
    // Moving scan line
    const scanLineY = Math.sin(Date.now() / 500) * (height * 0.4) + (height * 0.5);
    ctx.beginPath();
    ctx.moveTo(0, scanLineY);
    ctx.lineTo(width, scanLineY);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
    ctx.stroke();
    
    // Corner marks
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 3;
    
    // Top left
    ctx.beginPath();
    ctx.moveTo(centerX, centerY + 20);
    ctx.lineTo(centerX, centerY);
    ctx.lineTo(centerX + 20, centerY);
    ctx.stroke();
    
    // Top right
    ctx.beginPath();
    ctx.moveTo(centerX + centerWidth - 20, centerY);
    ctx.lineTo(centerX + centerWidth, centerY);
    ctx.lineTo(centerX + centerWidth, centerY + 20);
    ctx.stroke();
    
    // Bottom right
    ctx.beginPath();
    ctx.moveTo(centerX + centerWidth, centerY + centerHeight - 20);
    ctx.lineTo(centerX + centerWidth, centerY + centerHeight);
    ctx.lineTo(centerX + centerWidth - 20, centerY + centerHeight);
    ctx.stroke();
    
    // Bottom left
    ctx.beginPath();
    ctx.moveTo(centerX + 20, centerY + centerHeight);
    ctx.lineTo(centerX, centerY + centerHeight);
    ctx.lineTo(centerX, centerY + centerHeight - 20);
    ctx.stroke();
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
          <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-700">
            <div className="font-medium">Error</div>
            <div>{error}</div>
          </div>
        )}
        
        <div className="w-full relative rounded-md overflow-hidden border border-gray-300">
          <div className="relative aspect-video bg-black">
            {/* Video element */}
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            
            {/* Canvas element for processing and visualization */}
            <canvas 
              ref={canvasRef}
              className="absolute inset-0 w-full h-full" 
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
        
        <div className="mt-4 text-xs text-gray-500 text-center">
          Position product barcode within the green frame for scanning.
          Hold steady with good lighting.
        </div>
      </CardContent>
      
      <CardFooter className="flex gap-2 justify-between">
        {isScanning ? (
          <Button className="w-full" variant="destructive" onClick={stopCamera}>
            Stop Camera
          </Button>
        ) : (
          <Button className="w-full" onClick={startCamera}>
            Start Camera
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