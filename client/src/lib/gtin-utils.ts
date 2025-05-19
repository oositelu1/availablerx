/**
 * Utility functions for working with GTINs
 */

/**
 * Determines if a GTIN represents a Case based on the indicator digit
 * According to GS1 standards, the indicator digit is:
 * - '0' for base unit (each/item)
 * - '1' to '8' for packaging levels
 * - '9' for variable quantity items
 * 
 * For pharmaceutical products, indicator digits of '1' through '8' (especially '4' and '5') 
 * are commonly used to indicate higher packaging levels like Case
 * 
 * This function properly handles GTINs with or without leading zeros and in different formats
 */
export function isCase(gtin: string): boolean {
  if (!gtin) return false;
  
  // Check for SGTIN URI pattern (urn:epc:id:sgtin:...)
  if (gtin.startsWith('urn:epc:id:sgtin:') || gtin.startsWith('urn:epc:idpat:sgtin:')) {
    const parts = gtin.split(':');
    // Extract the item reference portion which contains the indicator digit
    const lastPart = parts[parts.length - 1];
    const itemRef = lastPart.split('.')[1]; // Get the middle segment after company prefix
    
    // If the item reference starts with 1-8, it's likely a case
    if (itemRef && itemRef.length > 0) {
      const firstDigit = itemRef.charAt(0);
      return firstDigit >= '1' && firstDigit <= '8';
    }
    
    return false;
  }

  // For regular GTIN format (numeric string)
  // Normalize to 14 digits by adding leading zeros if needed
  const normalizedGtin = gtin.padStart(14, '0');
  
  // In a 14-digit GTIN, the indicator digit is the first digit
  const indicatorDigit = normalizedGtin.charAt(0);
  
  // Indicator digits 1-8 are used for packaging levels above the base unit
  return indicatorDigit >= '1' && indicatorDigit <= '8';
}

/**
 * Determines if a GTIN represents an Item/Each based on the indicator digit
 */
export function isItem(gtin: string): boolean {
  if (!gtin) return false;
  
  // Check for SGTIN URI pattern (urn:epc:id:sgtin:...)
  if (gtin.startsWith('urn:epc:id:sgtin:') || gtin.startsWith('urn:epc:idpat:sgtin:')) {
    const parts = gtin.split(':');
    // Extract the item reference portion which contains the indicator digit
    const lastPart = parts[parts.length - 1];
    const itemRef = lastPart.split('.')[1]; // Get the middle segment after company prefix
    
    // In SGTIN, if the item reference starts with 0, it's an item/each
    if (itemRef && itemRef.length > 0) {
      const firstDigit = itemRef.charAt(0);
      return firstDigit === '0';
    }
    
    return false;
  }
  
  // For regular GTIN format (numeric string)
  // Normalize to 14 digits by adding leading zeros if needed
  const normalizedGtin = gtin.padStart(14, '0');
  
  // The indicator digit is the first digit of the 14-digit GTIN
  const indicatorDigit = normalizedGtin.charAt(0);
  
  // '0' indicates a base unit (each/item)
  return indicatorDigit === '0';
}

/**
 * Converts a Case GTIN to its corresponding Item/Each GTIN
 * This is useful for matching GTINs across different packaging levels
 */
export function caseToItemGtin(caseGtin: string): string {
  if (!caseGtin) return '';
  
  // Normalize to 14 digits by adding leading zeros if needed
  const normalizedGtin = caseGtin.padStart(14, '0');
  
  // Replace the indicator digit (first digit) with '0'
  return '0' + normalizedGtin.substring(1);
}

/**
 * Converts an Item/Each GTIN to its corresponding Case GTIN
 */
export function itemToCaseGtin(itemGtin: string): string {
  if (!itemGtin) return '';
  
  // Normalize to 14 digits by adding leading zeros if needed
  const normalizedGtin = itemGtin.padStart(14, '0');
  
  // Replace the indicator digit (first digit) with '5'
  return '5' + normalizedGtin.substring(1);
}