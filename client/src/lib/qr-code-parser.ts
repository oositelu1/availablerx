/**
 * QR/DataMatrix Code Parser
 * 
 * Supports parsing of GS1 DataMatrix codes commonly used in pharmaceuticals.
 * GS1 codes use Application Identifiers (AI) to denote different data elements:
 * 
 * Common AIs:
 * - (01): GTIN
 * - (10): Batch/Lot Number
 * - (17): Expiration Date (YYMMDD)
 * - (21): Serial Number
 * - (30): Count/Quantity
 */

export interface ParsedQRData {
  raw: string;
  gtin?: string;
  lotNumber?: string;
  expirationDate?: string;
  serialNumber?: string;
  quantity?: string;
  isGS1Format: boolean;
}

export function parseQRCode(qrData: string): ParsedQRData {
  const result: ParsedQRData = {
    raw: qrData,
    isGS1Format: false
  };

  console.log("Parsing QR code data:", qrData);

  // Check if this is iPhone scanner app output
  if (qrData.includes('GTIN:') || qrData.includes('Lot Number:') || qrData.includes('Expiration Date:')) {
    console.log('Detected iPhone scanner app output format');
    
    // Extract GTIN
    const gtinMatch = qrData.match(/GTIN:\s*([0-9]+)/);
    if (gtinMatch && gtinMatch[1]) {
      result.gtin = gtinMatch[1];
      result.isGS1Format = true;
      console.log("Extracted GTIN:", result.gtin);
    }
    
    // Extract Lot Number
    const lotMatch = qrData.match(/Lot Number:\s*([A-Za-z0-9]+)/);
    if (lotMatch && lotMatch[1]) {
      result.lotNumber = lotMatch[1];
      console.log("Extracted Lot Number:", result.lotNumber);
    }
    
    // Extract Expiration Date
    const expMatch = qrData.match(/Expiration Date:\s*([0-9\/]+)/);
    if (expMatch && expMatch[1]) {
      // Try to handle MM/DD/YY format
      const dateParts = expMatch[1].split('/');
      if (dateParts.length === 3) {
        const month = dateParts[0].padStart(2, '0');
        const day = dateParts[1].padStart(2, '0');
        let year = dateParts[2];
        
        // Convert 2-digit year to 4-digit
        if (year.length === 2) {
          year = parseInt(year) < 50 ? `20${year}` : `19${year}`;
        }
        
        result.expirationDate = `${year}-${month}-${day}`;
        console.log("Extracted Expiration Date:", result.expirationDate);
      }
    }
    
    // Extract Serial Number
    const serialMatch = qrData.match(/Serial Number:\s*([0-9A-Za-z]+)/);
    if (serialMatch && serialMatch[1]) {
      result.serialNumber = serialMatch[1];
      console.log("Extracted Serial Number:", result.serialNumber);
    }
    
    // If we couldn't extract GTIN, try to get it from the Content line
    if (!result.gtin) {
      const contentMatch = qrData.match(/Content\s*\n([0-9]+)/);
      if (contentMatch && contentMatch[1]) {
        const rawContent = contentMatch[1].trim();
        console.log("Raw content:", rawContent);
        
        // If it looks like a GTIN (14+ digits)
        if (/^[0-9]{14,}/.test(rawContent)) {
          result.gtin = rawContent.substring(0, 14);
          result.isGS1Format = true;
          console.log("Extracted GTIN from content:", result.gtin);
        }
      }
    }
  }
  // Check if it's in GS1 format (begins with an Application Identifier in parentheses)
  else if (qrData.includes('(')) {
    console.log('Detected GS1 format');
    result.isGS1Format = true;
    
    // GTIN - Application Identifier (01)
    const gtinMatch = qrData.match(/\(01\)([0-9]{14})/);
    if (gtinMatch && gtinMatch[1]) {
      result.gtin = gtinMatch[1];
    }
    
    // Lot Number - Application Identifier (10)
    const lotMatch = qrData.match(/\(10\)([^(]+)/);
    if (lotMatch && lotMatch[1]) {
      result.lotNumber = lotMatch[1].trim();
    }
    
    // Expiration Date - Application Identifier (17) in format YYMMDD
    const expMatch = qrData.match(/\(17\)([0-9]{6})/);
    if (expMatch && expMatch[1]) {
      const yymmdd = expMatch[1];
      const year = parseInt(`20${yymmdd.substring(0, 2)}`);
      const month = parseInt(yymmdd.substring(2, 4)) - 1; // JS months are 0-indexed
      const day = parseInt(yymmdd.substring(4, 6));
      
      // Format as YYYY-MM-DD for consistency
      const date = new Date(year, month, day);
      result.expirationDate = date.toISOString().split('T')[0];
    }
    
    // Serial Number - Application Identifier (21)
    const serialMatch = qrData.match(/\(21\)([^(]+)/);
    if (serialMatch && serialMatch[1]) {
      result.serialNumber = serialMatch[1].trim();
    }
    
    // Quantity - Application Identifier (30)
    const quantityMatch = qrData.match(/\(30\)([0-9]+)/);
    if (quantityMatch && quantityMatch[1]) {
      result.quantity = quantityMatch[1];
    }
  } 
  // Try to parse raw numeric content (typical DataMatrix raw format)
  else if (/^[0-9]{14,}/.test(qrData)) {
    console.log('Detected raw numeric format');
    
    // First 14 digits are likely GTIN
    result.gtin = qrData.substring(0, 14);
    console.log("Extracted GTIN from raw format:", result.gtin);
    
    // Check if there's more data after GTIN
    if (qrData.length > 14) {
      const remainder = qrData.substring(14);
      
      // Try to parse remainder as lot/serial numbers
      // This is a simplistic approach and may need refinement
      if (/^[0-9]{6}/.test(remainder)) {
        // If next 6 digits look like a date (YYMMDD)
        const dateStr = remainder.substring(0, 6);
        const year = parseInt(`20${dateStr.substring(0, 2)}`);
        const month = parseInt(dateStr.substring(2, 4)) - 1;
        const day = parseInt(dateStr.substring(4, 6));
        
        const date = new Date(year, month, day);
        result.expirationDate = date.toISOString().split('T')[0];
        console.log("Extracted expiration date from raw format:", result.expirationDate);
        
        // Remainder might be lot or serial
        if (remainder.length > 6) {
          // If the remainder has letters, it's probably a lot number
          const rest = remainder.substring(6);
          if (/[A-Za-z]/.test(rest)) {
            // Look for alphanumeric pattern that might be a lot
            const lotMatch = rest.match(/([A-Za-z0-9]+)/);
            if (lotMatch) {
              result.lotNumber = lotMatch[1];
              console.log("Extracted lot number from raw format:", result.lotNumber);
              
              // Anything after might be a serial
              const afterLot = rest.substring(lotMatch[1].length);
              if (afterLot.length > 0) {
                result.serialNumber = afterLot;
                console.log("Extracted serial number from raw format:", result.serialNumber);
              }
            }
          } else {
            // If it's all numbers, assume it's a serial
            result.serialNumber = rest;
            console.log("Extracted serial number from raw format:", result.serialNumber);
          }
        }
      } else {
        // If no date pattern, try to determine lot and serial
        if (/[A-Za-z]/.test(remainder)) {
          // Look for alphanumeric pattern that might be a lot
          const lotMatch = remainder.match(/([A-Za-z0-9]+)/);
          if (lotMatch) {
            result.lotNumber = lotMatch[1];
            console.log("Extracted lot number from raw format:", result.lotNumber);
            
            // Anything after might be a serial
            const afterLot = remainder.substring(lotMatch[1].length);
            if (afterLot.length > 0) {
              result.serialNumber = afterLot;
              console.log("Extracted serial number from raw format:", result.serialNumber);
            }
          }
        } else {
          // If it's all numbers, assume it's a serial
          result.serialNumber = remainder;
          console.log("Extracted serial number from raw format:", result.serialNumber);
        }
      }
    }
  }
  // Handle URL or JSON formats as a fallback
  else {
    try {
      // Check if it's a URL with parameters
      if (qrData.includes('://') && qrData.includes('?')) {
        const url = new URL(qrData);
        
        if (url.searchParams.has('gtin')) result.gtin = url.searchParams.get('gtin') || undefined;
        if (url.searchParams.has('lot')) result.lotNumber = url.searchParams.get('lot') || undefined;
        if (url.searchParams.has('exp')) result.expirationDate = url.searchParams.get('exp') || undefined;
        if (url.searchParams.has('serial')) result.serialNumber = url.searchParams.get('serial') || undefined;
      }
      // Check if it's JSON format
      else if (qrData.startsWith('{') && qrData.endsWith('}')) {
        try {
          const jsonData = JSON.parse(qrData);
          if (jsonData.gtin) result.gtin = jsonData.gtin;
          if (jsonData.lotNumber) result.lotNumber = jsonData.lotNumber;
          if (jsonData.expirationDate) result.expirationDate = jsonData.expirationDate;
          if (jsonData.serialNumber) result.serialNumber = jsonData.serialNumber;
        } catch (e) {
          // Not valid JSON
        }
      }
    } catch (e) {
      // Not a valid URL
    }
  }

  return result;
}

/**
 * Compare scanned QR data with EPCIS product data
 */
export function compareWithEPCISData(
  qrData: ParsedQRData, 
  epcisData: { 
    gtin?: string; 
    lotNumber?: string; 
    expirationDate?: string; 
    serialNumber?: string;
  }
): {
  matches: boolean;
  gtinMatch: boolean;
  lotMatch: boolean;
  expirationMatch: boolean;
  serialMatch: boolean;
} {
  // Initialize with false
  const result = {
    matches: false,
    gtinMatch: false,
    lotMatch: false,
    expirationMatch: false,
    serialMatch: false
  };
  
  // Check GTIN match
  if (qrData.gtin && epcisData.gtin) {
    result.gtinMatch = qrData.gtin === epcisData.gtin;
  }
  
  // Check Lot Number match
  if (qrData.lotNumber && epcisData.lotNumber) {
    // Case-insensitive comparison for lot numbers
    result.lotMatch = qrData.lotNumber.toLowerCase() === epcisData.lotNumber.toLowerCase();
  }
  
  // Check Expiration Date match
  if (qrData.expirationDate && epcisData.expirationDate) {
    // Compare dates, ignoring time information
    const qrDate = qrData.expirationDate.split('T')[0];
    const epcisDate = epcisData.expirationDate.split('T')[0];
    result.expirationMatch = qrDate === epcisDate;
  }
  
  // Check Serial Number match
  if (qrData.serialNumber && epcisData.serialNumber) {
    // Case-sensitive comparison for serial numbers
    result.serialMatch = qrData.serialNumber === epcisData.serialNumber;
  }
  
  // Determine overall match status
  // For a valid pharmaceutical match, we need at least GTIN + lot number to match
  if (result.gtinMatch && result.lotMatch) {
    result.matches = true;
  }
  
  return result;
}