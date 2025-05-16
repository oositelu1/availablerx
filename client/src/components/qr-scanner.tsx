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
    
    setScanAttempts(prev => prev + 1);
    if (scanAttempts % 30 === 0) {
      console.log(`Scanning attempt ${scanAttempts} - Camera is active`);
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
      
      // Draw the current video frame to the canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Multi-scan approach - scan different regions and scales of the image
      // This increases chance of reading codes that are at an angle or partially visible
      
      // Full frame scan
      const fullImageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const fullCode = jsQR(fullImageData.data, fullImageData.width, fullImageData.height, {
        inversionAttempts: "attemptBoth" // Try both normal and inverted colors
      });
      
      if (fullCode) {
        handleDetectedCode(fullCode, context);
        return;
      }
      
      // Center region scan (where most users hold the barcode)
      const centerX = Math.floor(canvas.width / 4);
      const centerY = Math.floor(canvas.height / 4);
      const centerWidth = Math.floor(canvas.width / 2);
      const centerHeight = Math.floor(canvas.height / 2);
      
      const centerImageData = context.getImageData(centerX, centerY, centerWidth, centerHeight);
      const centerCode = jsQR(centerImageData.data, centerImageData.width, centerImageData.height, {
        inversionAttempts: "attemptBoth"
      });
      
      if (centerCode) {
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
      
      // If this is a frequent scan attempt (every 5 attempts), try grayscale conversion to improve contrast
      if (scanAttempts % 5 === 0) {
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
          handleDetectedCode(grayCode, context);
          return;
        }
      }
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
  
  // Start camera and scanning function - adapted from the provided example
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
      
      // Log available cameras to help debug
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === 'videoinput');
        console.log(`Found ${cameras.length} cameras:`, cameras.map(c => c.label || 'unlabeled camera'));
      } catch (e) {
        console.warn("Could not enumerate devices:", e);
      }
      
      // Request camera access - try environment facing camera first (back camera on phones)
      console.log("Requesting camera access with environment facing mode...");
      const constraints = {
        video: { 
          facingMode: "environment" 
        }
      };
      
      // This approach is from the working example provided
      console.log("Calling getUserMedia with constraints:", constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Camera access granted! Stream tracks:", stream.getTracks().map(t => `${t.kind}:${t.label}`));
      
      streamRef.current = stream;
      
      // Set the stream to the video element
      if (videoRef.current) {
        console.log("Setting video source...");
        videoRef.current.srcObject = stream;
        
        // Add event listeners to debug video element state
        videoRef.current.onloadedmetadata = () => {
          console.log("Video loadedmetadata event fired");
          console.log("Video dimensions:", videoRef.current?.videoWidth, "x", videoRef.current?.videoHeight);
        };
        
        videoRef.current.onplaying = () => {
          console.log("Video playing event fired - video is now actively playing");
        };
        
        // Make sure the video element is visible with styling
        videoRef.current.style.display = "block";
        videoRef.current.style.width = "100%";
        videoRef.current.style.height = "100%";
        
        // Directly play the video as in the working example
        console.log("Attempting to play video...");
        await videoRef.current.play();
        console.log("Video play() method completed successfully");
        
        // Set up canvas once video is playing
        if (canvasRef.current) {
          const canvas = canvasRef.current;
          canvas.height = videoRef.current.videoHeight || 480;
          canvas.width = videoRef.current.videoWidth || 640;
          console.log("Canvas set up with dimensions:", canvas.width, "x", canvas.height);
        }
        
        // Start the scanning loop using requestAnimationFrame instead of setInterval
        // This is more efficient and syncs better with the browser's rendering
        setCameraReady(true);
        setScanningActive(true);
        
        // Use the technique from the example (requestAnimationFrame)
        const tick = () => {
          scanVideoForCode(); // Scan the current frame
          if (videoRef.current?.readyState === videoRef.current?.HAVE_ENOUGH_DATA) {
            // Video has enough data and is playing, continue scanning
            scanIntervalRef.current = requestAnimationFrame(tick);
          } else {
            // Video not ready yet, check again in a moment
            console.log("Video not ready in scanning loop, waiting...");
            setTimeout(() => {
              scanIntervalRef.current = requestAnimationFrame(tick);
            }, 100);
          }
        };
        
        scanIntervalRef.current = requestAnimationFrame(tick);
        console.log("Scanning loop started");
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
          
          {/* Scanning indicator overlay with scan line animation */}
          {isScanning && scanningActive && (
            <>
              {/* Red scan line that moves up and down */}
              <div className="absolute left-0 right-0 h-0.5 bg-red-500 z-10" 
                   style={{
                     animation: 'scan 1.5s infinite ease-in-out',
                   }}
              />
              
              {/* Rectangular frame to show scan area */}
              <div className="absolute inset-0 border-2 border-primary/70 rounded-md pointer-events-none"></div>
              
              {/* Corner indicators */}
              <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-primary"></div>
              <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-primary"></div>
              <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-primary"></div>
              <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-primary"></div>
              
              {/* Status indicator */}
              <div className="absolute top-2 right-2 bg-black/50 rounded-lg px-2 py-1 flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin text-white" />
                <span className="text-white text-xs font-medium">Active</span>
              </div>
              
              {/* Instruction overlay */}
              <div className="absolute bottom-2 left-0 right-0 text-center">
                <div className="bg-black/50 mx-auto inline-block px-3 py-1 rounded-full">
                  <p className="text-white text-xs">Position barcode in frame</p>
                </div>
              </div>
            </>
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