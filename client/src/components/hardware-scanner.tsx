import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Keyboard, Loader2, Check, AlertCircle, ScanLine } from "lucide-react";

interface HardwareScannerProps {
  onScanSuccess: (data: string) => void;
  onCancel: () => void;
}

export default function HardwareScanner({ onScanSuccess, onCancel }: HardwareScannerProps) {
  const [isListening, setIsListening] = useState(true);
  const [scannedData, setScannedData] = useState('');
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const inputBufferRef = useRef('');
  const timeoutRef = useRef<NodeJS.Timeout>();
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus the hidden input to capture scanner input
    if (hiddenInputRef.current) {
      hiddenInputRef.current.focus();
    }

    // Handle key events from the scanner
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isListening) return;

      // Clear previous timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // The scanner typically types very fast and ends with Enter
      if (event.key === 'Enter') {
        if (inputBufferRef.current.length > 0) {
          // Process the scanned data
          let data = inputBufferRef.current;
          console.log('Hardware scanner raw data received:', data);
          
          // Hardware scanner specific fix: 
          // The Tera Model D5100 scanner adds "029" before the expiration date AI "17"
          // This pattern removes that quirk to match camera scanner output
          const pattern = /^(01\d{14})(21\d+?)(029)(17\d{6})(10.+)$/;
          const match = data.match(pattern);
          if (match) {
            // Reconstruct without the extra "029"
            data = match[1] + match[2] + match[4] + match[5];
            console.log('Hardware scanner data cleaned:', data);
          }
          
          setScannedData(data);
          setLastScanTime(new Date());
          setScanCount(prev => prev + 1);
          
          // Call the callback with cleaned data
          onScanSuccess(data);
          
          // Clear the buffer
          inputBufferRef.current = '';
          
          // Stop listening after successful scan
          setIsListening(false);
        }
      } else {
        // Add character to buffer if it's a printable character
        if (event.key.length === 1) {
          inputBufferRef.current += event.key;
        }
      }

      // Set a timeout to clear the buffer if no more input comes
      // This prevents partial scans from being stuck in the buffer
      timeoutRef.current = setTimeout(() => {
        inputBufferRef.current = '';
      }, 500); // 500ms timeout between keystrokes
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isListening, onScanSuccess]);

  // Keep focus on the hidden input
  useEffect(() => {
    const interval = setInterval(() => {
      if (isListening && hiddenInputRef.current && document.activeElement !== hiddenInputRef.current) {
        hiddenInputRef.current.focus();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isListening]);

  const handleRescan = () => {
    setIsListening(true);
    setScannedData('');
    inputBufferRef.current = '';
    if (hiddenInputRef.current) {
      hiddenInputRef.current.focus();
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Keyboard className="h-5 w-5" />
          Hardware Scanner Mode
        </CardTitle>
        <CardDescription>
          Your Tera Model D5100 scanner will input data directly as keyboard input
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Hidden input to maintain focus */}
        <input 
          ref={hiddenInputRef}
          type="text"
          className="sr-only"
          aria-label="Scanner input"
          tabIndex={0}
        />

        {isListening ? (
          <div className="text-center py-8">
            <div className="mb-4">
              <ScanLine className="h-16 w-16 text-primary mx-auto animate-pulse" />
            </div>
            <h3 className="text-lg font-medium mb-2">Ready to Scan</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Point your scanner at the product barcode and pull the trigger
            </p>
            <Badge variant="secondary" className="animate-pulse">
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
              Listening for scanner input...
            </Badge>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="mb-4">
              <Check className="h-16 w-16 text-success mx-auto" />
            </div>
            <h3 className="text-lg font-medium mb-2">Scan Complete</h3>
            {scannedData && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Successfully captured barcode data
                </p>
                <div className="bg-muted p-3 rounded-md">
                  <p className="font-mono text-sm break-all">{scannedData}</p>
                </div>
                {lastScanTime && (
                  <p className="text-xs text-muted-foreground">
                    Scanned at {lastScanTime.toLocaleTimeString()}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Tips for best results:</strong>
            <ul className="list-disc list-inside mt-1 text-sm">
              <li>Ensure the scanner is configured to add Enter/Return after scanning</li>
              <li>Keep this window focused while scanning</li>
              <li>Hold the scanner steady until you hear the beep</li>
              <li>The scanner will automatically paste the code and submit</li>
            </ul>
          </AlertDescription>
        </Alert>

        {scanCount > 0 && (
          <div className="text-center text-sm text-muted-foreground">
            Scans completed: {scanCount}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        {!isListening && (
          <Button onClick={handleRescan}>
            Scan Another
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}