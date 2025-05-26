import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string | Date): string {
  // Handle date-only strings (like "2026-09-30") without timezone conversion
  if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });
  }
  
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Converts a GTIN (Global Trade Item Number) to an NDC (National Drug Code) format
 * 
 * GTIN-14 format: Indicator(1) + Labeler(5) + Product(3) + Package(1) + Check(1)
 * NDC format: Labeler(5)-Product(4)-Package(2)
 * 
 * This is a simplified conversion and may not work for all GTINs
 */
export function gtinToNDC(gtin: string): string {
  if (!gtin || gtin.length < 11) return "Not available";
  
  try {
    // For GTIN-14, start at position 1 (after indicator digit)
    // For GTIN-12, start at position 0
    const startPos = gtin.length >= 14 ? 1 : 0;
    
    // Format as 5-4-2
    const labeler = gtin.substring(startPos, startPos + 5);
    const product = gtin.substring(startPos + 5, startPos + 9);
    const pkg = gtin.substring(startPos + 9, startPos + 11);
    
    return `${labeler}-${product}-${pkg}`;
  } catch (error) {
    console.error("Error converting GTIN to NDC:", error);
    return "Not available";
  }
}
