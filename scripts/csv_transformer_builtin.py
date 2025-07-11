#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CSV Transformer Script (Built-in modules only)
Converts Tokyo Metropolitan Government barrier-free toilet data from raw format to simplified format.

Source: 3_koukyoshisetsu_barieer_free_wc - シート1.csv
Target: barieer_free_wc_ver3 - シート1.csv format

This script uses only Python built-in modules (csv) to avoid dependency issues.
"""

import csv
import sys
import os

def convert_boolean_value(value):
    """Convert ○/× symbols to TRUE/FALSE"""
    if value == '○':
        return 'TRUE'
    elif value == '×':
        return 'FALSE'
    else:
        return 'FALSE'  # Default to FALSE for empty or unknown values

def transform_csv(input_file, output_file):
    """
    Transform the source CSV file to the target format.
    
    Args:
        input_file (str): Path to the source CSV file
        output_file (str): Path to the output CSV file
    """
    try:
        # Define the target column order
        target_columns = [
            '施設名',
            '都道府県', 
            '市区町村・番地',
            'トイレ名',
            '設置フロア',
            '経度',
            '緯度',
            '性別の分け',
            '戸の形式',
            '車椅子が出入りできる（出入口の有効幅員80cm以上）',
            '車椅子が転回できる（直径150cm以上の円が内接できる）',
            '便座に背もたれがある',
            '便座に手すりがある',
            'オストメイト用設備がある',
            'オストメイト用設備が温水対応している',
            '大型ベッドを備えている',
            '乳幼児用おむつ交換台等を備えている',
            '乳幼児用椅子を備えている',
            '月曜日',
            '火曜日',
            '水曜日',
            '木曜日',
            '金曜日',
            '土曜日',
            '日曜日',
            '祝日',
            'その他',
            '写真データ（トイレの入り口）',
            '写真データ（トイレ内）',
            '写真データ（トイレ内（別角度））',
            '備考'
        ]
        
        # Boolean columns that need ○/× to TRUE/FALSE conversion
        boolean_columns = {
            '車椅子が出入りできる（出入口の有効幅員80cm以上）',
            '車椅子が転回できる（直径150cm以上の円が内接できる）',
            '便座に背もたれがある',
            '便座に手すりがある',
            'オストメイト用設備がある',
            'オストメイト用設備が温水対応している',
            '大型ベッドを備えている',
            '乳幼児用おむつ交換台等を備えている',
            '乳幼児用椅子を備えている'
        }
        
        print(f"Reading source file: {input_file}")
        
        # Read the source CSV file and write the transformed data
        with open(input_file, 'r', encoding='utf-8') as infile, \
             open(output_file, 'w', encoding='utf-8', newline='') as outfile:
            
            reader = csv.DictReader(infile)
            writer = csv.DictWriter(outfile, fieldnames=target_columns)
            
            # Write the header
            writer.writeheader()
            
            # Write an empty row (to match the target format)
            empty_row = {col: '' for col in target_columns}
            writer.writerow(empty_row)
            
            # Process each row
            row_count = 0
            for row in reader:
                # Skip rows where 施設名 is empty
                if not row.get('施設名', '').strip():
                    continue
                
                # Create the target row
                target_row = {}
                for col in target_columns:
                    value = row.get(col, '')
                    
                    # Convert boolean values
                    if col in boolean_columns:
                        value = convert_boolean_value(value)
                    
                    target_row[col] = value
                
                writer.writerow(target_row)
                row_count += 1
        
        print(f"Successfully transformed {row_count} records")
        print(f"Output file created: {output_file}")
        
    except FileNotFoundError:
        print(f"Error: Source file '{input_file}' not found.")
        sys.exit(1)
    except Exception as e:
        print(f"Error during transformation: {str(e)}")
        sys.exit(1)

def main():
    """Main function to run the CSV transformation"""
    
    # Define file paths
    input_file = "3_koukyoshisetsu_barieer_free_wc - シート1.csv"
    output_file = "barieer_free_wc_ver3_transformed.csv"
    
    # Check if source file exists
    if not os.path.exists(input_file):
        print(f"Error: Source file '{input_file}' not found in current directory.")
        print("Please make sure the file exists and run the script from the correct directory.")
        sys.exit(1)
    
    # Run the transformation
    print("Starting CSV transformation...")
    print(f"Source: {input_file}")
    print(f"Target: {output_file}")
    print("-" * 50)
    
    transform_csv(input_file, output_file)
    
    print("-" * 50)
    print("Transformation completed successfully!")

if __name__ == "__main__":
    main()