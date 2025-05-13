import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

interface QRScannerProps {
  onScanSuccess: (decodedText: string, decodedResult: any) => void;
  onScanError?: (error: string) => void;
  onClose?: () => void;
}

export default function QRScanner({ onScanSuccess, onScanError, onClose }: QRScannerProps) {
  const [error, setError] = useState<string | null>(
    "Camera access is not available in this environment. The QR scanner has been disabled in this Replit environment."
  );

  // This is a simplified version without actual camera integration
  // since it's causing issues in the Replit environment
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center">Camera Not Available</CardTitle>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4 bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-800" />
          <AlertTitle className="text-amber-800">Camera Not Available</AlertTitle>
          <AlertDescription className="text-amber-700">
            Camera access is not available in the Replit environment due to security restrictions.
            Please use the "Sample Data" option instead to test the functionality.
          </AlertDescription>
        </Alert>
        
        <div className="w-full h-48 bg-muted/50 relative rounded-md overflow-hidden flex items-center justify-center border border-dashed border-muted-foreground/20">
          <div className="text-center p-6">
            <div className="mb-4 text-4xl">⚠️</div>
            <p className="text-muted-foreground">
              Camera access is restricted. Please use the "Sample Data" option instead.
            </p>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-center">
        <Button variant="outline" onClick={onClose}>Close</Button>
      </CardFooter>
    </Card>
  );
}