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
  const [scanAttempts, setScanAttempts] = useState(0); // Track scan attempts for debug
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  
  // Cleanup function to stop camera and scanning - updated for requestAnimationFrame
  const stopScanning = () => {
    // Cancel the animation frame request if active
    if (scanIntervalRef.current) {
      cancelAnimationFrame(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    // Stop the camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        console.log("Stopping track:", track.kind, track.label);
        track.stop();
      });
      streamRef.current = null;
    }
    
    // Clear video source if present
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject = null;
    }
    
    // Reset UI state
    setIsScanning(false);
    setScanningActive(false);
    setCameraReady(false);
    
    console.log("Camera and scanning stopped");
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
    
    // Try to identify if this is a GS1 barcode format
    // GS1 barcodes typically have application identifiers in parentheses like (01), (10), (17), etc.
    const isLikelyGS1 = /\(\d{2}\)/.test(text); // Simple test for presence of application identifiers
    
    if (isLikelyGS1) {
      console.log("Detected GS1 format barcode");
    } else {
      console.log("Not a standard GS1 format, using raw text");
    }
    
    // Return the raw text - it should be in GS1 format like "(01)12345678901234(17)220930(10)ABC123"
    return text;
  };
  
  // Function to scan for QR/Data Matrix codes in the video stream
  const scanVideoForCode = () => {
    // Check that we have all required references and video is ready to be processed
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    
    // Ensure video is ready and has enough data
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      console.log("Video not ready yet, waiting for more data...");
      return;
    }
    
    // Increment scan attempts counter
    setScanAttempts(prev => prev + 1);
    
    // Log every 10 attempts to show scanner is working
    if (scanAttempts % 10 === 0) {
      console.log(`Active scanning - attempt ${scanAttempts}`);
    }
    
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    
    if (!context) {
      console.error("Could not get canvas context");
      return;
    }
    
    try {
      // Ensure canvas dimensions match video dimensions
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        console.log("Setting canvas dimensions to match video:", video.videoWidth, "x", video.videoHeight);
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      
      // Clear the canvas
      context.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw the current video frame to the canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Add visible scan line that moves to show user the scanning is active
      // This is the red line that moves up and down
      const scanLineY = (scanAttempts % 100) / 100 * canvas.height;
      context.beginPath();
      context.moveTo(0, scanLineY);
      context.lineTo(canvas.width, scanLineY);
      context.lineWidth = 2;
      context.strokeStyle = 'rgba(255, 0, 0, 0.5)';
      context.stroke();
      
      // Draw scanning region indicators
      context.strokeStyle = '#25D366';  // WhatsApp green color
      context.lineWidth = 2;
      
      // Draw full scan region
      context.setLineDash([5, 5]); // Dashed line
      context.strokeRect(0, 0, canvas.width, canvas.height);
      
      // Draw center region where we look more carefully
      const centerX = Math.floor(canvas.width / 4);
      const centerY = Math.floor(canvas.height / 4);
      const centerWidth = Math.floor(canvas.width / 2);
      const centerHeight = Math.floor(canvas.height / 2);
      
      context.strokeStyle = '#FF3B58'; // Red-pink
      context.setLineDash([]); // Solid line
      context.strokeRect(centerX, centerY, centerWidth, centerHeight);
      
      // Multi-scan approach - scan different regions and scales of the image
      
      // Full frame scan
      const fullImageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const fullCode = jsQR(fullImageData.data, fullImageData.width, fullImageData.height, {
        inversionAttempts: "attemptBoth" // Try both normal and inverted colors
      });
      
      if (fullCode) {
        console.log("Found code in full image");
        handleDetectedCode(fullCode, context);
        return;
      }
      
      // Center region scan (where most users hold the barcode)
      const centerImageData = context.getImageData(centerX, centerY, centerWidth, centerHeight);
      const centerCode = jsQR(centerImageData.data, centerImageData.width, centerImageData.height, {
        inversionAttempts: "attemptBoth"
      });
      
      if (centerCode) {
        console.log("Found code in center region");
        // Adjust location coordinates to match the full canvas
        centerCode.location.topLeftCorner.x += centerX;
        centerCode.location.topLeftCorner.y += centerY;
        centerCode.location.topRightCorner.x += centerX;
        centerCode.location.topRightCorner.y += centerY;
        centerCode.location.bottomLeftCorner.x += centerX;
        centerCode.location.bottomLeftCorner.y += centerY;
        centerCode.location.bottomRightCorner.x += centerX;
        centerCode.location.bottomRightCorner.y += centerY;
        
        handleDetectedCode(centerCode, context);
        return;
      }
      
      // Every 5th frame, try additional image processing techniques
      if (scanAttempts % 5 === 0) {
        // Indicate we're doing special processing
        const indicator = document.createElement('div');
        indicator.textContent = "Enhanced scanning...";
        indicator.style.position = 'absolute';
        indicator.style.bottom = '10px';
        indicator.style.left = '10px';
        indicator.style.color = 'white';
        indicator.style.backgroundColor = 'rgba(0,0,0,0.5)';
        indicator.style.padding = '5px';
        indicator.style.borderRadius = '3px';
        
        // Convert to grayscale for better contrast
        const grayImageData = new ImageData(
          new Uint8ClampedArray(fullImageData.data),
          fullImageData.width,
          fullImageData.height
        );
        
        // Apply grayscale filter
        for (let i = 0; i < grayImageData.data.length; i += 4) {
          const gray = (grayImageData.data[i] + grayImageData.data[i+1] + grayImageData.data[i+2]) / 3;
          grayImageData.data[i] = gray;
          grayImageData.data[i+1] = gray;
          grayImageData.data[i+2] = gray;
        }
        
        const grayCode = jsQR(grayImageData.data, grayImageData.width, grayImageData.height, {
          inversionAttempts: "attemptBoth"
        });
        
        if (grayCode) {
          console.log("Found code with grayscale processing");
          handleDetectedCode(grayCode, context);
          return;
        }
      }
      
      // Add scan attempt counter to the screen
      context.font = '12px Arial';
      context.fillStyle = 'rgba(255, 255, 255, 0.8)';
      context.fillRect(5, 5, 120, 20);
      context.fillStyle = 'black';
      context.fillText(`Scanning: ${scanAttempts} frames`, 10, 20);
      
    } catch (err) {
      console.error("Error processing video frame:", err);
    }
  };
  
  // Helper function to handle detected QR/barcode
  const handleDetectedCode = (code: any, context: CanvasRenderingContext2D) => {
    console.log("Code detected:", code.data);
    
    // Draw a highlight around the detected code
    context.beginPath();
    context.lineWidth = 4;
    context.strokeStyle = "#FF3B58";
    context.moveTo(code.location.topLeftCorner.x, code.location.topLeftCorner.y);
    context.lineTo(code.location.topRightCorner.x, code.location.topRightCorner.y);
    context.lineTo(code.location.bottomRightCorner.x, code.location.bottomRightCorner.y);
    context.lineTo(code.location.bottomLeftCorner.x, code.location.bottomLeftCorner.y);
    context.lineTo(code.location.topLeftCorner.x, code.location.topLeftCorner.y);
    context.stroke();
    
    // Fill in the QR code for highlighting
    context.fillStyle = "rgba(255, 59, 88, 0.2)";
    context.fill();
    
    // Parse the barcode data
    const parsedCode = parseGS1Barcode(code.data);
    
    // Stop scanning and call the success handler
    stopScanning();
    onScanSuccess(parsedCode, { result: code });
  };
  
  // Start camera and scanning function - simplified approach
  const startScanning = async () => {
    setIsScanning(true);
    setError(null);
    setScanAttempts(0); // Reset scan attempts counter
    
    try {
      // Cleanup any existing scanning/camera
      stopScanning();
      
      console.log("Starting camera for barcode scanning...");
      
      // Make sure we have the video element reference
      if (!videoRef.current) {
        throw new Error("Camera initialization failed - video element not available");
      }
      
      // Check camera support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser doesn't support camera access");
      }
      
      // Request camera access with simple constraints
      const constraints = { video: true };
      
      console.log("Requesting camera access...");
      
      try {
        // Get the media stream
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log("Camera access granted! Got stream with tracks:", stream.getTracks().length);
        
        // Store the stream reference
        streamRef.current = stream;
        
        // Set the stream to the video element
        videoRef.current.srcObject = stream;
        
        // Wait for the video to be ready
        videoRef.current.onloadedmetadata = () => {
          console.log("Video metadata loaded");
          
          // Set default canvas dimensions if video doesn't have dimensions yet
          const canvas = canvasRef.current;
          if (canvas) {
            canvas.width = videoRef.current?.videoWidth || 640;
            canvas.height = videoRef.current?.videoHeight || 480;
            console.log("Canvas dimensions set:", canvas.width, "x", canvas.height);
          }
        };
        
        // Handle video playing successfully
        videoRef.current.onplaying = () => {
          console.log("Video is now playing");
          setCameraReady(true);
          setScanningActive(true);
          
          // Start the scanning process once the video is playing
          const tick = () => {
            if (videoRef.current && videoRef.current.readyState >= 2) {
              scanVideoForCode();
            }
            scanIntervalRef.current = requestAnimationFrame(tick);
          };
          
          scanIntervalRef.current = requestAnimationFrame(tick);
          console.log("Scanning process started");
        };
        
        // Try to start playing the video
        videoRef.current.play().catch((e: Error) => {
          console.error("Error playing video:", e);
          throw new Error("Could not play video: " + e.message);
        });
        
      } catch (error) {
        console.error("Error accessing camera:", error);
        throw new Error("Camera access failed: " + (error instanceof Error ? error.message : String(error)));
      }
    } catch (err) {
      // Handle any errors during camera setup
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("Camera error:", errorMsg);
      
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
          {/* We need both video and canvas visible for this to work properly */}
          {isScanning ? (
            <>
              {/* Video element needs to be visible for mobile browsers */}
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />
              
              {/* Canvas overlays on top of the video */}
              <canvas 
                ref={canvasRef} 
                className="absolute inset-0 w-full h-full object-cover z-10"
              />
              
              {/* Status indicator */}
              <div className="absolute top-2 right-2 bg-black/70 rounded-lg px-2 py-1 flex items-center gap-1 z-20">
                <Loader2 className="h-3 w-3 animate-spin text-white" />
                <span className="text-white text-xs font-medium">Scanning...</span>
              </div>
              
              {/* Counter display to show active scanning */}
              <div className="absolute top-2 left-2 bg-black/70 rounded-lg px-2 py-1 z-20">
                <span className="text-white text-xs">Frames: {scanAttempts}</span>
              </div>
              
              {/* Instruction overlay with larger text for visibility */}
              <div className="absolute bottom-2 left-0 right-0 text-center z-20">
                <div className="bg-black/70 mx-auto inline-block px-4 py-2 rounded-lg">
                  <p className="text-white text-sm font-medium">Position barcode in frame</p>
                </div>
              </div>
            </>
          ) : (
            /* Placeholder when camera is not active */
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