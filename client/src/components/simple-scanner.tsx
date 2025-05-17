import React, { useState, useRef, useEffect } from 'react';
import jsQR from 'jsqr';

interface SimpleScannerProps {
  onScanSuccess: (result: string) => void;
  onCancel: () => void;
}

export default function SimpleScanner({ onScanSuccess, onCancel }: SimpleScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Start scanning when component mounts
  useEffect(() => {
    startScanner();
    return () => {
      stopScanner();
    };
  }, []);

  async function startScanner() {
    try {
      setIsScanning(true);
      setErrorMessage(null);
      
      // Get camera access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" }
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      
      // Start scanning frames
      scanFrame();
    } catch (err) {
      console.error("Camera access error:", err);
      setErrorMessage("Could not access camera");
      setIsScanning(false);
    }
  }

  function stopScanner() {
    setIsScanning(false);
    
    // Stop animation loop
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    // Stop camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Clean up video
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  function scanFrame() {
    if (!videoRef.current || !canvasRef.current) {
      animationRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    
    // Make sure video is ready
    if (videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      animationRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    const context = canvas.getContext('2d');
    if (!context) return;
    
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Get image data for processing
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    
    // Process with jsQR
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert"
    });
    
    if (code) {
      // Found code!
      console.log("QR Code found:", code.data);
      
      // Highlight the found code with a border
      context.beginPath();
      context.lineWidth = 5;
      context.strokeStyle = "#FF3B58";
      
      // Draw outline around the detected QR code
      const points = code.location;
      context.moveTo(points.topLeftCorner.x, points.topLeftCorner.y);
      context.lineTo(points.topRightCorner.x, points.topRightCorner.y);
      context.lineTo(points.bottomRightCorner.x, points.bottomRightCorner.y);
      context.lineTo(points.bottomLeftCorner.x, points.bottomLeftCorner.y);
      context.lineTo(points.topLeftCorner.x, points.topLeftCorner.y);
      context.stroke();
      
      // Stop scanning and return the result
      stopScanner();
      onScanSuccess(code.data);
      return;
    }
    
    // Continue scanning if no code found
    if (isScanning) {
      animationRef.current = requestAnimationFrame(scanFrame);
    }
  }

  return (
    <div className="scanner-container" style={{ maxWidth: '100%', margin: '0 auto' }}>
      <div style={{ position: 'relative', width: '100%' }}>
        {/* Video element to show camera feed */}
        <video 
          ref={videoRef} 
          style={{ 
            width: '100%', 
            height: 'auto',
            display: 'block',
            backgroundColor: '#000',
            minHeight: '300px'
          }}
          playsInline 
          muted
        />
        
        {/* Canvas overlay for drawing */}
        <canvas 
          ref={canvasRef} 
          style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 10
          }}
        />
        
        {errorMessage && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(255, 50, 50, 0.8)',
            color: 'white',
            padding: '1rem',
            borderRadius: '4px',
            textAlign: 'center',
            zIndex: 20
          }}>
            {errorMessage}
          </div>
        )}
      </div>
      
      <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between' }}>
        {isScanning ? (
          <button 
            onClick={() => stopScanner()} 
            style={{
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Stop Camera
          </button>
        ) : (
          <button 
            onClick={() => startScanner()} 
            style={{
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Start Camera
          </button>
        )}
        
        <button 
          onClick={onCancel} 
          style={{
            backgroundColor: '#f5f5f5',
            border: '1px solid #ddd',
            padding: '0.75rem 1rem',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}