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

import { dataMatrixToEpcisGtin } from './gtin-utils';
import { compareGTINsFlexibly, isSameBaseProduct, parseGTINFormat } from './gtin-validation';

export interface ParsedQRData {
  raw: string;
  gtin?: string;
  normalizedGtin?: string;  // For handling CASE vs ITEM level GTIN conversions
  epcisGtin?: string;       // DataMatrix GTIN converted to EPCIS format
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

  // Check if this is iPhone scanner app output - with very flexible matching
  if (qrData.includes('GTIN') || qrData.includes('Lot') || qrData.includes('Expiration') || qrData.includes('Serial')) {
    console.log('Detected iPhone scanner app output format');
    
    // Extract GTIN
    const gtinMatch = qrData.match(/GTIN:?\s*([0-9]+)/i);
    if (gtinMatch && gtinMatch[1]) {
      // Store the GTIN from the scanner (this is the DataMatrix format)
      let extractedGtin = gtinMatch[1];
      
      // 1. Store original DataMatrix formatted GTIN
      result.gtin = extractedGtin;
      
      // 2. Convert DataMatrix GTIN to EPCIS format using our utility
      result.epcisGtin = dataMatrixToEpcisGtin(extractedGtin);
      console.log("Converted DataMatrix GTIN", extractedGtin, "to EPCIS format:", result.epcisGtin);
      
      // 3. Also keep the legacy normalization for backward compatibility
      if (extractedGtin.length >= 14) {
        // For special case matching, check if we need to convert CASE <-> ITEM
        if (extractedGtin.charAt(7) === '5') {
          console.log("Detected CASE GTIN, will match with corresponding ITEM GTIN");
          // This is a CASE GTIN (with 5 at position 7)
          // Create item-level GTIN for matching by replacing '5' with '0'
          const itemLevelGtin = extractedGtin.substring(0, 7) + '0' + extractedGtin.substring(8);
          // For matching purposes, we'll use this normalized version
          result.normalizedGtin = itemLevelGtin;
          console.log("CASE GTIN:", extractedGtin, "-> Normalized to ITEM GTIN:", itemLevelGtin);
        } else if (extractedGtin.charAt(7) === '0') {
          // This is an ITEM GTIN (with 0 at position 7)
          // Create case-level GTIN for matching by replacing '0' with '5'
          const caseLevelGtin = extractedGtin.substring(0, 7) + '5' + extractedGtin.substring(8);
          // For matching purposes, we'll use both versions
          result.normalizedGtin = caseLevelGtin;
          console.log("ITEM GTIN:", extractedGtin, "-> Also check CASE GTIN:", caseLevelGtin);
        }
      }
      
      result.isGS1Format = true;
      console.log("Extracted GTIN:", result.gtin);
    }
    
    // Extract Lot Number
    const lotMatch = qrData.match(/Lot\s*Number:?\s*([A-Za-z0-9]+)/i);
    if (lotMatch && lotMatch[1]) {
      result.lotNumber = lotMatch[1];
      console.log("Extracted Lot Number:", result.lotNumber);
    }
    
    // Extract Expiration Date - more flexible matching
    const expMatch = qrData.match(/Expiration\s*Date:?\s*([0-9\/\-\.]+)/i);
    if (expMatch && expMatch[1]) {
      let dateStr = expMatch[1];
      console.log("Found expiration date string:", dateStr);
      
      // Try to handle various date formats
      if (dateStr.includes('/')) {
        // MM/DD/YY format
        const dateParts = dateStr.split('/');
        if (dateParts.length === 3) {
          const month = dateParts[0].padStart(2, '0');
          const day = dateParts[1].padStart(2, '0');
          let year = dateParts[2];
          
          // Convert 2-digit year to 4-digit
          if (year.length === 2) {
            year = parseInt(year) < 50 ? `20${year}` : `19${year}`;
          }
          
          result.expirationDate = `${year}-${month}-${day}`;
          console.log("Extracted Expiration Date (MM/DD/YY):", result.expirationDate);
        }
      } else if (dateStr.includes('-')) {
        // YYYY-MM-DD format
        const dateParts = dateStr.split('-');
        if (dateParts.length === 3) {
          result.expirationDate = dateStr;
          console.log("Extracted Expiration Date (YYYY-MM-DD):", result.expirationDate);
        }
      } else {
        // Try to parse as YYMMDD
        if (dateStr.length === 6 && /^\d{6}$/.test(dateStr)) {
          const yy = dateStr.substring(0, 2);
          const mm = dateStr.substring(2, 4);
          const dd = dateStr.substring(4, 6);
          const year = parseInt(yy) < 50 ? `20${yy}` : `19${yy}`;
          
          result.expirationDate = `${year}-${mm}-${dd}`;
          console.log("Extracted Expiration Date (YYMMDD):", result.expirationDate);
        }
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
      // Convert DataMatrix GTIN to EPCIS format
      result.epcisGtin = dataMatrixToEpcisGtin(result.gtin);
      console.log("Converted DataMatrix GTIN", result.gtin, "to EPCIS format:", result.epcisGtin);
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
    
    // Convert DataMatrix GTIN to EPCIS format
    result.epcisGtin = dataMatrixToEpcisGtin(result.gtin);
    console.log("Converted DataMatrix GTIN", result.gtin, "to EPCIS format:", result.epcisGtin);
    
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
 * Enhanced to handle CASE vs ITEM level GTIN matching
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
  gtinSimilar: boolean;
  lotMatch: boolean;
  expirationMatch: boolean;
  serialMatch: boolean;
  matchScore: number;
} {
  // Initialize with false
  const result = {
    matches: false,
    gtinMatch: false,
    gtinSimilar: false,
    lotMatch: false,
    expirationMatch: false,
    serialMatch: false,
    matchScore: 0
  };
  
  console.log("\n=== Comparing QR data with EPCIS data ===");
  console.log("QR GTIN:", qrData.gtin, "Serial:", qrData.serialNumber, "Lot:", qrData.lotNumber);
  console.log("EPCIS GTIN:", epcisData.gtin, "Serial:", epcisData.serialNumber, "Lot:", epcisData.lotNumber);
  
  // Fix for CASE/ITEM GTIN matching with more detailed string handling
  if (qrData.gtin && epcisData.gtin) {
    console.log("Checking GTIN match between:", qrData.gtin, "and", epcisData.gtin);
    
    // Use flexible GTIN comparison to handle format differences
    const gtinComparison = compareGTINsFlexibly(qrData.gtin, epcisData.gtin);
    console.log("GTIN comparison result:", gtinComparison);
    
    if (gtinComparison.exactMatch) {
      result.gtinMatch = true;
      console.log("✓ Exact GTIN match!");
    } else if (gtinComparison.sameProduct && gtinComparison.confidence >= 85) {
      // This is a format variation, not a perfect match
      result.gtinSimilar = true;
      console.log("✓ Same product detected (different GTIN format/check digit)!");
      console.log(`Confidence: ${gtinComparison.confidence}%`);
    } else if (qrData.gtin.length >= 14 && epcisData.gtin.length >= 14) {
      // Get the important parts before and after the indicator digit
      const qrFirstPart = qrData.gtin.substring(0, 7);
      const qrLastPart = qrData.gtin.substring(8);
      const epcisFirstPart = epcisData.gtin.substring(0, 7);
      const epcisLastPart = epcisData.gtin.substring(8);
      
      console.log("GTIN parts comparison:");
      console.log("QR parts:", qrFirstPart, "+", qrData.gtin.charAt(7), "+", qrLastPart);
      console.log("EPCIS parts:", epcisFirstPart, "+", epcisData.gtin.charAt(7), "+", epcisLastPart);
      
      // Check if the parts match except for the indicator digit
      if (qrFirstPart === epcisFirstPart && qrLastPart === epcisLastPart) {
        const qrIndicator = qrData.gtin.charAt(7);
        const epcisIndicator = epcisData.gtin.charAt(7);
        
        // Check for packaging level variations (0=item, 1-9=various packaging levels)
        // Common: 0=item, 3=inner pack, 4=case, 5=case, 9=special case
        const validPackagingVariation = 
          (qrIndicator !== epcisIndicator) && 
          (qrIndicator >= '0' && qrIndicator <= '9') &&
          (epcisIndicator >= '0' && epcisIndicator <= '9');
          
        if (validPackagingVariation) {
          // This is a packaging level variation, not an exact match
          result.gtinSimilar = true;
          console.log(`✓ Packaging level variation detected! QR indicator: ${qrIndicator}, EPCIS indicator: ${epcisIndicator}`);
          console.log(`QR: ${qrData.gtin} (level ${qrIndicator}) ~ EPCIS: ${epcisData.gtin} (level ${epcisIndicator})`);
        }
      }
    }
    
    // Check for similar GTINs (same company prefix and similar item reference)
    if (!result.gtinMatch && qrData.gtin && epcisData.gtin) {
      const qrPrefix = qrData.gtin.substring(0, 7); // Company prefix
      const epcisPrefix = epcisData.gtin.substring(0, 7);
      
      if (qrPrefix === epcisPrefix) {
        // Same company, check if item references are similar
        const qrItem = qrData.gtin.substring(7);
        const epcisItem = epcisData.gtin.substring(7);
        
        // Check if they share common digits (like 31401 vs 314013)
        const commonPart = Math.min(qrItem.length, epcisItem.length);
        let matchingDigits = 0;
        for (let i = 0; i < commonPart; i++) {
          if (qrItem[i] === epcisItem[i]) matchingDigits++;
        }
        
        if (matchingDigits >= 4) { // At least 4 matching digits in item reference
          result.gtinSimilar = true;
          console.log("✓ Similar GTIN detected! Same company, similar item reference");
          console.log(`QR: ${qrData.gtin} ~ EPCIS: ${epcisData.gtin}`);
        }
      }
    }
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
  
  // Check Serial Number match - ALWAYS check if both have serial numbers
  if (qrData.serialNumber && epcisData.serialNumber) {
    // Log serial numbers for debugging
    console.log("Comparing serial numbers:");
    console.log("QR serial:", qrData.serialNumber);
    console.log("EPCIS serial:", epcisData.serialNumber);
    console.log("Are they equal?", qrData.serialNumber === epcisData.serialNumber);
    
    // Case-sensitive direct comparison for serial numbers
    if (qrData.serialNumber === epcisData.serialNumber) {
      result.serialMatch = true;
      console.log("✓ Direct serial number match!");
    }
    // For pharmaceutical products, serial numbers must match exactly
    // No partial matches allowed for compliance reasons
    else {
      result.serialMatch = false;
      console.log("✗ Serial numbers do not match");
    }
  } else if (!qrData.serialNumber && !epcisData.serialNumber) {
    // Both have no serial number - consider it a match
    result.serialMatch = true;
    console.log("Both products have no serial number");
  } else {
    // One has serial, other doesn't
    result.serialMatch = false;
    console.log("Serial number mismatch: one product has serial, other doesn't");
  }
  
  // Calculate match score
  let score = 0;
  if (result.gtinMatch) {
    score += 40; // Exact GTIN match
  } else if (result.gtinSimilar) {
    // Check if this is just a format variation vs a packaging variation
    const gtinComparison = compareGTINsFlexibly(qrData.gtin || '', epcisData.gtin || '');
    if (gtinComparison.sameProduct && gtinComparison.confidence >= 85) {
      score += 35; // Format variation - same product, different GTIN encoding
    } else if (qrData.gtin && epcisData.gtin && 
        qrData.gtin.substring(0, 7) === epcisData.gtin.substring(0, 7) &&
        qrData.gtin.substring(8) === epcisData.gtin.substring(8)) {
      score += 30; // Packaging variation - same product, different level
    } else {
      score += 20; // Similar GTIN but different product variant
    }
  }
  if (result.lotMatch) score += 30;
  if (result.serialMatch) score += 20;
  if (result.expirationMatch) score += 10;
  
  result.matchScore = score;
  
  // Determine overall match status with flexible criteria
  // Option 1: Traditional exact match (GTIN + lot)
  if (result.gtinMatch && result.lotMatch) {
    // If both have serial numbers, they must match
    if (qrData.serialNumber && epcisData.serialNumber) {
      result.matches = result.serialMatch;
    } else {
      // If at least one doesn't have a serial number, GTIN + lot is sufficient
      result.matches = true;
    }
  }
  // Option 2: Similar GTIN (format variation) with lot match
  else if (result.gtinSimilar && result.lotMatch) {
    // For format variations, we're more flexible
    if (qrData.serialNumber && epcisData.serialNumber) {
      result.matches = result.serialMatch;
      if (result.matches) {
        console.log("✓ Match with GTIN format variation + lot + serial!");
      }
    } else {
      // No serial comparison needed
      result.matches = true;
      console.log("✓ Match with GTIN format variation + lot!");
    }
  }
  // Option 3: High confidence match based on lot + serial + expiration
  else if (result.lotMatch && result.serialMatch && result.expirationMatch) {
    result.matches = true;
    console.log("✓ Match based on lot + serial + expiration!");
  }
  // Option 4: Score-based match (60+ points)
  else if (result.matchScore >= 60) {
    result.matches = true;
    console.log(`✓ Match based on high score: ${result.matchScore}`);
  }
  
  console.log("Final match result:", result);
  
  return result;
}