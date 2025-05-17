import React, { useState } from 'react';
import BarcodeScanner from '@/components/barcode-scanner';

export default function ScannerTestPage() {
  const [isShowingScanner, setIsShowingScanner] = useState(true);
  const [lastScannedData, setLastScannedData] = useState<string | null>(null);

  function handleScanSuccess(scannedText: string) {
    console.log("Scan successful:", scannedText);
    setLastScannedData(scannedText);
    setIsShowingScanner(false);
  }

  function handleScanError(error: string) {
    console.error("Scan error:", error);
  }

  function handleCloseScanner() {
    setIsShowingScanner(false);
  }

  function startNewScan() {
    setIsShowingScanner(true);
  }

  return (
    <div className="container mx-auto py-4 max-w-3xl">
      {isShowingScanner ? (
        <BarcodeScanner 
          onScanSuccess={handleScanSuccess}
          onScanError={handleScanError}
          onClose={handleCloseScanner}
        />
      ) : (
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-medium mb-4">Scan Result</h2>
          
          {lastScannedData && (
            <div className="mb-6">
              <div className="text-sm text-gray-500 mb-1">Decoded data:</div>
              <div className="bg-gray-50 p-3 border rounded-md">
                <pre className="text-sm overflow-x-auto whitespace-pre-wrap break-all">
                  {lastScannedData}
                </pre>
              </div>
            </div>
          )}
          
          <button 
            onClick={startNewScan}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Scan Again
          </button>
        </div>
      )}
    </div>
  );
}