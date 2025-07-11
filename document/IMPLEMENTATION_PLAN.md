# 地域別データ読み込み機能 実装計画

## 概要
東京都のバリアフリートイレデータを市区町村別に分割されたCSVファイルから効率的に読み込む機能を実装する。

## 現状分析

### 現在の動作
- **統合ファイル使用**: `data/barrier_free_toilets.csv` と `data/station_barrier_free_toilets.csv` の2つの大きな統合ファイルを使用
- **データ読み込み**: 「トイレを表示」ボタンで統合ファイル全体を読み込み、現在位置から500m以内をフィルタリング
- **パフォーマンス**: 大きなファイルの読み込みにより初回表示が遅い

### 問題点
1. **読み込み時間**: 統合ファイルのサイズが大きく、読み込みに時間がかかる
2. **効率性**: 現在位置から遠い地域のデータも読み込んでいる
3. **ネットワーク負荷**: 不要なデータの転送によるネットワーク負荷
4. **未活用**: 地域別データの読み込み機能が `utils.js` に実装されているが使用されていない

## 新しいデータ構造

### 分割データの構造
```
data/
├── tokyo/
│   ├── 23ku/              # 東京23区
│   │   ├── chiyoda_ku.csv
│   │   ├── shibuya_ku.csv
│   │   └── ...
│   ├── tama/              # 多摩地域
│   │   ├── tachikawa_shi.csv
│   │   ├── fuchu_shi.csv
│   │   └── ...
│   └── islands/           # 島嶼部
│       ├── oshima_machi.csv
│       └── ...
├── tokyo_station/         # 駅のバリアフリートイレ
│   ├── 23ku/
│   ├── tama/
│   └── islands/
└── [統合ファイル]         # フォールバック用
    ├── barrier_free_toilets.csv
    └── station_barrier_free_toilets.csv
```

### CSVファイル形式
```csv
name,address,floor,toilet_name,note,color,lng,lat
施設名,住所,階数,トイレ名,備考,色,経度,緯度
```

## 実装手順

### Phase 1: ファイルパス修正
1. **utils.js の修正**
   - `loadAreaCSV` 関数のファイルパスを実際のディレクトリ構造に合わせて修正
   - `data/tokyo/23ku/`, `data/tokyo/tama/`, `data/tokyo/islands/` 対応
   - `data/tokyo_station/` 対応

2. **パス設定の確認**
   ```javascript
   // 修正前
   const baseDir = type === 'public' ? 'data/wards' : 'data/station_wards';
   
   // 修正後
   const baseDir = type === 'public' ? 'data/tokyo' : 'data/tokyo_station';
   ```

### Phase 2: PinService の更新
1. **loadAllNearbyData メソッドの修正**
   - 統合ファイルではなく地域別データを使用
   - `loadNearbyData` 関数（utils.js）を活用
   - 現在位置から最も近い地域を特定

2. **フォールバック機能の実装**
   - 地域別ファイルが見つからない場合の統合ファイルへのフォールバック
   - エラーハンドリングの強化

### Phase 3: UI改善
1. **地域表示機能**
   - 現在の推定地域名を表示
   - 読み込み中の地域名を表示

2. **地域選択機能（オプション）**
   - 地域選択ドロップダウンの追加
   - 手動で地域を選択してデータを読み込む機能

3. **統合データとの切り替え**
   - 地域別データと統合データの切り替えオプション
   - 設定項目として追加

### Phase 4: パフォーマンス最適化
1. **段階的読み込み**
   - 主要地域のデータを最初に読み込み
   - 不足の場合に隣接地域のデータを補完

2. **キャッシュ機能**
   - 読み込み済みの地域データをキャッシュ
   - 地図移動時の高速表示

3. **プリロード機能**
   - 現在位置周辺の地域データを事前読み込み

## 技術仕様

### 地域判定ロジック
```javascript
// 現在位置から最も近い地域を判定
const areaInfo = estimateAreaFromCoordinates(lat, lng);
const { area, type } = areaInfo;

// type: 'ward' | 'city' | 'town' | 'island'
// area: '千代田区' | '立川市' | '瑞穂町' | '大島町'
```

### データ読み込み順序
1. **主要地域**: 現在位置に最も近い地域のデータを読み込み
2. **隣接地域**: データが不足の場合、隣接地域のデータを読み込み
3. **統合ファイル**: 地域別ファイルが見つからない場合のフォールバック

### ファイル命名規則
- **23区**: `{区名}_ku.csv` (例: `chiyoda_ku.csv`)
- **多摩市**: `{市名}_shi.csv` (例: `tachikawa_shi.csv`)
- **町村**: `{町村名}_machi.csv` または `{町村名}_mura.csv`
- **島嶼**: `{島名}_machi.csv` または `{島名}_mura.csv`

## UI改善案

### 1. 地域表示パネル
```html
<div class="area-info-panel">
  <span id="current-area">現在地: 千代田区</span>
  <span id="loading-area" style="display:none">読み込み中: 千代田区...</span>
</div>
```

### 2. 地域選択ドロップダウン
```html
<div class="area-selector">
  <label>地域を選択:</label>
  <select id="area-select">
    <option value="auto">自動選択</option>
    <optgroup label="23区">
      <option value="chiyoda_ku">千代田区</option>
      <option value="shibuya_ku">渋谷区</option>
      <!-- ... -->
    </optgroup>
    <optgroup label="多摩地域">
      <option value="tachikawa_shi">立川市</option>
      <!-- ... -->
    </optgroup>
  </select>
</div>
```

### 3. データソース切り替え
```html
<div class="data-source-toggle">
  <label>
    <input type="radio" name="data-source" value="regional" checked>
    地域別データ（高速）
  </label>
  <label>
    <input type="radio" name="data-source" value="integrated">
    統合データ（全域）
  </label>
</div>
```

## エラーハンドリング

### 1. ファイル未発見エラー
```javascript
try {
  const regionalData = await loadAreaCSV(area, areaType);
  if (regionalData.length === 0) {
    // 統合ファイルにフォールバック
    return await loadIntegratedData();
  }
  return regionalData;
} catch (error) {
  console.warn(`Regional data not found for ${area}, falling back to integrated data`);
  return await loadIntegratedData();
}
```

### 2. ネットワークエラー
```javascript
const MAX_RETRIES = 3;
let retryCount = 0;

const loadWithRetry = async (url) => {
  try {
    return await fetch(url);
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      retryCount++;
      console.log(`Retrying ${url} (${retryCount}/${MAX_RETRIES})`);
      return await loadWithRetry(url);
    }
    throw error;
  }
};
```

## パフォーマンス改善

### 1. 読み込み時間の比較
- **統合ファイル**: 約2-3秒（全データ読み込み）
- **地域別ファイル**: 約0.5-1秒（該当地域のみ）
- **改善率**: 約50-70%の高速化

### 2. ネットワーク負荷の軽減
- **統合ファイル**: 約1-2MB
- **地域別ファイル**: 約10-100KB
- **削減率**: 約90-95%の通信量削減

### 3. メモリ使用量の最適化
- 必要な地域のデータのみをメモリに保持
- 不要なデータの早期ガベージコレクション

## テスト計画

### 1. 機能テスト
- [ ] 各地域でのデータ読み込みテスト
- [ ] 地域境界での動作テスト
- [ ] 隣接地域データの補完テスト
- [ ] フォールバック機能の動作確認

### 2. パフォーマンステスト
- [ ] 読み込み時間の測定
- [ ] ネットワーク負荷の測定
- [ ] メモリ使用量の監視
- [ ] 統合ファイルとの比較

### 3. エラーテスト
- [ ] 存在しないファイルへのアクセス
- [ ] ネットワークエラー時の挙動
- [ ] 不正なCSVファイルの処理
- [ ] 空のCSVファイルの処理

### 4. ユーザビリティテスト
- [ ] 地域選択機能の使いやすさ
- [ ] 現在地域の表示の分かりやすさ
- [ ] エラーメッセージの適切性

## 実装の優先順位

### 高優先度
1. **ファイルパス修正** - 既存機能の動作確認
2. **PinService更新** - 地域別データの活用
3. **基本的なエラーハンドリング** - フォールバック機能

### 中優先度
1. **地域表示機能** - ユーザビリティの向上
2. **パフォーマンス最適化** - キャッシュ機能
3. **隣接地域データの補完** - データ不足時の対応

### 低優先度
1. **地域選択UI** - 手動選択機能
2. **データソース切り替え** - 統合データとの切り替え
3. **高度なプリロード機能** - 事前読み込み

## 期待される効果

### 1. パフォーマンス向上
- 初回表示時間の短縮（50-70%改善）
- ネットワーク負荷の軽減（90-95%削減）
- メモリ使用量の最適化

### 2. ユーザビリティ向上
- 現在地域の明確な表示
- より高速なデータ表示
- 地域選択による柔軟な操作

### 3. 拡張性向上
- 新しい地域データの追加が容易
- 他の都道府県データの統合が可能
- 地域別の詳細設定が可能

## 今後の拡張可能性

### 1. 他地域への対応
- 神奈川県、埼玉県、千葉県のデータ統合
- 全国展開への基盤構築

### 2. 高度な機能
- 地域別のデータ更新頻度の設定
- 地域別の表示カスタマイズ
- 地域統計情報の表示

### 3. オフライン対応
- 地域別データのローカルキャッシュ
- オフライン時の地域データ利用
- サービスワーカーによる事前読み込み