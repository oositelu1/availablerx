import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Camera, CameraOff, Loader2, CheckCircle } from 'lucide-react';
import { parseQRCode, type ParsedQRData } from '@/lib/qr-code-parser';

// Dynamsoft will be loaded globally via script tag
declare global {
  interface Window {
    Dynamsoft: any;
  }
}

interface DynamsoftBarcodeScannerProps {
  onScanSuccess: (barcodeData: string) => void;
  onCancel: () => void;
}

export default function DynamsoftBarcodeScanner({ onScanSuccess, onCancel }: DynamsoftBarcodeScannerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScannedData, setLastScannedData] = useState<ParsedQRData | null>(null);
  const scannerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Dynamsoft license key - same as working example
  const LICENSE_KEY = 'DLS2eyJoYW5kc2hha2VDb2RlIjoiMTA0MDU5MDEwLVRYbFhaV0pRY205cSIsIm1haW5TZXJ2ZXJVUkwiOiJodHRwczovL21kbHMuZHluYW1zb2Z0b25saW5lLmNvbSIsIm9yZ2FuaXphdGlvbklEIjoiMTA0MDU5MDEwIiwic3RhbmRieVNlcnZlclVSTCI6Imh0dHBzOi8vc2Rscy5keW5hbXNvZnRvbmxpbmUuY29tIiwiY2hlY2tDb2RlIjotMTQwMDA0OTI2OH0=';

  useEffect(() => {
    let mounted = true;

    const loadDynamsoft = async () => {
      try {
        // Check if we're on HTTPS (required for camera access)
        if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
          throw new Error('Camera requires HTTPS connection. Please access this page via HTTPS.');
        }

        // Load Dynamsoft script if not already loaded
        if (!window.Dynamsoft || !window.Dynamsoft.DBR) {
          console.log('Loading Dynamsoft library...');
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/dynamsoft-javascript-barcode@9.6.42/dist/dbr.js';
          script.async = true;
          
          await new Promise((resolve, reject) => {
            script.onload = () => {
              console.log('Dynamsoft library loaded successfully');
              resolve(true);
            };
            script.onerror = (error) => {
              console.error('Failed to load Dynamsoft library:', error);
              reject(new Error('Failed to load scanner library'));
            };
            document.head.appendChild(script);
          });
          
          // Wait a bit for the library to fully initialize
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!mounted) return;

        // Check if Dynamsoft is properly loaded
        if (!window.Dynamsoft || !window.Dynamsoft.DBR || !window.Dynamsoft.DBR.BarcodeScanner) {
          throw new Error('Dynamsoft library not properly loaded');
        }

        console.log('Applying Dynamsoft license...');
        // Apply license - must be done before creating instance
        window.Dynamsoft.DBR.BarcodeReader.license = LICENSE_KEY;

        console.log('Creating scanner instance...');
        // Create scanner instance - ensure we use the same pattern as the working example
        const scanner = await window.Dynamsoft.DBR.BarcodeScanner.createInstance();
        
        if (!mounted) {
          scanner.destroy();
          return;
        }

        // Configure for DataMatrix
        const settings = await scanner.getRuntimeSettings();
        settings.barcodeFormatIds = window.Dynamsoft.DBR.EnumBarcodeFormat.BF_DATAMATRIX;
        settings.expectedBarcodesCount = 1;
        settings.deblurLevel = 9;
        await scanner.updateRuntimeSettings(settings);

        // Set result callback - matching the working example
        scanner.onUnduplicatedRead = (txt: string, result: any) => {
          console.log('Barcode scanned:', txt);
          // Parse the barcode data immediately
          const parsedData = parseQRCode(txt);
          setLastScannedData(parsedData);
          // Still call the original callback with raw data
          onScanSuccess(txt);
        };

        scannerRef.current = scanner;
        setIsLoading(false);
      } catch (err: any) {
        console.error('Failed to initialize scanner:', err);
        console.error('Error details:', {
          message: err.message,
          name: err.name,
          stack: err.stack
        });
        
        // Provide more specific error messages
        if (err.message?.includes('license')) {
          setError('Scanner license issue. The license may have expired. Please use manual entry.');
        } else if (err.message?.includes('network')) {
          setError('Network error loading scanner. Please check your connection and try again.');
        } else if (err.message?.includes('https')) {
          setError('Camera requires HTTPS connection. Please use manual entry.');
        } else {
          setError(`Failed to initialize camera scanner: ${err.message || 'Unknown error'}. Please use manual entry.`);
        }
        setIsLoading(false);
      }
    };

    loadDynamsoft();

    return () => {
      mounted = false;
      if (scannerRef.current) {
        try {
          // First close the scanner if it's open
          if (scannerRef.current.isOpen && typeof scannerRef.current.isOpen === 'function') {
            scannerRef.current.close().catch(() => {
              // Ignore close errors during cleanup
            });
          } else if (scannerRef.current.close && typeof scannerRef.current.close === 'function') {
            scannerRef.current.close().catch(() => {
              // Ignore close errors during cleanup
            });
          }
          
          // Then destroy the instance
          if (scannerRef.current.destroy && typeof scannerRef.current.destroy === 'function') {
            scannerRef.current.destroy();
          } else if (scannerRef.current.deleteInstance && typeof scannerRef.current.deleteInstance === 'function') {
            // Fallback to deleteInstance for older versions
            scannerRef.current.deleteInstance();
          }
        } catch (error) {
          console.error('Error during scanner cleanup:', error);
        }
        scannerRef.current = null;
      }
    };
  }, [onScanSuccess]);

  const startScanning = async () => {
    if (!scannerRef.current) {
      setError('Scanner not initialized. Please refresh and try again.');
      return;
    }

    try {
      setError(null);
      console.log('Starting scanner...');
      
      // Set UI element - use the container div with id="scanner"
      const scannerElement = document.getElementById('scanner');
      if (!scannerElement) {
        throw new Error('Scanner container element not found');
      }
      
      await scannerRef.current.setUIElement(scannerElement);
      
      // Open camera
      console.log('Opening camera...');
      await scannerRef.current.open();
      
      setIsScanning(true);
      console.log('Scanner started successfully');
    } catch (err: any) {
      console.error('Camera error:', err);
      
      if (err.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access and try again.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found on this device.');
      } else if (err.name === 'NotReadableError') {
        setError('Camera is being used by another application.');
      } else {
        setError('Failed to start camera. Please use manual entry.');
      }
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current && isScanning) {
      try {
        if (scannerRef.current.close && typeof scannerRef.current.close === 'function') {
          await scannerRef.current.close();
        }
      } catch (error) {
        console.error('Error stopping scanner:', error);
      }
      setIsScanning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading camera scanner...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div 
        ref={containerRef}
        id="scanner"
        className="relative w-full bg-black rounded-lg overflow-hidden"
        style={{ height: '400px' }}
      >
        {!isScanning && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
            <div className="text-center space-y-4">
              <Camera className="h-16 w-16 text-gray-400 mx-auto" />
              <p className="text-gray-400">Camera not active</p>
            </div>
          </div>
        )}
        
        {/* Dynamsoft will inject its UI here - matching the working example structure */}
        <div className="dce-video-container" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}></div>
        <div className="dce-scanarea" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
          <div className="dce-scanlight"></div>
        </div>
      </div>

      <div className="flex gap-2 justify-center">
        {!isScanning ? (
          <Button onClick={startScanning} className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Start Camera
          </Button>
        ) : (
          <Button onClick={stopScanning} variant="secondary" className="flex items-center gap-2">
            <CameraOff className="h-4 w-4" />
            Stop Camera
          </Button>
        )}
        
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      {isScanning && (
        <p className="text-sm text-center text-muted-foreground">
          Point your camera at a DataMatrix barcode
        </p>
      )}

      {/* Display parsed data if available */}
      {lastScannedData && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <h4 className="font-medium text-green-800">Barcode Scanned Successfully</h4>
          </div>
          
          <div className="space-y-2">
            <div className="text-sm">
              <span className="font-medium text-gray-600">Raw Data:</span>
              <div className="font-mono text-xs bg-white p-2 rounded mt-1 break-all">
                {lastScannedData.raw}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              {lastScannedData.gtin && (
                <div>
                  <span className="font-medium text-gray-600">GTIN:</span>
                  <div className="font-mono">{lastScannedData.gtin}</div>
                </div>
              )}
              
              {lastScannedData.lotNumber && (
                <div>
                  <span className="font-medium text-gray-600">LOT:</span>
                  <div className="font-mono">{lastScannedData.lotNumber}</div>
                </div>
              )}
              
              {lastScannedData.serialNumber && (
                <div>
                  <span className="font-medium text-gray-600">Serial:</span>
                  <div className="font-mono">{lastScannedData.serialNumber}</div>
                </div>
              )}
              
              {lastScannedData.expirationDate && (
                <div>
                  <span className="font-medium text-gray-600">Exp Date:</span>
                  <div className="font-mono">{lastScannedData.expirationDate}</div>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2 mt-2">
              <Badge variant={lastScannedData.isGS1Format ? "default" : "secondary"} className={`text-xs ${lastScannedData.isGS1Format ? 'bg-green-100 text-green-800 border-green-200' : ''}`}>
                {lastScannedData.isGS1Format ? 'GS1 Format' : 'Non-GS1 Format'}
              </Badge>
              {lastScannedData.epcisGtin && (
                <Badge variant="outline" className="text-xs">
                  EPCIS GTIN: {lastScannedData.epcisGtin}
                </Badge>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}