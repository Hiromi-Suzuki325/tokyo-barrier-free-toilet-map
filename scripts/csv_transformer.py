#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CSV Transformer Script
Converts Tokyo Metropolitan Government barrier-free toilet data from raw format to simplified format.

Source: 3_koukyoshisetsu_barieer_free_wc - シート1.csv
Target: barieer_free_wc_ver3 - シート1.csv format

This script extracts and transforms the necessary fields from the comprehensive
barrier-free toilet data into a simplified format for use in the map application.
"""

import pandas as pd
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
        # Read the source CSV file
        print(f"Reading source file: {input_file}")
        df = pd.read_csv(input_file, encoding='utf-8')
        
        # Filter out rows where 施設名 is empty (skip header/empty rows)
        df = df[df['施設名'].notna() & (df['施設名'] != '')]
        
        # Define the column mapping from source to target (with English headers)
        column_mapping = {
            '施設名': 'facility_name',
            '都道府県': 'prefecture', 
            '市区町村・番地': 'address',
            'トイレ名': 'toilet_name',
            '設置フロア': 'floor',
            '経度': 'longitude',
            '緯度': 'latitude',
            '性別の分け': 'gender',
            '戸の形式': 'door_type',
            '車椅子が出入りできる（出入口の有効幅員80cm以上）': 'wheelchair_accessible',
            '車椅子が転回できる（直径150cm以上の円が内接できる）': 'wheelchair_turnaround',
            '便座に背もたれがある': 'seat_backrest',
            '便座に手すりがある': 'seat_handrail',
            'オストメイト用設備がある': 'ostomy_equipment',
            'オストメイト用設備が温水対応している': 'ostomy_hot_water',
            '大型ベッドを備えている': 'large_bed',
            '乳幼児用おむつ交換台等を備えている': 'baby_changing',
            '乳幼児用椅子を備えている': 'baby_chair',
            '月曜日': 'monday',
            '火曜日': 'tuesday',
            '水曜日': 'wednesday',
            '木曜日': 'thursday',
            '金曜日': 'friday',
            '土曜日': 'saturday',
            '日曜日': 'sunday',
            '祝日': 'holiday',
            'その他': 'other',
            '写真データ（トイレの入り口）': 'photo_entrance',
            '写真データ（トイレ内）': 'photo_interior',
            '写真データ（トイレ内（別角度））': 'photo_interior2',
            '備考': 'remarks'
        }
        
        # Create the target DataFrame with selected columns
        target_df = pd.DataFrame()
        
        # Map the columns
        for source_col, target_col in column_mapping.items():
            if source_col in df.columns:
                target_df[target_col] = df[source_col]
            else:
                # If column doesn't exist in source, create empty column
                target_df[target_col] = ''
        
        # Convert ○/× values to TRUE/FALSE for boolean columns
        boolean_columns = [
            'wheelchair_accessible',
            'wheelchair_turnaround',
            'seat_backrest',
            'seat_handrail',
            'ostomy_equipment',
            'ostomy_hot_water',
            'large_bed',
            'baby_changing',
            'baby_chair'
        ]
        
        for col in boolean_columns:
            if col in target_df.columns:
                target_df[col] = target_df[col].apply(convert_boolean_value)
        
        # Clean up the data
        target_df = target_df.fillna('')  # Replace NaN with empty string
        
        # Insert an empty row at the beginning (matching the target format)
        empty_row = pd.DataFrame([[''] * len(target_df.columns)], columns=target_df.columns)
        target_df = pd.concat([empty_row, target_df], ignore_index=True)
        
        # Write the transformed data to the output file
        print(f"Writing transformed data to: {output_file}")
        target_df.to_csv(output_file, index=False, encoding='utf-8')
        
        print(f"Successfully transformed {len(target_df) - 1} records")  # -1 for empty row
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