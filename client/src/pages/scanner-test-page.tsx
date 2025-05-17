import React, { useState } from 'react';
import BarcodeScanner from '@/components/barcode-scanner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ScannerTestPage() {
  const [isShowingScanner, setIsShowingScanner] = useState(false);
  const [lastScannedData, setLastScannedData] = useState<string | null>(null);
  const [scanHistory, setScanHistory] = useState<string[]>([]);

  function handleScanSuccess(scannedText: string) {
    console.log("Scan successful:", scannedText);
    setLastScannedData(scannedText);
    setScanHistory(prev => [scannedText, ...prev].slice(0, 5));
    setIsShowingScanner(false);
  }

  function handleScanError(error: string) {
    console.error("Scan error:", error);
  }

  function handleCloseScanner() {
    setIsShowingScanner(false);
  }

  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Barcode Scanner Test</h1>

      {isShowingScanner ? (
        <BarcodeScanner 
          onScanSuccess={handleScanSuccess}
          onScanError={handleScanError}
          onClose={handleCloseScanner}
        />
      ) : (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Scan a Product Barcode</CardTitle>
              <CardDescription>
                Test the scanner with any GS1 barcode or QR code
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setIsShowingScanner(true)}>
                Launch Scanner
              </Button>
            </CardContent>
          </Card>

          {lastScannedData && (
            <Card>
              <CardHeader>
                <CardTitle>Last Scanned Code</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
                  {lastScannedData}
                </pre>
              </CardContent>
            </Card>
          )}

          {scanHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Scan History</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {scanHistory.map((scan, index) => (
                    <li key={index} className="border-b pb-2 last:border-0">
                      <div className="text-xs text-gray-500">#{index + 1}</div>
                      <div className="text-sm font-mono break-all">{scan}</div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}