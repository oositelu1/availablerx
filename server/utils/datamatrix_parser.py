#!/usr/bin/env python3
"""
DataMatrix Parser for GS1 formatted pharmaceutical barcodes.
Based on proven parsing logic that handles concatenated format without group separators.
"""

import sys
import json
from datetime import datetime

# GS1 Application Identifiers and their expected lengths 
# None means variable-length
GS1_AIS = {
    # 2-digit AIs
    '01': 14,   # GTIN (fixed)
    '10': None, # Lot Number (variable)
    '17': 6,    # Expiration Date YYMMDD (fixed)
    '21': None  # Serial Number (variable)
}

GROUP_SEPARATOR = '\x1d'  # ASCII 29

def parse_gs1_datamatrix(raw_data: str):
    """
    Parse GS1 DataMatrix barcode data with context-aware handling of hardware scanner quirks.
    
    The Tera Model D5100 scanner inserts "029" between fields where FNC1 should be.
    This parser handles that by checking for "029" at field boundaries.
    
    Args:
        raw_data: Raw DataMatrix content
        
    Returns:
        dict with parsed gtin, serial_number, lot_number, expiration_date, ndc
    """
    result = {
        'gtin': '',
        'serial_number': '',
        'lot_number': '',
        'expiration_date': '',
        'ndc': ''
    }
    
    remaining = raw_data
    
    while len(remaining) > 0:
        # Try to identify AI (2-digit only, since we confirmed 2110 doesn't exist)
        if len(remaining) < 2:
            break
            
        ai = remaining[:2]
        
        # Check if this is a known AI
        if ai not in GS1_AIS:
            # Skip unknown character and continue
            remaining = remaining[1:]
            continue
            
        # Remove AI from remaining string
        remaining = remaining[2:]
        
        # Get expected length for this AI
        expected_length = GS1_AIS[ai]
        
        # Extract the field value
        if expected_length is None:
            # Variable length - extract until FNC1, "029" anomaly, or next AI
            field_value = ""
            j = 0
            
            while j < len(remaining):
                # Check for FNC1 separator
                if j < len(remaining) and remaining[j] == GROUP_SEPARATOR:
                    j += 1  # Skip the separator
                    break
                    
                # Check for "029" anomaly followed by a known AI
                if j + 4 < len(remaining) and remaining[j:j+3] == "029":
                    # Check if "029" is followed by a valid AI
                    potential_ai = remaining[j+3:j+5]
                    if potential_ai in GS1_AIS:
                        # This is the hardware scanner separator
                        j += 3  # Skip the "029"
                        break
                
                # Check if we've hit the next AI (without separator)
                if j + 1 < len(remaining):
                    potential_ai = remaining[j:j+2]
                    if potential_ai in GS1_AIS:
                        # Found next AI, stop here
                        break
                        
                # Add this character to field value
                field_value += remaining[j]
                j += 1
                
            remaining = remaining[j:]
        else:
            # Fixed length - extract exact number of characters
            if len(remaining) >= expected_length:
                field_value = remaining[:expected_length]
                remaining = remaining[expected_length:]
                
                # After fixed-length field, check for separators
                if len(remaining) > 0:
                    # Skip FNC1 if present
                    if remaining[0] == GROUP_SEPARATOR:
                        remaining = remaining[1:]
                    # Skip "029" if it's acting as separator
                    elif len(remaining) >= 5 and remaining[:3] == "029" and remaining[3:5] in GS1_AIS:
                        remaining = remaining[3:]
            else:
                # Not enough data
                break
        
        # Store the parsed value based on AI
        if ai == '01' and not result['gtin']:
            result['gtin'] = field_value
        elif ai == '21' and not result['serial_number']:
            result['serial_number'] = field_value
        elif ai == '17' and not result['expiration_date']:
            if len(field_value) == 6 and field_value.isdigit():
                yy = int(field_value[0:2])
                mm = int(field_value[2:4])
                dd = int(field_value[4:6])
                
                # Convert YY to YYYY (00-49 -> 2000-2049, 50-99 -> 1950-1999)
                year = 2000 + yy if yy < 50 else 1900 + yy
                
                result['expiration_date'] = f"{year:04d}-{mm:02d}-{dd:02d}"
        elif ai == '10' and not result['lot_number']:
            result['lot_number'] = field_value
    
    # Extract NDC from GTIN
    if result['gtin'] and result['gtin'].startswith('003'):
        # For GTIN starting with 003, extract NDC from positions 4-12 (9 digits)
        ndc_raw = result['gtin'][3:12]  # 9 digits
        result['ndc'] = f"{ndc_raw[:5]}-{ndc_raw[5:]}"

    return result


def normalize_hardware_scanner_data(raw_data: str) -> str:
    """
    No longer doing preprocessing - parser now handles "029" contextually at field boundaries
    """
    return raw_data


def main():
    """Main entry point for command-line usage."""
    # Read from stdin instead of command line argument
    # This handles special characters and long data better
    try:
        raw_data = sys.stdin.read().strip()
        
        if not raw_data:
            print(json.dumps({'error': 'No data provided'}))
            sys.exit(1)
        
        # Normalize hardware scanner quirks before parsing
        normalized_data = normalize_hardware_scanner_data(raw_data)
        
        result = parse_gs1_datamatrix(normalized_data)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)


if __name__ == '__main__':
    main()