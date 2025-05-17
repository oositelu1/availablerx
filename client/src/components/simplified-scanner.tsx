import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Camera } from 'lucide-react';
import jsQR from 'jsqr';

interface ScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose?: () => void;
}

export default function SimplifiedScanner({ onScanSuccess, onClose }: ScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  
  // Clean up when component unmounts
  useEffect(() => {
    return () => stopScanner();
  }, []);

  const startScanner = async () => {
    setIsScanning(true);
    setError(null);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        scanQRCode();
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setError('Could not access camera. Please ensure you have given camera permissions.');
      setIsScanning(false);
    }
  };
  
  const stopScanner = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsScanning(false);
  };
  
  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current || !isScanning) {
      return;
    }
    
    if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      
      if (ctx) {
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        
        // Draw video frame to canvas
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        
        // Process frame for QR code
        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "attemptBoth"
          });
          
          if (code) {
            // Found a QR code
            console.log("Code found:", code.data);
            
            // Mark the found code
            ctx.beginPath();
            ctx.lineWidth = 5;
            ctx.strokeStyle = "#00FF00";
            ctx.moveTo(code.location.topLeftCorner.x, code.location.topLeftCorner.y);
            ctx.lineTo(code.location.topRightCorner.x, code.location.topRightCorner.y);
            ctx.lineTo(code.location.bottomRightCorner.x, code.location.bottomRightCorner.y);
            ctx.lineTo(code.location.bottomLeftCorner.x, code.location.bottomLeftCorner.y);
            ctx.lineTo(code.location.topLeftCorner.x, code.location.topLeftCorner.y);
            ctx.stroke();
            
            // Stop scanner and return result
            stopScanner();
            onScanSuccess(code.data);
            return;
          }
          
          // Draw target guide while scanning
          drawTargetGuide(ctx, canvas.width, canvas.height);
        } catch (err) {
          console.error("Scanning error:", err);
        }
      }
    }
    
    // Continue scanning
    animationRef.current = requestAnimationFrame(scanQRCode);
  };
  
  const drawTargetGuide = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Center targeting box
    const boxWidth = width * 0.6;
    const boxHeight = height * 0.6;
    const boxX = (width - boxWidth) / 2;
    const boxY = (height - boxHeight) / 2;
    
    // Draw dashed border
    ctx.strokeStyle = 'rgba(30, 200, 30, 0.7)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 10]);
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
    ctx.setLineDash([]);
    
    // Draw scan line
    const scanLineY = Math.sin(Date.now() / 500) * (boxHeight * 0.5) + boxY + (boxHeight * 0.5);
    ctx.beginPath();
    ctx.moveTo(boxX, scanLineY);
    ctx.lineTo(boxX + boxWidth, scanLineY);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 30, 30, 0.7)';
    ctx.stroke();
    
    // Draw corner markers
    ctx.strokeStyle = 'rgb(30, 200, 30)';
    ctx.lineWidth = 5;
    
    // Top left
    ctx.beginPath();
    ctx.moveTo(boxX, boxY + 30);
    ctx.lineTo(boxX, boxY);
    ctx.lineTo(boxX + 30, boxY);
    ctx.stroke();
    
    // Top right
    ctx.beginPath();
    ctx.moveTo(boxX + boxWidth - 30, boxY);
    ctx.lineTo(boxX + boxWidth, boxY);
    ctx.lineTo(boxX + boxWidth, boxY + 30);
    ctx.stroke();
    
    // Bottom right
    ctx.beginPath();
    ctx.moveTo(boxX + boxWidth, boxY + boxHeight - 30);
    ctx.lineTo(boxX + boxWidth, boxY + boxHeight);
    ctx.lineTo(boxX + boxWidth - 30, boxY + boxHeight);
    ctx.stroke();
    
    // Bottom left
    ctx.beginPath();
    ctx.moveTo(boxX + 30, boxY + boxHeight);
    ctx.lineTo(boxX, boxY + boxHeight);
    ctx.lineTo(boxX, boxY + boxHeight - 30);
    ctx.stroke();
  };

  return (
    <Card className="w-full max-w-md mx-auto shadow-lg">
      <CardHeader className="bg-primary/5 border-b">
        <CardTitle className="text-center flex items-center justify-center gap-2">
          <Camera className="h-5 w-5 text-primary" />
          {isScanning ? "Scanning for Product Code..." : "Scan Product Code"}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-4 space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Camera Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <div className="rounded-lg overflow-hidden border-2 border-muted shadow-sm">
          <div className="aspect-video relative bg-black">
            {/* Video element */}
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              playsInline
              muted
            />
            
            {/* Canvas for processing */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
            />
            
            {/* Placeholder when not scanning */}
            {!isScanning && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="text-center p-4">
                  <Camera className="h-12 w-12 text-primary/50 mb-2 mx-auto" />
                  <p className="text-white/80">Click "Start Camera" to begin scanning</p>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="text-sm text-center text-muted-foreground">
          Position the barcode within the green frame and hold steady.
          Good lighting will improve scanning results.
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-between gap-2 p-4 pt-0">
        {isScanning ? (
          <Button 
            variant="destructive" 
            className="flex-1"
            onClick={stopScanner}
          >
            Stop Camera
          </Button>
        ) : (
          <Button 
            variant="default" 
            className="flex-1"
            onClick={startScanner}
          >
            Start Camera
          </Button>
        )}
        
        {onClose && (
          <Button 
            variant="outline" 
            onClick={onClose}
          >
            Cancel
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}