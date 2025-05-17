import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { InfoIcon } from 'lucide-react';

interface ManualBarcodeEntryProps {
  onSubmit: (barcodeData: string) => void;
  onCancel: () => void;
}

export default function ManualBarcodeEntry({ onSubmit, onCancel }: ManualBarcodeEntryProps) {
  const [barcodeData, setBarcodeData] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!barcodeData.trim()) {
      setError('Please enter barcode data');
      return;
    }
    
    // Try to format the data as GS1 if it doesn't already have parentheses
    let formattedData = barcodeData.trim();
    
    if (!formattedData.includes('(')) {
      // Very basic attempt to format as GS1 - assumes first 14 chars are GTIN
      if (formattedData.length >= 14) {
        const gtin = formattedData.substring(0, 14);
        let remainder = formattedData.substring(14);
        
        // Try to identify lot number and serial number
        let formatted = `(01)${gtin}`;
        
        // If we have more data, try to parse lot and serial
        if (remainder.length > 0) {
          // Assume first non-numeric part might be lot number
          const lotMatch = remainder.match(/[A-Za-z0-9]{1,20}/);
          if (lotMatch) {
            formatted += `(10)${lotMatch[0]}`;
            remainder = remainder.substring(lotMatch[0].length);
          }
          
          // Anything else might be a serial number
          if (remainder.length > 0) {
            formatted += `(21)${remainder}`;
          }
        }
        
        formattedData = formatted;
      }
    }
    
    onSubmit(formattedData);
  };

  // Example codes to help users
  const exampleCodes = [
    {
      label: "GS1 DataMatrix Format",
      example: "(01)00312345678906(17)220615(10)ABC123(21)XYZ987"
    },
    {
      label: "Non-GS1 Format",
      example: "00312345678906220615ABC123XYZ987"
    }
  ];

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center">Manual Barcode Entry</CardTitle>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="barcode-data">Enter Barcode Data</Label>
            <Input
              id="barcode-data"
              placeholder="Enter barcode data here..."
              value={barcodeData}
              onChange={(e) => setBarcodeData(e.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Enter the DataMatrix code exactly as printed on the product packaging
            </p>
          </div>
          
          <Separator />
          
          <div className="bg-muted p-3 rounded-md space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <InfoIcon className="h-4 w-4" />
              <span>Example Format References</span>
            </div>
            
            <div className="space-y-2">
              {exampleCodes.map((code, index) => (
                <div key={index} className="bg-background p-2 rounded text-xs">
                  <div className="font-medium mb-1">{code.label}:</div>
                  <code className="block font-mono bg-primary/5 p-1 rounded overflow-x-auto">
                    {code.example}
                  </code>
                </div>
              ))}
            </div>
            
            <p className="text-xs text-muted-foreground">
              You can also enter common pharmaceutical formats like NDC numbers or simple GTIN values
            </p>
          </div>
          
          <div className="pt-2">
            <Button type="submit" className="w-full">Submit Barcode Data</Button>
          </div>
        </form>
      </CardContent>
      
      <CardFooter>
        <Button variant="outline" onClick={onCancel} className="w-full">Cancel</Button>
      </CardFooter>
    </Card>
  );
}