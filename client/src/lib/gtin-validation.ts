/**
 * GTIN validation and normalization utilities
 * Handles GTIN-8, GTIN-12, GTIN-13, and GTIN-14 formats
 */

import { normalizeGtinForComparison } from './gtin-utils';

/**
 * Calculate the GS1 check digit for a GTIN
 * @param gtin GTIN without check digit
 * @returns Calculated check digit
 */
export function calculateCheckDigit(gtin: string): string {
  const digits = gtin.replace(/[^0-9]/g, '');
  let sum = 0;
  
  // Process from right to left (excluding where check digit will be)
  for (let i = digits.length - 1; i >= 0; i--) {
    const digit = parseInt(digits[i]);
    // Multiply by 3 for even positions (from right), by 1 for odd
    const multiplier = ((digits.length - i) % 2 === 0) ? 3 : 1;
    sum += digit * multiplier;
  }
  
  // Check digit is the amount needed to make sum a multiple of 10
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit.toString();
}

/**
 * Validate if a GTIN has a correct check digit
 */
export function validateGTIN(gtin: string): boolean {
  if (!gtin || gtin.length < 8) return false;
  
  const digits = gtin.replace(/[^0-9]/g, '');
  const withoutCheck = digits.slice(0, -1);
  const providedCheck = digits.slice(-1);
  const calculatedCheck = calculateCheckDigit(withoutCheck);
  
  return providedCheck === calculatedCheck;
}

/**
 * Normalize a GTIN to GTIN-14 format (14 digits with leading zeros)
 */
export function normalizeToGTIN14(gtin: string): string {
  if (!gtin) return '';
  
  // Remove any non-numeric characters
  const cleaned = gtin.replace(/[^0-9]/g, '');
  
  // Pad with leading zeros to make it 14 digits
  return cleaned.padStart(14, '0');
}

/**
 * Extract the base product identifier from a GTIN (without packaging indicator and check digit)
 * This helps identify if two GTINs refer to the same base product
 */
export function extractBaseProduct(gtin: string): {
  companyPrefix: string;
  itemReference: string;
  fullBase: string;
} {
  const normalized = normalizeToGTIN14(gtin);
  
  // For GTIN-14: First digit is packaging indicator, last is check digit
  // Company prefix is typically positions 1-7 (0-indexed)
  // Item reference is positions 8-12
  
  const companyPrefix = normalized.substring(1, 8);
  const itemReference = normalized.substring(8, 13);
  const fullBase = companyPrefix + itemReference;
  
  return {
    companyPrefix,
    itemReference,
    fullBase
  };
}

/**
 * Check if two GTINs refer to the same base product
 * (ignoring packaging level and check digits)
 */
export function isSameBaseProduct(gtin1: string, gtin2: string): boolean {
  const base1 = extractBaseProduct(gtin1);
  const base2 = extractBaseProduct(gtin2);
  
  // Check if the company prefix and item reference match
  if (base1.fullBase === base2.fullBase) {
    return true;
  }
  
  // Special case for Nivagen products where item reference might be encoded differently
  // Example: 03140 vs 31401 (same digits, different order)
  if (base1.companyPrefix === base2.companyPrefix) {
    // Check if item references contain the same digits
    const sorted1 = base1.itemReference.split('').sort().join('');
    const sorted2 = base2.itemReference.split('').sort().join('');
    
    if (sorted1 === sorted2) {
      console.log('Detected Nivagen encoding variation:', base1.itemReference, 'vs', base2.itemReference);
      return true;
    }
    
    // Also check for specific known patterns
    // Pattern: EPCIS "03140" + "1" = DataMatrix "31401" + "3"
    if ((base1.itemReference === '03140' && base2.itemReference === '31401') ||
        (base1.itemReference === '31401' && base2.itemReference === '03140')) {
      return true;
    }
  }
  
  return false;
}

/**
 * Try to match GTINs by removing check digits and comparing core product codes
 * This handles cases where the same product has different check digits in different systems
 */
export function compareGTINsFlexibly(gtin1: string, gtin2: string): {
  exactMatch: boolean;
  sameProduct: boolean;
  sameCompany: boolean;
  confidence: number;
} {
  const normalized1 = normalizeToGTIN14(gtin1);
  const normalized2 = normalizeToGTIN14(gtin2);
  
  // Exact match
  if (normalized1 === normalized2) {
    return {
      exactMatch: true,
      sameProduct: true,
      sameCompany: true,
      confidence: 100
    };
  }
  
  // Try normalizing both to base item format for comparison
  const itemFormat1 = normalizeGtinForComparison(gtin1);
  const itemFormat2 = normalizeGtinForComparison(gtin2);
  
  if (itemFormat1 === itemFormat2) {
    console.log(`GTINs match after normalization: ${gtin1} → ${itemFormat1}, ${gtin2} → ${itemFormat2}`);
    return {
      exactMatch: true,
      sameProduct: true,
      sameCompany: true,
      confidence: 100
    };
  }
  
  const base1 = extractBaseProduct(gtin1);
  const base2 = extractBaseProduct(gtin2);
  
  // Same base product (company + item reference)
  if (base1.fullBase === base2.fullBase) {
    return {
      exactMatch: false,
      sameProduct: true,
      sameCompany: true,
      confidence: 90
    };
  }
  
  // Check using the more flexible same base product logic
  if (isSameBaseProduct(gtin1, gtin2)) {
    return {
      exactMatch: false,
      sameProduct: true,
      sameCompany: true,
      confidence: 85
    };
  }
  
  // Same company, different item
  if (base1.companyPrefix === base2.companyPrefix) {
    // Check if item references are similar
    let itemSimilarity = 0;
    const minLen = Math.min(base1.itemReference.length, base2.itemReference.length);
    
    for (let i = 0; i < minLen; i++) {
      if (base1.itemReference[i] === base2.itemReference[i]) {
        itemSimilarity++;
      }
    }
    
    const similarityPercent = (itemSimilarity / minLen) * 100;
    
    return {
      exactMatch: false,
      sameProduct: similarityPercent > 80,
      sameCompany: true,
      confidence: Math.round(50 + (similarityPercent * 0.4))
    };
  }
  
  return {
    exactMatch: false,
    sameProduct: false,
    sameCompany: false,
    confidence: 0
  };
}

/**
 * Parse various GTIN formats and convert to standard GTIN-14
 */
export function parseGTINFormat(input: string): {
  original: string;
  normalized: string;
  format: 'GTIN-8' | 'GTIN-12' | 'GTIN-13' | 'GTIN-14' | 'UNKNOWN';
  valid: boolean;
} {
  const cleaned = input.replace(/[^0-9]/g, '');
  
  let format: 'GTIN-8' | 'GTIN-12' | 'GTIN-13' | 'GTIN-14' | 'UNKNOWN' = 'UNKNOWN';
  
  switch (cleaned.length) {
    case 8:
      format = 'GTIN-8';
      break;
    case 12:
      format = 'GTIN-12';
      break;
    case 13:
      format = 'GTIN-13';
      break;
    case 14:
      format = 'GTIN-14';
      break;
  }
  
  const normalized = normalizeToGTIN14(cleaned);
  const valid = validateGTIN(cleaned);
  
  return {
    original: input,
    normalized,
    format,
    valid
  };
}