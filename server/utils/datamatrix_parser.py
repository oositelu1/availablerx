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
    '01': 14,   # GTIN (fixed)
    '10': None, # Lot Number (variable)
    '17': 6,    # Expiration Date YYMMDD (fixed)
    '21': None  # Serial Number (variable)
}

GROUP_SEPARATOR = '\x1d'  # ASCII 29

def parse_gs1_datamatrix(raw_data: str):
    """
    Parse GS1 DataMatrix barcode data.
    
    Example input: 0100301439570103211001288845796017260930102405224
    Breaks down to:
      01 00301439570103  (GTIN)
      21 10012888457960  (Serial)
      17 260930          (Expiration) 
      10 2405224         (Lot)
    
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
    
    while i < len(clean_data) - 1:
        # Must have at least 2 chars for AI
        if i + 2 > len(clean_data):
            break
            
        ai = clean_data[i:i+2]
        
        # Process AIs based on what we've already found
        # This prevents finding "01" within serial numbers, etc.
        
        # GTIN (01) - must be at start
        if ai == '01' and not result['gtin'] and i + 16 <= len(clean_data):
            result['gtin'] = clean_data[i+2:i+16]
            i += 16
            continue
            
        # Serial (21) - variable length
        elif ai == '21' and result['gtin'] and not result['serial_number']:
            start = i + 2
            
            # Find end of serial - look for next AI
            end = len(clean_data)  # default to end
            for j in range(start + 1, len(clean_data) - 1):
                next_ai = clean_data[j:j+2]
                # Check if this looks like a valid AI
                if next_ai == '17' and j + 8 <= len(clean_data):
                    # Verify it's followed by 6 digits
                    if clean_data[j+2:j+8].isdigit():
                        end = j
                        break
                elif next_ai == '10':
                    # Could be lot number AI
                    end = j
                    break
                    
            result['serial_number'] = clean_data[start:end]
            i = end
            continue
            
        # Expiration (17) - fixed 6 digits  
        elif ai == '17' and result['gtin'] and not result['expiration_date'] and i + 8 <= len(clean_data):
            exp_date = clean_data[i+2:i+8]
            if exp_date.isdigit() and len(exp_date) == 6:
                yy = int(exp_date[0:2])
                mm = int(exp_date[2:4])
                dd = int(exp_date[4:6])
                
                # Convert YY to YYYY (00-49 -> 2000-2049, 50-99 -> 1950-1999)
                year = 2000 + yy if yy < 50 else 1900 + yy
                
                result['expiration_date'] = f"{year:04d}-{mm:02d}-{dd:02d}"
            i += 8
            continue
            
        # Lot (10) - variable length, usually at end
        elif ai == '10' and result['gtin'] and not result['lot_number']:
            # Everything after AI is the lot number
            result['lot_number'] = clean_data[i+2:]
            break
            
        else:
            # Not a valid AI at this position
            i += 1
    
    # Extract NDC from GTIN
    if result['gtin'] and result['gtin'].startswith('003'):
        # For GTIN starting with 003, extract NDC from positions 4-12 (9 digits)
        # Expected format: 14395-7010
        ndc_raw = result['gtin'][3:12]  # 9 digits
        result['ndc'] = f"{ndc_raw[:5]}-{ndc_raw[5:]}"

    return result


def main():
    """Main entry point for command-line usage."""
    if len(sys.argv) != 2:
        print(json.dumps({'error': 'Usage: python datamatrix_parser.py <raw_data>'}))
        sys.exit(1)
    
    raw_data = sys.argv[1]
    
    try:
        result = parse_gs1_datamatrix(raw_data)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)


if __name__ == '__main__':
    main()