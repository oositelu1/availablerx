import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Camera, RefreshCw } from 'lucide-react';
import jsQR from 'jsqr';
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat, Result } from '@zxing/library';

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
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  // Initialize ZXing reader on component mount
  useEffect(() => {
    try {
      // Configure ZXing hints for better detection
      const hints = new Map();
      
      // Include both QR and Data Matrix formats with higher priority
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.QR_CODE,
        BarcodeFormat.DATA_MATRIX,
        BarcodeFormat.CODE_128,
        BarcodeFormat.EAN_13,
      ]);
      
      // Try harder for better detection
      hints.set(DecodeHintType.TRY_HARDER, true);
      
      // Create reader with our custom configuration
      const reader = new BrowserMultiFormatReader(hints);
      zxingReaderRef.current = reader;
      
      console.log("ZXing barcode reader initialized");
    } catch (err) {
      console.error("Failed to initialize ZXing reader:", err);
    }
    
    // Clean up on unmount
    return () => {
      stopScanning();
      
      // Reset ZXing reader
      if (zxingReaderRef.current) {
        zxingReaderRef.current.reset();
        zxingReaderRef.current = null;
      }
    };
  }, []);

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
      
      // Try ZXing decoding first (better for DataMatrix)
      if (zxingReaderRef.current) {
        try {
          console.log("Starting ZXing barcode reader...");
          
          // Decode continuously from video stream
          await zxingReaderRef.current.decodeFromConstraints(
            { video: { facingMode: "environment" } },
            videoRef.current,
            (result: Result | undefined, error: Exception | undefined) => {
              if (result) {
                // Successfully decoded a barcode
                console.log("ZXing decoded:", result);
                
                // Display and return the result
                setRawData(result.getText());
                onScanSuccess(result.getText(), { result });
                
                // Stop scanning after success
                stopScanning();
              }
              
              if (error) {
                // Only log errors, don't stop scanning on transient errors
                console.log("ZXing decode error:", error);
                setScanCount(count => count + 1);
              }
            }
          );
          
          // Store the stream for cleanup
          if (videoRef.current.srcObject instanceof MediaStream) {
            streamRef.current = videoRef.current.srcObject;
          }
          
          // Set flags to show scanning is active
          setIsScanning(true);
          
          return; // ZXing reader started successfully
        } catch (zxingError) {
          console.error("Error starting ZXing reader:", zxingError);
          // Fall back to jsQR if ZXing fails
        }
      }
      
      // Fallback to jsQR if ZXing failed or isn't available
      console.log("Falling back to jsQR scanner...");
      
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
          scanJsQrFrame();
        }
      };
      
    } catch (err) {
      console.error("Error setting up camera:", err);
      setError("Camera access failed: " + 
               (err instanceof Error ? err.message : String(err)));
      setIsScanning(false);
    }
  }

  function stopScanning() {
    console.log("Stopping scanner...");
    
    // Stop ZXing reader if active
    if (zxingReaderRef.current) {
      try {
        zxingReaderRef.current.reset();
      } catch (e) {
        console.log("Error resetting ZXing reader:", e);
      }
    }
    
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

  function scanJsQrFrame() {
    if (!videoRef.current || !canvasRef.current) return;
    
    // Only process video if it has enough data and is playing
    if (videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA || 
        videoRef.current.paused) {
      // Keep trying if not ready yet
      animationFrameIdRef.current = requestAnimationFrame(scanJsQrFrame);
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
        console.log("jsQR Code found:", code.data);
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
      console.error("Error in jsQR scanning loop:", err);
    }
    
    // Continue scanning loop
    if (isScanning) {
      animationFrameIdRef.current = requestAnimationFrame(scanJsQrFrame);
    }
  }
  
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
          
          {/* Hidden canvas for processing */}
          <canvas ref={canvasRef} className="hidden" />
        </div>
        
        {/* Output display */}
        <div className="mt-4 border p-3 rounded-md bg-gray-50">
          <div className="font-medium text-sm mb-1">Raw Decoded Data:</div>
          <pre className="text-xs p-2 bg-white border rounded overflow-x-auto">
            {rawData}
          </pre>
        </div>
        
        {/* Sample barcode section - clearly visible */}
        <div className="mt-6 border border-blue-200 bg-blue-50 p-4 rounded-md">
          <h3 className="text-base font-medium mb-2">Sample Barcode for Testing</h3>
          <p className="text-sm mb-3">
            Display this barcode on a separate device and scan it with the camera:
          </p>
          <div className="p-4 bg-white border rounded-md text-center">
            <img 
              src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAACgCAMAAAC8EZcfAAAAM1BMVEX///8AAADMzMxmZmaZmZnMzMyZmZnMzMxmZmaZmZnMzMxmZmaZmZnMzMxmZmaZmZnMzMzZBQG4AAAEVElEQVR4AezBgQAAAACAoP2pF6kCAAAAAAAAAAAAAACAuTkQQjEYgAG4EWgCHf/Ygwp22QCFkEVTQn9YfTqJf/mCIccSQn7fxxv88/frj/0wDuv1Avwq4J8+Fxv9E8D3vxJPpyegfw0+W59Trgm/z10B/X0dYPSjgLEVsID1ggUsoL1gAQtoL1jAAtoLFrCA9oIFLKC9YAELaC9YwALaCxawgPaCBSygveCZAuI+2jtYDR6Rvc8QIM8fuXlY2e9+VmHwSLsKWBiMVh0UJ/snqsMjA/bvwaIUfv0WrMI6ExebEyvMDRZXP3AlnsQ2Yy9YDZ6D/VCVupuXuIkNGBNYFZ48fDe+nz5XaT79yYd0VhjcYJHxctUvdlEfpHL1Vzus7Y9YFZ48fKDhm3+/XLfLdkrpPm8sq8aTh294Y9ql9LzB4t7fhFXjicMnPxrfVLeLlC72Vg2eOHzbrdV9HS628baxqvDk4RPfUK5YdtKaIe1/a1kVnjx8o3mFrHLDL9xg1eKJwwdsNfLQSXvBQu/BqsYThw/YBgzkWK5YUg8WAie1uY+Tnzx85bHAtGP7jlUzZLSCJw9f+Si+qVx0/YrFdGNVj6fvxDfGG6wQ2YqP0OKpw1fqrriAjuWmGYeEz/7k4YPTi/hCJ+3l3i+2/aGqx1OHD45l+KTYXfvFthcrDE4avkX9tMqh3BaZ0Yt9xQqDk4ZveB7C+Lztm7Gi4KThG98XY3xL+z6sKDhp+JbXBVe6oXxbHONnbDlWfPLwgWt5Hnrc5vO+VrR1WGFwwvD162Jsw3l79B6sODhh+NiAs7qr3GIbH6ssVhicMHzDxQbMiYt9VrR1WGFwwvCNn/cFv7EbzHisaKo9Yfjk873V3UO+LR7jXaUWKwpOGD7wjc9bG262LR7js8pjhcEJwwcXKN14s93xDis+efjEd1Wef8UXWv1RxcGJw6drwgbrXn/xHTbYvVbxycNXLnKYFXe+L/Z6HnqscDhp+PYL1m2dW26wvV6oMDh5+OD0JvlM6jtf7HWDhcGJwwfH5xVrN9iA1WBFwcnDB6dny+fv+5Ov/c8qHncL2PtHtR4rCk4cvq1cxO5irLiN1lY1VhycNHxj6cbYDQbu7oLV4snDdztpdRcfb+xerdZxJ06eNHzl8cZSHh6s4ja+0LpXqzW/4YOnDJ/44NQfbqxvbtZztaaGTxi+W7l8XB6xik23VzxWaPh04bu9L46v+6tN99i9WKHhE4YPXI/HxXq+2HTftFjx1OG7vfG5XMbH7XF7tXutRuGTha98XuyXxxtL3B9vrFf7L1g8cfjuo7XNY7T62Fm6V6s1PnH4ykXu5vkRK9rkq1XX+MTh2996oLvcvS/Yvd1jxcfjycP3fNziIx+tXc4EvPv2iuef//rkBY8AAAAAgCDAX6mHAAAAAAAAAAAAAACwADDVZoT1g/C+AAAAAElFTkSuQmCC"
              alt="GS1 DataMatrix Barcode"
              className="mx-auto border border-gray-200 rounded-md"
              style={{ height: "200px", width: "200px" }}
            />
            <div className="mt-3 text-sm font-medium">
              GS1 DataMatrix Barcode
            </div>
            <div className="mt-1 text-xs text-gray-500 max-w-md mx-auto">
              Contains: (01)04012345678901(17)250331(10)ABCD1234
            </div>
          </div>
        </div>
        
        <div className="mt-4 text-xs text-muted-foreground text-center">
          Position product barcode within the frame for scanning.
          Ensure good lighting for best results.
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