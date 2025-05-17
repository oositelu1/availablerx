import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Camera, RotateCw } from 'lucide-react';
import jsQR from 'jsqr';

interface EnhancedScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose?: () => void;
}

export default function EnhancedScanner({ onScanSuccess, onClose }: EnhancedScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanAttempts, setScanAttempts] = useState(0);
  const [inverted, setInverted] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef<number | null>(null);
  
  // Clean up when component unmounts
  useEffect(() => {
    return () => stopScanner();
  }, []);

  const startScanner = async () => {
    setIsScanning(true);
    setError(null);
    setScanAttempts(0);
    
    try {
      // Stop any existing scanning process
      stopScanner();
      
      // Request camera access with environment (back) camera preference
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      
      // Store stream for cleanup
      streamRef.current = stream;
      
      // Connect to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        
        // Start scanning for barcodes
        scanFrame();
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('Could not access camera. Please check your permissions and try again.');
      setIsScanning(false);
    }
  };
  
  const stopScanner = () => {
    setIsScanning(false);
    
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
  };
  
  const scanFrame = () => {
    if (!videoRef.current || !canvasRef.current || !isScanning) {
      return;
    }
    
    // Check if video is ready
    if (videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      // Try again when not ready
      requestRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    
    // Get canvas and context
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    
    if (!context) {
      requestRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    
    // Set canvas size to match video
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    
    // Draw video to canvas
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    
    // Get image data from canvas
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    
    // If we're using inverted mode, invert the colors
    if (inverted) {
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255 - data[i];        // red
        data[i + 1] = 255 - data[i + 1]; // green
        data[i + 2] = 255 - data[i + 2]; // blue
      }
    }
    
    // Try to decode QR/DataMatrix code
    try {
      // Try to find QR code in the image with jsQR
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "attemptBoth"
      });
      
      // Process if code found
      if (code) {
        console.log("Code found:", code.data);
        
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
        
        // Stop scanner and return result
        stopScanner();
        onScanSuccess(code.data);
        return;
      }
    } catch (err) {
      console.error("Error scanning frame:", err);
    }
    
    // Track scan attempts and toggle inversion every 30 frames for better detection
    setScanAttempts(prev => {
      const newCount = prev + 1;
      if (newCount % 30 === 0) {
        setInverted(prevInverted => !prevInverted);
      }
      return newCount;
    });
    
    // Draw targeting guide
    drawTargetGuide(context, canvas.width, canvas.height);
    
    // Continue scanning
    requestRef.current = requestAnimationFrame(scanFrame);
  };
  
  const drawTargetGuide = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Size based on screen dimensions
    const size = Math.min(width, height) * 0.65;
    const x = (width - size) / 2;
    const y = (height - size) / 2;
    
    // Clear previous drawing
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(videoRef.current!, 0, 0, width, height);
    
    // Draw semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, width, height);
    
    // Cut out transparent scanning area
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.clearRect(x, y, size, size);
    
    // Draw corner markers
    const cornerSize = size * 0.1;
    ctx.strokeStyle = '#33cc33';
    ctx.lineWidth = 4;
    
    // Top left
    ctx.beginPath();
    ctx.moveTo(x, y + cornerSize);
    ctx.lineTo(x, y);
    ctx.lineTo(x + cornerSize, y);
    ctx.stroke();
    
    // Top right
    ctx.beginPath();
    ctx.moveTo(x + size - cornerSize, y);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x + size, y + cornerSize);
    ctx.stroke();
    
    // Bottom right
    ctx.beginPath();
    ctx.moveTo(x + size, y + size - cornerSize);
    ctx.lineTo(x + size, y + size);
    ctx.lineTo(x + size - cornerSize, y + size);
    ctx.stroke();
    
    // Bottom left
    ctx.beginPath();
    ctx.moveTo(x + cornerSize, y + size);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x, y + size - cornerSize);
    ctx.stroke();
    
    // Draw scanning line
    const scanProgress = (scanAttempts % 100) / 100;
    const scanY = y + (size * scanProgress);
    
    ctx.beginPath();
    ctx.moveTo(x, scanY);
    ctx.lineTo(x + size, scanY);
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Add scanning text
    ctx.font = '12px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('Position the code in this area', width / 2, y + size + 25);
    
    // Add scan mode indicator
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(width / 2 - 60, y - 25, 120, 20);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(inverted ? 'Inverted Mode' : 'Normal Mode', width / 2, y - 10);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center flex items-center justify-center gap-2">
          <Camera className="h-5 w-5" />
          Scan DataMatrix/Barcode
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Camera Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <div className="rounded-lg overflow-hidden border-2 border-gray-300">
          <div className="relative aspect-video bg-black">
            {/* Video element */}
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
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
                  <Camera className="h-12 w-12 text-white/60 mb-2 mx-auto" />
                  <p className="text-white/80">Click "Start Scanner" to begin scanning</p>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground text-center">
          <p>Position product barcode within the green frame.</p>
          <p>Hold steady with good lighting for best results.</p>
          <p className="mt-1">
            <span className="inline-flex items-center gap-1 bg-muted rounded-full px-2 py-0.5">
              <RotateCw className="h-3 w-3" /> {scanAttempts > 0 ? `Scan attempts: ${scanAttempts}` : 'Ready to scan'}
            </span>
          </p>
        </div>
      </CardContent>
      
      <CardFooter className="flex gap-2 justify-between">
        {isScanning ? (
          <Button variant="destructive" onClick={stopScanner} className="flex-1">
            Stop Scanner
          </Button>
        ) : (
          <Button onClick={startScanner} className="flex-1">
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