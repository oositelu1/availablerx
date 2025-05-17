import React, { useState, useRef, useEffect } from 'react';
import jsQR from 'jsqr';
import { Link } from 'wouter';

export default function QrTest() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const animationFrame = useRef<number | null>(null);

  const startScan = async () => {
    try {
      setResult(null);
      
      // Get the user's camera
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      
      // Save the stream
      setStream(mediaStream);
      
      // Connect it to the video element
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
      
      setScanning(true);
      scanCode();
    } catch (err) {
      console.error('Error accessing camera:', err);
      alert('Could not access camera. Please allow camera access and try again.');
    }
  };

  const stopScan = () => {
    setScanning(false);
    
    // Stop the animation frame
    if (animationFrame.current) {
      cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
    }
    
    // Stop all camera tracks
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    // Clear video source
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopScan();
    };
  }, []);

  const scanCode = () => {
    if (!scanning) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      // Get the canvas 2D context
      const context = canvas.getContext('2d', { willReadFrequently: true });
      
      if (context) {
        // Set canvas size to video size
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw current video frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Get the image data for QR scanning
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        
        // Scan for QR code
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "attemptBoth"
        });
        
        // If we found a QR code
        if (code) {
          console.log("QR code detected:", code.data);
          
          // Highlight the detected code
          context.beginPath();
          context.lineWidth = 4;
          context.strokeStyle = "red";
          context.moveTo(code.location.topLeftCorner.x, code.location.topLeftCorner.y);
          context.lineTo(code.location.topRightCorner.x, code.location.topRightCorner.y);
          context.lineTo(code.location.bottomRightCorner.x, code.location.bottomRightCorner.y);
          context.lineTo(code.location.bottomLeftCorner.x, code.location.bottomLeftCorner.y);
          context.lineTo(code.location.topLeftCorner.x, code.location.topLeftCorner.y);
          context.stroke();
          
          // Store result and stop scanning
          setResult(code.data);
          stopScan();
          return;
        }
      }
    }
    
    // Continue scanning if no code found
    animationFrame.current = requestAnimationFrame(scanCode);
  };

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '1rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link href="/">
          <a style={{ color: '#0066cc', textDecoration: 'none' }}>← Back</a>
        </Link>
      </div>
      
      <h1 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>QR Code Scanner</h1>
      
      <div style={{ position: 'relative', marginBottom: '1rem', background: '#f0f0f0', minHeight: '250px' }}>
        <video 
          ref={videoRef}
          style={{ 
            width: '100%', 
            height: 'auto',
            display: scanning ? 'block' : 'none',
            backgroundColor: '#000'
          }}
          playsInline 
        />
        
        <canvas 
          ref={canvasRef}
          style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: scanning ? 'block' : 'none'
          }}
        />
        
        {!scanning && !result && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: '250px',
            color: '#666',
            flexDirection: 'column'
          }}>
            <div style={{ marginBottom: '1rem' }}>Click Start Camera to scan</div>
          </div>
        )}
        
        {result && (
          <div style={{ 
            padding: '1rem', 
            border: '1px solid #ddd',
            borderRadius: '4px',
            background: '#fff'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Result:</div>
            <div style={{ 
              wordBreak: 'break-all', 
              fontFamily: 'monospace',
              padding: '0.5rem',
              background: '#f7f7f7',
              borderRadius: '4px',
              fontSize: '0.875rem'
            }}>
              {result}
            </div>
          </div>
        )}
      </div>
      
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {!scanning ? (
          <button 
            onClick={startScan}
            style={{
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer',
              flex: 1
            }}
          >
            Start Camera
          </button>
        ) : (
          <button 
            onClick={stopScan}
            style={{
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer',
              flex: 1
            }}
          >
            Stop Camera
          </button>
        )}
        
        {result && (
          <button 
            onClick={() => {
              setResult(null);
              startScan();
            }}
            style={{
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer',
              flex: 1
            }}
          >
            Scan Again
          </button>
        )}
      </div>
    </div>
  );
}