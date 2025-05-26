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
import axios from 'axios';

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
  ndc?: string;             // NDC extracted from GTIN
}

/**
 * Parse QR/DataMatrix code using backend Python parser for accuracy
 * @param qrData Raw scanned data
 * @returns Promise with parsed data
 */
export async function parseQRCodeAsync(qrData: string): Promise<ParsedQRData> {
  try {
    console.log("Parsing QR code with backend parser:", qrData);
    
    // Call backend parser
    const response = await axios.post('/api/parse-datamatrix', {
      rawData: qrData
    });
    
    console.log("Backend response:", response.data);
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to parse');
    }
    
    const parsed = response.data.data;
    console.log("Parsed data from backend:", parsed);
    
    // Convert backend response to our format
    const result: ParsedQRData = {
      raw: qrData,
      gtin: parsed.gtin || undefined,
      lotNumber: parsed.lot_number || undefined,
      expirationDate: parsed.expiration_date || undefined,
      serialNumber: parsed.serial_number || undefined,
      ndc: parsed.ndc || undefined,
      isGS1Format: !!(parsed.gtin || parsed.lot_number || parsed.serial_number)  // If we have any field, it's GS1
    };
    
    // Add EPCIS GTIN conversion if we have a GTIN
    if (result.gtin) {
      result.epcisGtin = dataMatrixToEpcisGtin(result.gtin);
      
      // Normalize GTIN for comparison
      const gtinInfo = parseGTINFormat(result.gtin);
      if (gtinInfo.isCase) {
        result.normalizedGtin = gtinInfo.itemGTIN;
      }
    }
    
    console.log("Final parser result:", result);
    return result;
    
  } catch (error: any) {
    console.error("Backend parser error:", error);
    console.error("Error details:", error.response?.data || error.message);
    console.log("Falling back to local parser");
    // Fallback to local parser
    return parseQRCode(qrData);
  }
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
  // Try to parse raw DataMatrix content without parentheses
  else {
    console.log('Attempting to parse raw DataMatrix format');
    
    // Raw DataMatrix codes often contain FNC1 separators (ASCII 29) or are concatenated
    // Common patterns:
    // 1. 01GTIN17YYMMDD10LOT21SERIAL
    // 2. 01GTIN + FNC1 + 17YYMMDD + FNC1 + 10LOT + FNC1 + 21SERIAL
    
    // Replace FNC1 characters with a marker we can use
    const fnc1 = String.fromCharCode(29);
    const cleanData = qrData.replace(new RegExp(fnc1, 'g'), '|');
    
    // Try to find AIs without parentheses
    // GTIN - AI 01 (14 digits)
    const gtinMatch = cleanData.match(/(?:^|\|)?01(\d{14})(?:\||$)/);
    if (!gtinMatch) {
      // Fallback: Check if it starts with 14 digits
      const rawGtinMatch = cleanData.match(/^(\d{14})/);
      if (rawGtinMatch) {
        result.gtin = rawGtinMatch[1];
        result.epcisGtin = dataMatrixToEpcisGtin(result.gtin);
        console.log("Extracted GTIN from start of code:", result.gtin);
      }
    } else {
      result.gtin = gtinMatch[1];
      result.epcisGtin = dataMatrixToEpcisGtin(result.gtin);
      console.log("Extracted GTIN with AI 01:", result.gtin);
    }
    
    // Expiration Date - AI 17 (6 digits YYMMDD)
    const expMatch = cleanData.match(/(?:^|\|)?17(\d{6})(?:\||$)/);
    if (expMatch) {
      const yymmdd = expMatch[1];
      const year = `20${yymmdd.substring(0, 2)}`;
      const month = yymmdd.substring(2, 4);
      const day = yymmdd.substring(4, 6);
      
      // Keep as YYYY-MM-DD string to avoid timezone issues
      result.expirationDate = `${year}-${month}-${day}`;
      console.log("Extracted expiration date with AI 17:", result.expirationDate);
    }
    
    // Lot Number - AI 10 (variable length, up to 20 chars)
    const lotMatch = cleanData.match(/(?:^|\|)?10([A-Za-z0-9]{1,20})(?:\||$|(?=\d{2}[A-Za-z0-9]))/);
    if (lotMatch) {
      result.lotNumber = lotMatch[1];
      console.log("Extracted lot number with AI 10:", result.lotNumber);
    }
    
    // Serial Number - AI 21 (variable length, up to 20 chars)
    const serialMatch = cleanData.match(/(?:^|\|)?21([A-Za-z0-9]{1,20})(?:\||$|(?=\d{2}[A-Za-z0-9]))/);
    if (serialMatch) {
      result.serialNumber = serialMatch[1];
      console.log("Extracted serial number with AI 21:", result.serialNumber);
    }
    
    // If we found at least a GTIN, mark as GS1 format
    if (result.gtin) {
      result.isGS1Format = true;
    }
    
    // Fallback parsing for concatenated format without clear AIs
    if (!result.gtin && /^\d{14}/.test(cleanData)) {
      // Try the legacy parsing approach
      result.gtin = cleanData.substring(0, 14);
      result.epcisGtin = dataMatrixToEpcisGtin(result.gtin);
      console.log("Fallback: Extracted GTIN from raw format:", result.gtin);
      
      if (cleanData.length > 14) {
        const remainder = cleanData.substring(14);
        
        // Look for date pattern YYMMDD
        if (/^\d{6}/.test(remainder)) {
          const dateStr = remainder.substring(0, 6);
          const year = `20${dateStr.substring(0, 2)}`;
          const month = dateStr.substring(2, 4);
          const day = dateStr.substring(4, 6);
          
          // Keep as YYYY-MM-DD string to avoid timezone issues
          result.expirationDate = `${year}-${month}-${day}`;
          console.log("Fallback: Extracted expiration date:", result.expirationDate);
          
          // Rest might be lot/serial
          if (remainder.length > 6) {
            const rest = remainder.substring(6);
            // Simple heuristic: if it contains letters, probably lot number
            if (/[A-Za-z]/.test(rest)) {
              result.lotNumber = rest.match(/([A-Za-z0-9]+)/)?.[1] || '';
            } else {
              result.serialNumber = rest;
            }
          }
        }
      }
    }
  }
  
  // Handle URL or JSON formats as a fallback
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