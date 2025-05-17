import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { InfoIcon, ClipboardCopy } from 'lucide-react';

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
    
    console.log("Processing barcode data:", barcodeData);
    
    // Extract relevant data based on format
    let formattedData = barcodeData.trim();
    
    // If this looks like the output from the iPhone scanner app
    if (formattedData.includes("Content") || formattedData.includes("GTIN:") || formattedData.includes("Lot Number:")) {
      // Extract just the content line
      const contentMatch = formattedData.match(/Content\s*\n([0-9]+)/);
      if (contentMatch && contentMatch[1]) {
        formattedData = contentMatch[1].trim();
        console.log("Extracted content from scanner output:", formattedData);
      }
      
      // Or try to get the parsed values
      const gtinMatch = formattedData.match(/GTIN:\s*([0-9]+)/);
      const lotMatch = formattedData.match(/Lot Number:\s*([A-Za-z0-9]+)/);
      const serialMatch = formattedData.match(/Serial Number:\s*([0-9]+)/);
      const expirationMatch = formattedData.match(/Expiration Date:\s*([0-9/]+)/);
      
      if (gtinMatch && gtinMatch[1]) {
        // We have parsed data, construct a GS1 format string
        let parsedFormat = `(01)${gtinMatch[1]}`;
        
        if (lotMatch && lotMatch[1]) {
          parsedFormat += `(10)${lotMatch[1]}`;
        }
        
        if (expirationMatch && expirationMatch[1]) {
          // Convert MM/DD/YY to YYMMDD
          const parts = expirationMatch[1].split('/');
          if (parts.length === 3) {
            parsedFormat += `(17)${parts[2]}${parts[0]}${parts[1]}`;
          }
        }
        
        if (serialMatch && serialMatch[1]) {
          parsedFormat += `(21)${serialMatch[1]}`;
        }
        
        formattedData = parsedFormat;
        console.log("Constructed GS1 from parsed output:", formattedData);
      }
    } else if (!formattedData.includes('(')) {
      // Raw data format - tries to format as GS1
      if (formattedData.length >= 14) {
        const gtin = formattedData.substring(0, 14);
        let remainder = formattedData.substring(14);
        
        // Try to identify lot number and serial number
        let formatted = `(01)${gtin}`;
        
        // Identify a date pattern (YYMMDD) - 6 digits after GTIN
        if (remainder.length >= 6) {
          const dateMatch = remainder.substring(0, 6).match(/^\d{6}$/);
          if (dateMatch) {
            formatted += `(17)${dateMatch[0]}`;
            remainder = remainder.substring(6);
          }
        }
        
        // Lot number might be next
        if (remainder.length > 0) {
          const lotMatch = remainder.match(/^([A-Za-z0-9]{1,20})/);
          if (lotMatch) {
            formatted += `(10)${lotMatch[1]}`;
            remainder = remainder.substring(lotMatch[1].length);
          }
        }
        
        // Serial number is usually last
        if (remainder.length > 0) {
          formatted += `(21)${remainder}`;
        }
        
        formattedData = formatted;
        console.log("Formatted raw data as GS1:", formattedData);
      }
    }
    
    // Submit the data
    console.log("Submitting barcode data:", formattedData);
    onSubmit(formattedData);
  };

  // Example codes to help users
  const exampleCodes = [
    {
      label: "iPhone Scanner App Output",
      example: `Content
01503014395701082110000005921417260930102405

Parsed GS1
GTIN: 0150301439570
Lot Number: 08211
Expiration Date: 02/60/93
Serial Number: 0102405`
    },
    {
      label: "Standard GS1 Format",
      example: "(01)00301430957010(10)24052241(17)260930(21)10018521666433"
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
            <Label htmlFor="barcode-data">Paste Scanner Output</Label>
            <Textarea
              id="barcode-data"
              placeholder="Paste the raw data from your scanner app here..."
              value={barcodeData}
              onChange={(e) => setBarcodeData(e.target.value)}
              className="font-mono h-24 resize-none"
            />
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 px-2 text-xs"
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    if (text) {
                      setBarcodeData(text);
                    }
                  } catch (err) {
                    console.error("Clipboard access error:", err);
                    setError("Couldn't access clipboard. Please paste manually.");
                  }
                }}
              >
                <ClipboardCopy className="h-3 w-3 mr-1" />
                Paste from Clipboard
              </Button>
            </div>
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