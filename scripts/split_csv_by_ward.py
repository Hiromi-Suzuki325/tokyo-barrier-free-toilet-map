#!/usr/bin/env python3
"""
CSVデータを東京23区別に分割するスクリプト
"""
import csv
import os
import re
from collections import defaultdict

# 東京23区のリスト
TOKYO_WARDS = [
    "千代田区", "中央区", "港区", "新宿区", "文京区", "台東区", "墨田区", "江東区",
    "品川区", "目黒区", "大田区", "世田谷区", "渋谷区", "中野区", "杉並区", "豊島区",
    "北区", "荒川区", "板橋区", "練馬区", "足立区", "葛飾区", "江戸川区"
]

def extract_ward_from_address(address):
    """住所から区名を抽出"""
    for ward in TOKYO_WARDS:
        if ward in address:
            return ward
    return "その他"

def split_csv_by_ward(input_file, output_dir):
    """CSVファイルを区別に分割"""
    # 出力ディレクトリを作成
    os.makedirs(output_dir, exist_ok=True)
    
    # 区別のデータを格納
    ward_data = defaultdict(list)
    
    # CSVファイルを読み込み
    with open(input_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames
        
        for row in reader:
            ward = extract_ward_from_address(row['address'])
            ward_data[ward].append(row)
    
    # 区別にファイルを出力
    for ward, rows in ward_data.items():
        if ward == "その他":
            continue  # その他の地域は除外
            
        output_file = os.path.join(output_dir, f"{ward}.csv")
        with open(output_file, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            writer.writerows(rows)
        
        print(f"{ward}: {len(rows)}件 -> {output_file}")

def main():
    # 公共施設データを分割
    split_csv_by_ward(
        'data/barrier_free_toilets.csv',
        'data/wards'
    )
    
    # 駅データを分割
    split_csv_by_ward(
        'data/station_barrier_free_toilets.csv',
        'data/station_wards'
    )

if __name__ == "__main__":
    main()