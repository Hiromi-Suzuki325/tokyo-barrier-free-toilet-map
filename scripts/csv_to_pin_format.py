#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CSV to Pin Format Converter
Converts the transformed CSV to the pin data format used in the app.

Target format: name,address,floor,toilet_name,note,color,lng,lat
"""

import csv
import sys
import os

def create_facility_note(row):
    """Create a comprehensive note from facility data"""
    features = []
    
    # Check accessibility features
    if row.get('車椅子が出入りできる（出入口の有効幅員80cm以上）') == 'TRUE':
        features.append('車椅子対応')
    if row.get('オストメイト用設備がある') == 'TRUE':
        features.append('オストメイト対応')
    if row.get('大型ベッドを備えている') == 'TRUE':
        features.append('大型ベッド')
    if row.get('乳幼児用おむつ交換台等を備えている') == 'TRUE':
        features.append('おむつ交換台')
    if row.get('乳幼児用椅子を備えている') == 'TRUE':
        features.append('乳幼児用椅子')
    
    # Create note
    note_parts = []
    if features:
        note_parts.append(f"設備: {', '.join(features)}")
    
    # Add door type
    door_type = row.get('戸の形式', '').strip()
    if door_type:
        note_parts.append(f"扉: {door_type}")
    
    # Add operating hours if available
    hours = []
    days = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日', '祝日']
    for day in days:
        hour = row.get(day, '').strip()
        if hour:
            hours.append(f"{day}: {hour}")
    
    if hours:
        note_parts.append(f"営業時間: {', '.join(hours[:3])}")  # First 3 days to avoid too long
    
    # Add special notes
    special_note = row.get('備考', '').strip()
    if special_note:
        note_parts.append(f"備考: {special_note}")
    
    return ' | '.join(note_parts)

def transform_to_pin_format(input_file, output_file):
    """Transform CSV to pin format"""
    
    try:
        print(f"Reading source file: {input_file}")
        
        with open(input_file, 'r', encoding='utf-8') as infile, \
             open(output_file, 'w', encoding='utf-8', newline='') as outfile:
            
            reader = csv.DictReader(infile)
            writer = csv.DictWriter(outfile, fieldnames=['name', 'address', 'floor', 'toilet_name', 'note', 'color', 'lng', 'lat'])
            
            # Write header
            writer.writeheader()
            
            row_count = 0
            for row in reader:
                # Skip empty rows
                if not row.get('施設名', '').strip():
                    continue
                
                # Create pin data
                pin_data = {
                    'name': row.get('施設名', '').strip(),
                    'address': f"{row.get('都道府県', '').strip()} {row.get('市区町村・番地', '').strip()}".strip(),
                    'floor': row.get('設置フロア', '').strip(),
                    'toilet_name': row.get('トイレ名', '').strip(),
                    'note': create_facility_note(row),
                    'color': '#00cc00',  # Green color for public facilities
                    'lng': row.get('経度', '').strip(),
                    'lat': row.get('緯度', '').strip()
                }
                
                writer.writerow(pin_data)
                row_count += 1
        
        print(f"Successfully converted {row_count} records to pin format")
        print(f"Output file created: {output_file}")
        
    except Exception as e:
        print(f"Error during conversion: {str(e)}")
        sys.exit(1)

def main():
    """Main function"""
    
    input_file = "barieer_free_wc_ver3_transformed.csv"
    output_file = "barrier_free_toilets_pin_format.csv"
    
    if not os.path.exists(input_file):
        print(f"Error: Input file '{input_file}' not found.")
        sys.exit(1)
    
    print("Converting CSV to pin format...")
    print(f"Source: {input_file}")
    print(f"Target: {output_file}")
    print("-" * 50)
    
    transform_to_pin_format(input_file, output_file)
    
    print("-" * 50)
    print("Conversion completed successfully!")

if __name__ == "__main__":
    main()