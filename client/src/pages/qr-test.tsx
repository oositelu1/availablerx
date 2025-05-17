import React, { useState, useRef, useEffect } from 'react';
import jsQR from 'jsqr';

export default function QrTest() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const animationFrame = useRef<number | null>(null);

  // Don't auto-start - let user click the button
  useEffect(() => {
    return () => stopScan();
  }, []);

  const startScan = async () => {
    try {
      setResult(null);
      console.log("Starting camera...");
      
      // Get the camera - use simpler constraints for better compatibility
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
      
      console.log("Camera access granted");
      setStream(mediaStream);
      
      if (videoRef.current) {
        console.log("Setting video source");
        videoRef.current.srcObject = mediaStream;
        
        // Make sure autoplay is enabled
        videoRef.current.autoplay = true;
        videoRef.current.playsInline = true;
        
        try {
          await videoRef.current.play();
          console.log("Video playback started");
        } catch (playError) {
          console.error("Error playing video:", playError);
        }
      } else {
        console.error("Video element not available");
      }
      
      setScanning(true);
      console.log("Starting scan loop");
      scanCode();
    } catch (err) {
      console.error('Camera access error:', err);
      alert('Could not access camera. Please make sure camera permissions are enabled and try again.');
    }
  };

  const stopScan = () => {
    setScanning(false);
    
    if (animationFrame.current) {
      cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
    }
    
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const scanCode = () => {
    // Don't continue if we're not scanning
    if (!scanning) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Make sure video and canvas exist
    if (!video || !canvas) {
      console.log("Video or canvas missing");
      animationFrame.current = requestAnimationFrame(scanCode);
      return;
    }
    
    // Make sure video has enough data
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      console.log("Video not ready yet");
      animationFrame.current = requestAnimationFrame(scanCode);
      return;
    }
    
    // Get the canvas context
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      console.error("Could not get canvas context");
      return;
    }
    
    try {
      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Get image data for processing
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      
      // Try to detect QR code
      const code = jsQR(
        imageData.data, 
        imageData.width, 
        imageData.height, 
        { inversionAttempts: "dontInvert" }
      );
      
      // If code found
      if (code) {
        console.log("Code detected:", code.data);
        
        // Highlight the code
        context.beginPath();
        context.lineWidth = 5;
        context.strokeStyle = "#00FF00";
        context.moveTo(code.location.topLeftCorner.x, code.location.topLeftCorner.y);
        context.lineTo(code.location.topRightCorner.x, code.location.topRightCorner.y);
        context.lineTo(code.location.bottomRightCorner.x, code.location.bottomRightCorner.y);
        context.lineTo(code.location.bottomLeftCorner.x, code.location.bottomLeftCorner.y);
        context.lineTo(code.location.topLeftCorner.x, code.location.topLeftCorner.y);
        context.stroke();
        
        // Show result and stop scanning
        setResult(code.data);
        stopScan();
        return;
      } else {
        // Try again with invert
        const invertedCode = jsQR(
          imageData.data, 
          imageData.width, 
          imageData.height, 
          { inversionAttempts: "onlyInvert" }
        );
        
        if (invertedCode) {
          console.log("Inverted code detected:", invertedCode.data);
          
          // Highlight the code
          context.beginPath();
          context.lineWidth = 5;
          context.strokeStyle = "#00FF00";
          context.moveTo(invertedCode.location.topLeftCorner.x, invertedCode.location.topLeftCorner.y);
          context.lineTo(invertedCode.location.topRightCorner.x, invertedCode.location.topRightCorner.y);
          context.lineTo(invertedCode.location.bottomRightCorner.x, invertedCode.location.bottomRightCorner.y);
          context.lineTo(invertedCode.location.bottomLeftCorner.x, invertedCode.location.bottomLeftCorner.y);
          context.lineTo(invertedCode.location.topLeftCorner.x, invertedCode.location.topLeftCorner.y);
          context.stroke();
          
          // Show result and stop scanning
          setResult(invertedCode.data);
          stopScan();
          return;
        }
      }
    } catch (err) {
      console.error("Error processing frame:", err);
    }
    
    // Continue scanning
    animationFrame.current = requestAnimationFrame(scanCode);
  };

  return (
    <div style={{ 
      maxWidth: '100%', 
      margin: '0 auto', 
      padding: '0',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ 
        position: 'relative',
        flex: '1',
        backgroundColor: '#000',
        overflow: 'hidden'
      }}>
        <video 
          ref={videoRef}
          style={{ 
            width: '100%', 
            height: '100%',
            objectFit: 'cover'
          }}
          playsInline
          muted
          autoPlay
        />
        
        <canvas 
          ref={canvasRef}
          style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%'
          }}
        />
        
        {!scanning && !result && (
          <div style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.7)',
            color: '#fff'
          }}>
            <div>Starting camera...</div>
          </div>
        )}
        
        {/* Targeting rectangle */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '70%',
          height: '50%',
          transform: 'translate(-50%, -50%)',
          border: '2px dashed rgba(255,255,255,0.5)',
          boxSizing: 'border-box',
          pointerEvents: 'none'
        }} />
      </div>
      
      {result && (
        <div style={{ 
          padding: '1rem',
          backgroundColor: '#fff',
          borderTop: '1px solid #ddd'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Scanned Code:</div>
          <div style={{ 
            wordBreak: 'break-all', 
            fontFamily: 'monospace',
            padding: '0.5rem',
            background: '#f7f7f7',
            borderRadius: '4px',
            fontSize: '0.875rem',
            maxHeight: '100px',
            overflow: 'auto'
          }}>
            {result}
          </div>
          
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
              marginTop: '1rem',
              width: '100%'
            }}
          >
            Scan Again
          </button>
        </div>
      )}
      
      {!result && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#fff',
          display: 'flex'
        }}>
          <button 
            onClick={scanning ? stopScan : startScan}
            style={{
              backgroundColor: scanning ? '#f44336' : '#4CAF50',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer',
              flex: 1
            }}
          >
            {scanning ? 'Stop Camera' : 'Start Camera'}
          </button>
        </div>
      )}
    </div>
  );
}