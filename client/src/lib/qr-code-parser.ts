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

  // Check if it's in GS1 format (begins with an Application Identifier in parentheses)
  if (qrData.startsWith('(')) {
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
  } else {
    // Handle non-GS1 formats
    // This is for simple key=value format, URL format, or JSON format
    
    // Check if it's a URL with parameters
    try {
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