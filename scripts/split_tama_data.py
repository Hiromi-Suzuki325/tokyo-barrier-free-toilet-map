#!/usr/bin/env python3
"""
23区外データ（多摩地域・島嶼部）を市町村別に分割するスクリプト
"""
import csv
import os
import re
from collections import defaultdict

# 多摩地域の主要市
TAMA_CITIES = [
    "八王子市", "立川市", "武蔵野市", "三鷹市", "青梅市", "府中市", "昭島市", "調布市",
    "町田市", "小金井市", "小平市", "日野市", "東村山市", "国分寺市", "国立市",
    "福生市", "狛江市", "東大和市", "清瀬市", "東久留米市", "武蔵村山市", "多摩市",
    "稲城市", "羽村市", "あきる野市", "西東京市"
]

# 西多摩郡
NISHI_TAMA_GUN = [
    "瑞穂町", "日の出町", "檜原村", "奥多摩町"
]

# 島嶼部
ISLAND_AREAS = [
    "大島町", "利島村", "新島村", "神津島村", "三宅村", "御蔵島村", 
    "八丈町", "青ヶ島村", "小笠原村"
]

def extract_area_from_address(address):
    """住所から地域（市区町村）を抽出"""
    # 23区の処理
    for ward in ["千代田区", "中央区", "港区", "新宿区", "文京区", "台東区", "墨田区", "江東区",
                 "品川区", "目黒区", "大田区", "世田谷区", "渋谷区", "中野区", "杉並区", "豊島区",
                 "北区", "荒川区", "板橋区", "練馬区", "足立区", "葛飾区", "江戸川区"]:
        if ward in address:
            return ("23ku", ward)
    
    # 多摩地域の市の処理
    for city in TAMA_CITIES:
        if city in address:
            return ("tama_city", city)
    
    # 西多摩郡の処理
    for town in NISHI_TAMA_GUN:
        if town in address:
            return ("nishi_tama", town)
    
    # 島嶼部の処理
    for island in ISLAND_AREAS:
        if island in address:
            return ("island", island)
    
    # その他（都外など）
    return ("other", "その他")

def analyze_tama_data(input_file):
    """23区外データの詳細分析"""
    area_stats = defaultdict(int)
    area_data = defaultdict(list)
    
    with open(input_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames
        
        for row in reader:
            area_type, area_name = extract_area_from_address(row['address'])
            
            if area_type != "23ku":  # 23区以外のみ
                area_stats[f"{area_type}:{area_name}"] += 1
                area_data[f"{area_type}:{area_name}"].append(row)
    
    # 統計情報を出力
    print("=== 23区外データ分析結果 ===")
    print(f"総データ数: {sum(area_stats.values())}件")
    print("\n【多摩地域の市】")
    tama_total = 0
    for area, count in sorted(area_stats.items()):
        if area.startswith("tama_city:"):
            city = area.split(":")[1]
            print(f"  {city}: {count}件")
            tama_total += count
    print(f"  多摩地域合計: {tama_total}件")
    
    print("\n【西多摩郡】")
    nishi_tama_total = 0
    for area, count in sorted(area_stats.items()):
        if area.startswith("nishi_tama:"):
            town = area.split(":")[1]
            print(f"  {town}: {count}件")
            nishi_tama_total += count
    print(f"  西多摩郡合計: {nishi_tama_total}件")
    
    print("\n【島嶼部】")
    island_total = 0
    for area, count in sorted(area_stats.items()):
        if area.startswith("island:"):
            island = area.split(":")[1]
            print(f"  {island}: {count}件")
            island_total += count
    print(f"  島嶼部合計: {island_total}件")
    
    print("\n【その他】")
    other_total = 0
    for area, count in sorted(area_stats.items()):
        if area.startswith("other:"):
            other_total += count
    print(f"  その他: {other_total}件")
    
    return area_data, headers

def split_tama_data(input_file, base_output_dir):
    """23区外データを地域別に分割"""
    area_data, headers = analyze_tama_data(input_file)
    
    # 出力ディレクトリを作成
    tama_dir = os.path.join(base_output_dir, 'tama_cities')
    nishi_tama_dir = os.path.join(base_output_dir, 'nishi_tama')
    island_dir = os.path.join(base_output_dir, 'islands')
    
    os.makedirs(tama_dir, exist_ok=True)
    os.makedirs(nishi_tama_dir, exist_ok=True)
    os.makedirs(island_dir, exist_ok=True)
    
    print("\n=== ファイル分割処理 ===")
    
    # 地域別にファイルを出力
    for area_key, rows in area_data.items():
        area_type, area_name = area_key.split(":", 1)
        
        if area_type == "tama_city":
            output_file = os.path.join(tama_dir, f"{area_name}.csv")
        elif area_type == "nishi_tama":
            output_file = os.path.join(nishi_tama_dir, f"{area_name}.csv")
        elif area_type == "island":
            output_file = os.path.join(island_dir, f"{area_name}.csv")
        else:
            continue  # その他はスキップ
        
        # CSVファイルを出力
        with open(output_file, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            writer.writerows(rows)
        
        print(f"  {area_name}: {len(rows)}件 -> {output_file}")

def create_tama_integrated_files(base_output_dir):
    """多摩地域の統合ファイルを作成"""
    print("\n=== 多摩地域統合ファイル作成 ===")
    
    tama_dir = os.path.join(base_output_dir, 'tama_cities')
    nishi_tama_dir = os.path.join(base_output_dir, 'nishi_tama')
    island_dir = os.path.join(base_output_dir, 'islands')
    
    # 1. 多摩地域主要市の統合ファイル
    major_cities = ["八王子市", "立川市", "武蔵野市", "三鷹市", "府中市", "調布市", "町田市", "小金井市"]
    integrated_tama_data = []
    headers = None
    
    for city in major_cities:
        city_file = os.path.join(tama_dir, f"{city}.csv")
        if os.path.exists(city_file):
            with open(city_file, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                if headers is None:
                    headers = reader.fieldnames
                integrated_tama_data.extend(list(reader))
    
    if integrated_tama_data and headers:
        output_file = os.path.join(base_output_dir, 'lightweight', 'tama_major_cities.csv')
        with open(output_file, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            writer.writerows(integrated_tama_data)
        print(f"  多摩主要市統合: {len(integrated_tama_data)}件 -> {output_file}")
    
    # 2. 島嶼部統合ファイル
    island_data = []
    for island_file in os.listdir(island_dir):
        if island_file.endswith('.csv'):
            with open(os.path.join(island_dir, island_file), 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                if headers is None:
                    headers = reader.fieldnames
                island_data.extend(list(reader))
    
    if island_data and headers:
        output_file = os.path.join(base_output_dir, 'lightweight', 'islands_integrated.csv')
        with open(output_file, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            writer.writerows(island_data)
        print(f"  島嶼部統合: {len(island_data)}件 -> {output_file}")
    
    # 3. 西多摩郡統合ファイル
    nishi_tama_data = []
    for town_file in os.listdir(nishi_tama_dir):
        if town_file.endswith('.csv'):
            with open(os.path.join(nishi_tama_dir, town_file), 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                if headers is None:
                    headers = reader.fieldnames
                nishi_tama_data.extend(list(reader))
    
    if nishi_tama_data and headers:
        output_file = os.path.join(base_output_dir, 'lightweight', 'nishi_tama_integrated.csv')
        with open(output_file, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            writer.writerows(nishi_tama_data)
        print(f"  西多摩郡統合: {len(nishi_tama_data)}件 -> {output_file}")

def main():
    # データ分割処理
    print("=== 公共施設データの分割 ===")
    split_tama_data('data/barrier_free_toilets.csv', 'data')
    
    print("\n=== 駅データの分割 ===")
    split_tama_data('data/station_barrier_free_toilets.csv', 'data')
    
    # 統合ファイル作成
    create_tama_integrated_files('data')
    
    # ファイルサイズ確認
    print("\n=== 生成ファイルのサイズ確認 ===")
    for root, dirs, files in os.walk('data'):
        for file in files:
            if file.endswith('.csv') and ('tama' in root or 'island' in root or 'nishi' in root):
                file_path = os.path.join(root, file)
                size = os.path.getsize(file_path)
                print(f"{file_path}: {size/1024:.1f}KB")

if __name__ == "__main__":
    main()