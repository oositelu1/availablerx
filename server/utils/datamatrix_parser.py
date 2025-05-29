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
    '21': None, # Serial Number (variable)
    # 4-digit AIs
    '2110': 12  # Fixed-length 12-digit serial (used by some hardware scanners)
}

GROUP_SEPARATOR = '\x1d'  # ASCII 29

def parse_gs1_datamatrix(raw_data: str):
    """
    Parse GS1 DataMatrix barcode data.
    
    Example input: 0100301439570103211001288845796017260930102405224
    Breaks down to:
      01 00301439570103  (GTIN)
      2110 013526893109  (Fixed-length Serial)
      17 260930          (Expiration) 
      10 24052241        (Lot)
    
    Args:
        raw_data: Raw DataMatrix content
        
    Returns:
        dict with parsed gtin, serial_number, lot_number, expiration_date, ndc
    """
    # Remove any group separators
    clean_data = raw_data.replace(GROUP_SEPARATOR, '')
    
    result = {
        'gtin': '',
        'serial_number': '',
        'lot_number': '',
        'expiration_date': '',
        'ndc': ''
    }
    
    i = 0
    
    while i < len(clean_data):
        # Try to match the longest AI first (4 digits, then 2 digits)
        ai = None
        ai_length = 0
        
        # Check 4-digit AIs first
        if i + 4 <= len(clean_data):
            potential_ai = clean_data[i:i+4]
            if potential_ai in GS1_AIS:
                ai = potential_ai
                ai_length = 4
        
        # If no 4-digit AI found, check 2-digit AIs
        if not ai and i + 2 <= len(clean_data):
            potential_ai = clean_data[i:i+2]
            if potential_ai in GS1_AIS:
                ai = potential_ai
                ai_length = 2
        
        if not ai:
            # No valid AI found at this position, skip
            i += 1
            continue
        
        # Get the expected length for this AI
        expected_length = GS1_AIS[ai]
        field_start = i + ai_length
        
        # Extract the field value
        if expected_length is None:
            # Variable length - find the end
            field_end = len(clean_data)  # default to end
            
            # Look for next valid AI
            for j in range(field_start + 1, len(clean_data)):
                # Check for 4-digit AI
                if j + 4 <= len(clean_data) and clean_data[j:j+4] in GS1_AIS:
                    field_end = j
                    break
                # Check for 2-digit AI
                elif j + 2 <= len(clean_data) and clean_data[j:j+2] in GS1_AIS:
                    field_end = j
                    break
            
            field_value = clean_data[field_start:field_end]
            i = field_end
        else:
            # Fixed length
            if field_start + expected_length <= len(clean_data):
                field_value = clean_data[field_start:field_start + expected_length]
                i = field_start + expected_length
            else:
                # Not enough data for this field
                i += 1
                continue
        
        # Store the parsed value based on AI
        if ai == '01' and not result['gtin']:
            result['gtin'] = field_value
        elif (ai == '21' or ai == '2110') and not result['serial_number']:
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
        # Expected format: 14395-7010
        ndc_raw = result['gtin'][3:12]  # 9 digits
        result['ndc'] = f"{ndc_raw[:5]}-{ndc_raw[5:]}"

    return result


def normalize_hardware_scanner_data(raw_data: str) -> str:
    """
    Normalize hardware scanner quirks.
    The Tera Model D5100 scanner inserts "029" before AI 17 (expiration date).
    Convert this to a proper GS1 group separator that the parser can handle.
    """
    # Replace "029" followed by "17" with group separator + "17"
    # This treats the hardware scanner's "029" as a field delimiter
    return raw_data.replace("02917", f"{GROUP_SEPARATOR}17")


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