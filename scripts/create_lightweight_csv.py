#!/usr/bin/env python3
"""
山手線内の主要エリアの軽量版CSVを作成するスクリプト
"""
import csv
import os
from collections import defaultdict

# 山手線内の主要区（高頻度アクセス想定）
YAMANOTE_INNER_WARDS = [
    "千代田区", "中央区", "港区", "新宿区", "文京区", "台東区", "墨田区", "江東区",
    "品川区", "目黒区", "渋谷区", "豊島区"
]

def create_lightweight_csv(input_file, output_file, target_wards):
    """指定された区のデータのみを抽出して軽量版CSVを作成"""
    extracted_data = []
    
    with open(input_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames
        
        for row in reader:
            # 住所から区を判定
            ward = None
            for target_ward in target_wards:
                if target_ward in row['address']:
                    ward = target_ward
                    break
            
            if ward:
                extracted_data.append(row)
    
    # 出力ファイルに書き込み
    with open(output_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        writer.writerows(extracted_data)
    
    return len(extracted_data)

def create_priority_csv(input_file, output_file, max_items=1000):
    """優先度の高いデータのみを抽出（距離・アクセス頻度ベース）"""
    priority_data = []
    
    with open(input_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames
        
        for row in reader:
            # 優先度判定（駅、主要施設、アクセス頻度の高い区）
            priority_score = 0
            
            # 駅関連は高優先度
            if '駅' in row['name'] or 'Station' in row['name']:
                priority_score += 100
            
            # 主要区は高優先度
            for ward in YAMANOTE_INNER_WARDS:
                if ward in row['address']:
                    priority_score += 50
                    break
            
            # 公共施設は中優先度
            if any(keyword in row['name'] for keyword in ['庁舎', '図書館', '病院', '公園', '文化']):
                priority_score += 30
            
            # アクセス性の高い施設
            if any(keyword in row['name'] for keyword in ['東京', '新宿', '渋谷', '池袋', '上野', '品川']):
                priority_score += 20
            
            if priority_score > 0:
                priority_data.append((priority_score, row))
    
    # 優先度順にソート
    priority_data.sort(key=lambda x: x[0], reverse=True)
    
    # 上位のデータのみ抽出
    selected_data = [row for score, row in priority_data[:max_items]]
    
    # 出力ファイルに書き込み
    with open(output_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        writer.writerows(selected_data)
    
    return len(selected_data)

def main():
    # 出力ディレクトリを作成
    os.makedirs('data/lightweight', exist_ok=True)
    
    # 1. 山手線内主要区の軽量版
    print("Creating Yamanote inner area lightweight CSV...")
    count1 = create_lightweight_csv(
        'data/barrier_free_toilets.csv',
        'data/lightweight/yamanote_inner_public.csv',
        YAMANOTE_INNER_WARDS
    )
    
    count2 = create_lightweight_csv(
        'data/station_barrier_free_toilets.csv',
        'data/lightweight/yamanote_inner_station.csv',
        YAMANOTE_INNER_WARDS
    )
    
    print(f"Yamanote inner public facilities: {count1}件")
    print(f"Yamanote inner station facilities: {count2}件")
    
    # 2. 優先度ベースの軽量版（全体から高優先度のみ抽出）
    print("\nCreating priority-based lightweight CSV...")
    count3 = create_priority_csv(
        'data/barrier_free_toilets.csv',
        'data/lightweight/priority_public.csv',
        max_items=1000
    )
    
    count4 = create_priority_csv(
        'data/station_barrier_free_toilets.csv',
        'data/lightweight/priority_station.csv',
        max_items=500
    )
    
    print(f"Priority public facilities: {count3}件")
    print(f"Priority station facilities: {count4}件")
    
    # 3. 統合軽量版（山手線内 + 優先度）
    print("\nCreating integrated lightweight CSV...")
    
    # 山手線内データと優先度データを統合
    integrated_public = []
    integrated_station = []
    
    # 山手線内データを読み込み
    for file_path, target_list in [
        ('data/lightweight/yamanote_inner_public.csv', integrated_public),
        ('data/lightweight/yamanote_inner_station.csv', integrated_station),
        ('data/lightweight/priority_public.csv', integrated_public),
        ('data/lightweight/priority_station.csv', integrated_station)
    ]:
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # 重複チェック（座標ベース）
                is_duplicate = False
                for existing_row in target_list:
                    if (abs(float(existing_row['lat']) - float(row['lat'])) < 0.0001 and 
                        abs(float(existing_row['lng']) - float(row['lng'])) < 0.0001):
                        is_duplicate = True
                        break
                
                if not is_duplicate:
                    target_list.append(row)
    
    # 統合データを出力
    with open('data/lightweight/integrated_public.csv', 'w', encoding='utf-8', newline='') as f:
        if integrated_public:
            writer = csv.DictWriter(f, fieldnames=integrated_public[0].keys())
            writer.writeheader()
            writer.writerows(integrated_public)
    
    with open('data/lightweight/integrated_station.csv', 'w', encoding='utf-8', newline='') as f:
        if integrated_station:
            writer = csv.DictWriter(f, fieldnames=integrated_station[0].keys())
            writer.writeheader()
            writer.writerows(integrated_station)
    
    print(f"Integrated public facilities: {len(integrated_public)}件")
    print(f"Integrated station facilities: {len(integrated_station)}件")
    
    # ファイルサイズを確認
    print("\nFile sizes:")
    for file_path in [
        'data/lightweight/yamanote_inner_public.csv',
        'data/lightweight/yamanote_inner_station.csv',
        'data/lightweight/priority_public.csv',
        'data/lightweight/priority_station.csv',
        'data/lightweight/integrated_public.csv',
        'data/lightweight/integrated_station.csv'
    ]:
        if os.path.exists(file_path):
            size = os.path.getsize(file_path)
            print(f"{file_path}: {size/1024:.1f}KB")

if __name__ == "__main__":
    main()