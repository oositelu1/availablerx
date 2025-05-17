import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Camera } from 'lucide-react';
import jsQR from 'jsqr';
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library';

interface DataMatrixScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose?: () => void;
}

export default function DataMatrixScanner({ onScanSuccess, onClose }: DataMatrixScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<'zxing' | 'jsqr'>('zxing');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const jsqrRequestRef = useRef<number | null>(null);
  
  // Initialize ZXing reader with DataMatrix capability
  useEffect(() => {
    const hints = new Map();
    const formats = [BarcodeFormat.DATA_MATRIX, BarcodeFormat.QR_CODE];
    hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
    
    zxingReaderRef.current = new BrowserMultiFormatReader(hints);
    
    return () => {
      stopScanner();
    };
  }, []);
  
  const startScanner = async () => {
    setIsScanning(true);
    setError(null);
    
    try {
      if (scanMode === 'zxing') {
        await startZXingScanner();
      } else {
        await startJsQRScanner();
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('Could not access camera. Please check your camera permissions.');
      setIsScanning(false);
    }
  };
  
  const startZXingScanner = async () => {
    if (!videoRef.current || !zxingReaderRef.current) return;
    
    try {
      // Reset any previous scan operations
      stopScanner();
      
      // Start ZXing continuous scanning
      zxingReaderRef.current.decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        videoRef.current,
        (result, error) => {
          if (result) {
            console.log('ZXing found code:', result.getText());
            
            // Stop scanner and return result
            stopScanner();
            onScanSuccess(result.getText());
          }
          
          if (error && !(error instanceof TypeError)) {
            // Ignore TypeError as they're usually just "no barcode found" errors
            console.error('ZXing error:', error);
          }
        }
      );
    } catch (err) {
      console.error('ZXing scanner error:', err);
      setError('Failed to start scanner: ' + (err instanceof Error ? err.message : String(err)));
      setIsScanning(false);
      
      // Try fallback to jsQR if ZXing fails
      setScanMode('jsqr');
      await startJsQRScanner();
    }
  };
  
  const startJsQRScanner = async () => {
    try {
      // Get camera stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      
      // Connect to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        
        // Start scanning with jsQR
        scanQRCode();
      }
    } catch (err) {
      console.error('jsQR scanner error:', err);
      setError('Camera access failed: ' + (err instanceof Error ? err.message : String(err)));
      setIsScanning(false);
    }
  };
  
  const stopScanner = () => {
    setIsScanning(false);
    
    // Stop ZXing scanner
    if (zxingReaderRef.current) {
      zxingReaderRef.current.reset();
    }
    
    // Stop jsQR animation frame
    if (jsqrRequestRef.current) {
      cancelAnimationFrame(jsqrRequestRef.current);
      jsqrRequestRef.current = null;
    }
    
    // Release camera
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };
  
  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current || !isScanning) return;
    
    if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      
      if (context) {
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        
        // Draw video frame to canvas
        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        
        try {
          // Process with jsQR
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth'
          });
          
          if (code) {
            console.log('jsQR found code:', code.data);
            
            // Highlight found code
            context.beginPath();
            context.lineWidth = 4;
            context.strokeStyle = '#00FF00';
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
          
          // Draw targeting guide
          drawTargetGuide(context, canvas.width, canvas.height);
        } catch (err) {
          console.error('Error processing frame:', err);
        }
      }
    }
    
    // Continue scanning
    jsqrRequestRef.current = requestAnimationFrame(scanQRCode);
  };
  
  const drawTargetGuide = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Draw center rectangle for targeting
    const boxWidth = width * 0.6;
    const boxHeight = height * 0.6;
    const boxX = (width - boxWidth) / 2;
    const boxY = (height - boxHeight) / 2;
    
    // Draw targeting box
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
    ctx.setLineDash([]);
    
    // Draw scan line
    const scanLineY = Math.sin(Date.now() / 500) * (height * 0.3) + (height * 0.5);
    ctx.beginPath();
    ctx.moveTo(0, scanLineY);
    ctx.lineTo(width, scanLineY);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
    ctx.stroke();
    
    // Draw corner markers
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 4;
    
    // Top left corner
    ctx.beginPath();
    ctx.moveTo(boxX, boxY + 30);
    ctx.lineTo(boxX, boxY);
    ctx.lineTo(boxX + 30, boxY);
    ctx.stroke();
    
    // Top right corner
    ctx.beginPath();
    ctx.moveTo(boxX + boxWidth - 30, boxY);
    ctx.lineTo(boxX + boxWidth, boxY);
    ctx.lineTo(boxX + boxWidth, boxY + 30);
    ctx.stroke();
    
    // Bottom right corner
    ctx.beginPath();
    ctx.moveTo(boxX + boxWidth, boxY + boxHeight - 30);
    ctx.lineTo(boxX + boxWidth, boxY + boxHeight);
    ctx.lineTo(boxX + boxWidth - 30, boxY + boxHeight);
    ctx.stroke();
    
    // Bottom left corner
    ctx.beginPath();
    ctx.moveTo(boxX + 30, boxY + boxHeight);
    ctx.lineTo(boxX, boxY + boxHeight);
    ctx.lineTo(boxX, boxY + boxHeight - 30);
    ctx.stroke();
  };
  
  const toggleScanMode = () => {
    stopScanner();
    setScanMode(prev => prev === 'zxing' ? 'jsqr' : 'zxing');
    setIsScanning(false);
  };

  return (
    <Card className="w-full max-w-md mx-auto shadow-lg">
      <CardHeader className="bg-primary/5 border-b">
        <CardTitle className="text-center flex items-center justify-center gap-2">
          <Camera className="h-5 w-5 text-primary" />
          {isScanning ? "Scanning for DataMatrix/QR..." : "Scan Product Code"}
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
            
            {/* Canvas for jsQR processing */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
              style={{ display: scanMode === 'jsqr' ? 'block' : 'none' }}
            />
            
            {/* Placeholder when not scanning */}
            {!isScanning && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="text-center p-4">
                  <Camera className="h-12 w-12 text-primary/50 mb-2 mx-auto" />
                  <p className="text-white/80">Click "Start Scanner" to begin scanning</p>
                </div>
              </div>
            )}
            
            {/* Scanner mode indicator */}
            {isScanning && (
              <div className="absolute top-2 right-2 bg-black/70 rounded-full px-3 py-1 text-xs text-white">
                {scanMode === 'zxing' ? 'DataMatrix + QR' : 'QR Code'}
              </div>
            )}
          </div>
        </div>
        
        <div className="text-sm text-center text-muted-foreground">
          Position the barcode within the green frame and hold steady.
          <div className="mt-1 text-xs">Using {scanMode === 'zxing' ? 'DataMatrix/QR scanner' : 'QR scanner'}</div>
        </div>
      </CardContent>
      
      <CardFooter className="flex flex-wrap justify-between gap-2 p-4 pt-0">
        {isScanning ? (
          <Button 
            variant="destructive" 
            className="flex-1"
            onClick={stopScanner}
          >
            Stop Scanner
          </Button>
        ) : (
          <Button 
            variant="default" 
            className="flex-1"
            onClick={startScanner}
          >
            Start Scanner
          </Button>
        )}
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={toggleScanMode}
          className="flex-initial text-xs"
        >
          Switch to {scanMode === 'zxing' ? 'QR-Only' : 'DataMatrix+QR'}
        </Button>
        
        {onClose && (
          <Button 
            variant="outline" 
            onClick={onClose}
            className="w-full mt-2"
          >
            Cancel
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}