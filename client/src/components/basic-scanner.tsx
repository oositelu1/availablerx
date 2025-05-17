import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Camera } from 'lucide-react';
import jsQR from 'jsqr';

interface BasicScannerProps {
  onScanSuccess: (data: string) => void;
  onClose?: () => void;
}

export default function BasicScanner({ onScanSuccess, onClose }: BasicScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  
  useEffect(() => {
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  
  const startCamera = async () => {
    try {
      setError(null);
      
      // Stop any existing camera
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Get camera access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true,
        audio: false
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setScanning(true);
        scanCode();
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError("Camera access failed. Please make sure camera permissions are enabled.");
      setScanning(false);
    }
  };
  
  const stopCamera = () => {
    setScanning(false);
    
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };
  
  const scanCode = () => {
    if (!scanning) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas) {
      frameRef.current = requestAnimationFrame(scanCode);
      return;
    }
    
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      frameRef.current = requestAnimationFrame(scanCode);
      return;
    }
    
    const context = canvas.getContext('2d');
    if (!context) {
      frameRef.current = requestAnimationFrame(scanCode);
      return;
    }
    
    // Set canvas dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Get image data and scan for QR code
    try {
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "attemptBoth"
      });
      
      if (code) {
        // Found a QR code
        console.log("Code found:", code.data);
        
        // Draw box around detected code
        context.beginPath();
        context.lineWidth = 4;
        context.strokeStyle = "#00FF00";
        context.moveTo(code.location.topLeftCorner.x, code.location.topLeftCorner.y);
        context.lineTo(code.location.topRightCorner.x, code.location.topRightCorner.y);
        context.lineTo(code.location.bottomRightCorner.x, code.location.bottomRightCorner.y);
        context.lineTo(code.location.bottomLeftCorner.x, code.location.bottomLeftCorner.y);
        context.lineTo(code.location.topLeftCorner.x, code.location.topLeftCorner.y);
        context.stroke();
        
        // Stop scanning and pass result
        stopCamera();
        onScanSuccess(code.data);
        return;
      }
    } catch (err) {
      console.error("Error scanning frame:", err);
    }
    
    // Continue scanning if no code found
    frameRef.current = requestAnimationFrame(scanCode);
  };
  
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center">
          <Camera className="h-5 w-5 inline-block mr-2" />
          Scan Product Code
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        {error && (
          <div className="mb-4 bg-red-50 text-red-700 p-3 rounded-md">
            <div className="font-medium">Error</div>
            <div>{error}</div>
          </div>
        )}
        
        <div className="w-full relative rounded-md overflow-hidden border border-gray-300">
          <div className="relative aspect-video bg-black">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
              style={{ display: scanning ? 'block' : 'none' }}
            />
            
            {!scanning && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800/70">
                <div className="text-center p-4 text-white">
                  <Camera className="h-10 w-10 mb-2 mx-auto" />
                  <p>Click "Start Camera" to begin scanning</p>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-4 text-xs text-gray-500 text-center">
          Position product barcode within the camera frame.
          Ensure good lighting for best results.
        </div>
      </CardContent>
      
      <CardFooter className="flex gap-2 justify-between">
        {scanning ? (
          <Button variant="destructive" onClick={stopCamera} className="flex-1">
            Stop Camera
          </Button>
        ) : (
          <Button onClick={startCamera} className="flex-1">
            Start Camera
          </Button>
        )}
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </CardFooter>
    </Card>
  );
}