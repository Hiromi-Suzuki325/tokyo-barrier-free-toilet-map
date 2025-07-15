/**
 * 距離計算・データ処理などのユーティリティ関数
 */

/**
 * Haversine公式を使用して2点間の距離を計算（メートル単位）
 * @param {number} lat1 - 地点1の緯度
 * @param {number} lng1 - 地点1の経度
 * @param {number} lat2 - 地点2の緯度
 * @param {number} lng2 - 地点2の経度
 * @returns {number} 距離（メートル）
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // 地球の半径（メートル）
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

/**
 * CSVテキストをパースして配列に変換
 * @param {string} csvText - CSVテキスト
 * @returns {Array} パースされたデータ配列
 */
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  const headers = parseCSVLine(lines[0]);
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    // noteフィールドの処理：パイプ文字で分割して説明と設備を分離
    if (row.note && row.note.includes('|')) {
      const noteParts = row.note.split('|').map(part => part.trim());
      row.description = noteParts[0] || '';
      row.equipment = noteParts[1] || '';
      
      // 設備リストから「設備:」プレフィックスを除去
      if (row.equipment.startsWith('設備:')) {
        row.equipment = row.equipment.substring(3).trim();
      }
    } else {
      // パイプ文字がない場合は、noteの内容を判定
      if (row.note && row.note.startsWith('設備:')) {
        row.description = '';
        row.equipment = row.note.substring(3).trim();
      } else {
        row.description = row.note || '';
        row.equipment = '';
      }
    }
    
    // 必須フィールドのチェック
    if (row.name && row.lat && row.lng) {
      row.lat = parseFloat(row.lat);
      row.lng = parseFloat(row.lng);
      
      // 座標が有効な数値かチェック
      if (!isNaN(row.lat) && !isNaN(row.lng)) {
        data.push(row);
      }
    }
  }
  
  return data;
}

/**
 * CSVの1行を適切にパースする（クォート内のカンマを考慮）
 * @param {string} line - CSVの1行
 * @returns {Array} パースされた値の配列
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

/**
 * 中心点から指定半径内のデータを取得
 * @param {Array} data - データ配列
 * @param {number} centerLat - 中心点の緯度
 * @param {number} centerLng - 中心点の経度
 * @param {number} radius - 検索半径（メートル）
 * @param {number} maxCount - 最大取得件数
 * @returns {Array} 範囲内のデータ配列（距離順）
 */
function filterDataByDistance(data, centerLat, centerLng, radius = 1000, maxCount = 50) {
  const results = [];
  
  for (const item of data) {
    const distance = calculateDistance(centerLat, centerLng, item.lat, item.lng);
    
    if (distance <= radius) {
      results.push({
        ...item,
        distance: distance
      });
    }
  }
  
  // 距離順にソート
  results.sort((a, b) => a.distance - b.distance);
  
  // 最大件数で制限
  return results.slice(0, maxCount);
}

/**
 * 距離を人間が読みやすい形式に変換
 * @param {number} distance - 距離（メートル）
 * @returns {string} フォーマットされた距離文字列
 */
function formatDistance(distance) {
  if (distance < 1000) {
    return `${Math.round(distance)}m`;
  } else {
    return `${(distance / 1000).toFixed(1)}km`;
  }
}

/**
 * 東京23区のリスト
 */
const TOKYO_WARDS = [
  "千代田区", "中央区", "港区", "新宿区", "文京区", "台東区", "墨田区", "江東区",
  "品川区", "目黒区", "大田区", "世田谷区", "渋谷区", "中野区", "杉並区", "豊島区",
  "北区", "荒川区", "板橋区", "練馬区", "足立区", "葛飾区", "江戸川区"
];

/**
 * 座標から近隣の地域（区/市）を推定
 * @param {number} lat - 緯度
 * @param {number} lng - 経度
 * @returns {Object} {area: 地域名, type: 'ward'|'city'|'town'|'island'}
 */
function estimateAreaFromCoordinates(lat, lng) {
  // 東京23区の座標
  const wardCoords = {
    "千代田区": [35.6895, 139.7530],
    "中央区": [35.6735, 139.7705],
    "港区": [35.6580, 139.7510],
    "新宿区": [35.6940, 139.7030],
    "文京区": [35.7080, 139.7520],
    "台東区": [35.7125, 139.7810],
    "墨田区": [35.7100, 139.8015],
    "江東区": [35.6720, 139.8170],
    "品川区": [35.6090, 139.7305],
    "目黒区": [35.6340, 139.6985],
    "大田区": [35.5610, 139.7160],
    "世田谷区": [35.6465, 139.6530],
    "渋谷区": [35.6580, 139.7015],
    "中野区": [35.7065, 139.6655],
    "杉並区": [35.6995, 139.6365],
    "豊島区": [35.7295, 139.7160],
    "北区": [35.7535, 139.7340],
    "荒川区": [35.7360, 139.7830],
    "板橋区": [35.7510, 139.6940],
    "練馬区": [35.7355, 139.6520],
    "足立区": [35.7750, 139.8045],
    "葛飾区": [35.7440, 139.8485],
    "江戸川区": [35.7065, 139.8685]
  };
  
  // 多摩地域の市の座標
  const cityCoords = {
    "八王子市": [35.6560, 139.3238],
    "立川市": [35.6939, 139.4075],
    "武蔵野市": [35.7180, 139.5648],
    "三鷹市": [35.6836, 139.5596],
    "青梅市": [35.7880, 139.2755],
    "府中市": [35.6697, 139.4773],
    "昭島市": [35.7063, 139.3536],
    "調布市": [35.6516, 139.5441],
    "町田市": [35.5484, 139.4277],
    "小金井市": [35.6995, 139.5037],
    "小平市": [35.7284, 139.4778],
    "日野市": [35.6710, 139.3968],
    "東村山市": [35.7541, 139.4684],
    "国分寺市": [35.7014, 139.4625],
    "国立市": [35.6840, 139.4415],
    "福生市": [35.7380, 139.3280],
    "狛江市": [35.6363, 139.5783],
    "東大和市": [35.7451, 139.4258],
    "清瀬市": [35.7854, 139.5264],
    "東久留米市": [35.7587, 139.5298],
    "武蔵村山市": [35.7545, 139.3876],
    "多摩市": [35.6368, 139.4468],
    "稲城市": [35.6384, 139.5048],
    "羽村市": [35.7672, 139.3128],
    "あきる野市": [35.7294, 139.2947],
    "西東京市": [35.7254, 139.5384]
  };
  
  // 西多摩郡の座標
  const townCoords = {
    "瑞穂町": [35.7569, 139.3649],
    "日の出町": [35.7406, 139.2676],
    "檜原村": [35.7298, 139.1469],
    "奥多摩町": [35.8058, 139.0964]
  };
  
  // 島嶼部の座標（代表的な島）
  const islandCoords = {
    "大島町": [34.7500, 139.3601],
    "八丈町": [33.1100, 139.7889],
    "小笠原村": [27.0953, 142.1918]
  };
  
  let closestArea = "千代田区";
  let closestType = "ward";
  let minDistance = Infinity;
  
  // 23区をチェック
  for (const [area, coords] of Object.entries(wardCoords)) {
    const distance = calculateDistance(lat, lng, coords[0], coords[1]);
    if (distance < minDistance) {
      minDistance = distance;
      closestArea = area;
      closestType = "ward";
    }
  }
  
  // 多摩地域の市をチェック
  for (const [area, coords] of Object.entries(cityCoords)) {
    const distance = calculateDistance(lat, lng, coords[0], coords[1]);
    if (distance < minDistance) {
      minDistance = distance;
      closestArea = area;
      closestType = "city";
    }
  }
  
  // 西多摩郡をチェック
  for (const [area, coords] of Object.entries(townCoords)) {
    const distance = calculateDistance(lat, lng, coords[0], coords[1]);
    if (distance < minDistance) {
      minDistance = distance;
      closestArea = area;
      closestType = "town";
    }
  }
  
  // 島嶼部をチェック
  for (const [area, coords] of Object.entries(islandCoords)) {
    const distance = calculateDistance(lat, lng, coords[0], coords[1]);
    if (distance < minDistance) {
      minDistance = distance;
      closestArea = area;
      closestType = "island";
    }
  }
  
  return { area: closestArea, type: closestType };
}

/**
 * 後方互換性のための関数（既存コードとの互換性維持）
 * @param {number} lat - 緯度
 * @param {number} lng - 経度
 * @returns {string} 推定される区名
 */
function estimateWardFromCoordinates(lat, lng) {
  const result = estimateAreaFromCoordinates(lat, lng);
  return result.area;
}

/**
 * 地域名をファイル名に変換
 * @param {string} areaName - 地域名
 * @param {string} areaType - 地域タイプ ('ward'|'city'|'town'|'island')
 * @returns {string} ファイル名
 */
function convertAreaNameToFileName(areaName, areaType) {
  // 区名変換マップ
  const wardNameMap = {
    "千代田区": "chiyoda_ku",
    "中央区": "中央_ku",
    "港区": "minato_ku", 
    "新宿区": "shinjuku_ku",
    "文京区": "文京_ku",
    "台東区": "taito_ku",
    "墨田区": "sumida_ku",
    "江東区": "koto_ku",
    "品川区": "品川_ku",
    "目黒区": "meguro_ku",
    "大田区": "ota_ku",
    "世田谷区": "setagaya_ku",
    "渋谷区": "shibuya_ku",
    "中野区": "nakano_ku",
    "杉並区": "suginami_ku",
    "豊島区": "toshima_ku",
    "北区": "kita_ku",
    "荒川区": "荒川_ku",
    "板橋区": "itabashi_ku",
    "練馬区": "nerima_ku",
    "足立区": "adachi_ku",
    "葛飾区": "葛飾_ku",
    "江戸川区": "江戸川_ku"
  };
  
  // 市名変換マップ
  const cityNameMap = {
    "八王子市": "八王子_shi",
    "立川市": "tachikawa_shi",
    "武蔵野市": "武蔵野_shi",
    "三鷹市": "三鷹_shi",
    "青梅市": "青梅_shi",
    "府中市": "府中_shi",
    "昭島市": "昭島_shi",
    "調布市": "chofu_shi",
    "町田市": "町田_shi",
    "小金井市": "koganei_shi",
    "小平市": "kodaira_shi",
    "日野市": "日野_shi",
    "東村山市": "東村山_shi",
    "国分寺市": "kokubunji_shi",
    "国立市": "国立_shi",
    "福生市": "福生_shi",
    "狛江市": "狛江_shi",
    "東大和市": "東大和_shi",
    "清瀬市": "kiyose_shi",
    "東久留米市": "東久留米_shi",
    "武蔵村山市": "武蔵村山_shi",
    "多摩市": "多摩_shi",
    "稲城市": "稲城_shi",
    "羽村市": "羽村_shi",
    "あきる野市": "あきる野_shi",
    "西東京市": "西東京_shi"
  };
  
  // 町村名変換マップ
  const townNameMap = {
    "瑞穂町": "西多摩郡瑞穂_machi",
    "日の出町": "日の出_machi",
    "檜原村": "檜原_mura",
    "奥多摩町": "西多摩郡奥多摩_machi"
  };
  
  // 島名変換マップ
  const islandNameMap = {
    "大島町": "oshima_machi",
    "八丈町": "hachijo_machi",
    "小笠原村": "ogasawara_mura"
  };
  
  switch (areaType) {
    case 'ward':
      return wardNameMap[areaName] || areaName.replace('区', '_ku');
    case 'city':
      return cityNameMap[areaName] || areaName.replace('市', '_shi');
    case 'town':
      return townNameMap[areaName] || areaName.replace(/[町村]/, match => match === '町' ? '_machi' : '_mura');
    case 'island':
      return islandNameMap[areaName] || areaName.replace(/[町村]/, match => match === '町' ? '_machi' : '_mura');
    default:
      return areaName;
  }
}

/**
 * 区別のCSVファイルを読み込み
 * @param {string} ward - 区名
 * @param {string} type - データタイプ ('public' or 'station')
 * @returns {Promise<Array>} CSVデータ
 */
async function loadWardCSV(ward, type = 'public') {
  const baseDir = type === 'public' ? 'data/tokyo/23ku' : 'data/tokyo_station/23ku';
  const fileName = convertAreaNameToFileName(ward, 'ward');
  const filePath = `${baseDir}/${fileName}.csv`;
  
  try {
    const response = await fetch(filePath);
    if (!response.ok) {
      console.warn(`CSV file not found: ${filePath}`);
      return [];
    }
    
    const csvText = await response.text();
    return parseCSV(csvText);
  } catch (error) {
    console.error(`Error loading CSV file ${filePath}:`, error);
    return [];
  }
}

/**
 * 市別のCSVファイルを読み込み
 * @param {string} city - 市名
 * @param {string} type - データタイプ ('public' or 'station')
 * @returns {Promise<Array>} CSVデータ
 */
async function loadCityCSV(city, type = 'public') {
  const baseDir = type === 'public' ? 'data/tokyo/tama' : 'data/tokyo_station/tama';
  const fileName = convertAreaNameToFileName(city, 'city');
  const filePath = `${baseDir}/${fileName}.csv`;
  
  try {
    const response = await fetch(filePath);
    if (!response.ok) {
      console.warn(`CSV file not found: ${filePath}`);
      return [];
    }
    
    const csvText = await response.text();
    return parseCSV(csvText);
  } catch (error) {
    console.error(`Error loading CSV file ${filePath}:`, error);
    return [];
  }
}

/**
 * 町村別のCSVファイルを読み込み
 * @param {string} town - 町村名
 * @param {string} type - データタイプ ('public' or 'station')
 * @returns {Promise<Array>} CSVデータ
 */
async function loadTownCSV(town, type = 'public') {
  const baseDir = type === 'public' ? 'data/tokyo/islands' : 'data/tokyo_station/islands';
  const fileName = convertAreaNameToFileName(town, 'town');
  const filePath = `${baseDir}/${fileName}.csv`;
  
  try {
    const response = await fetch(filePath);
    if (!response.ok) {
      console.warn(`CSV file not found: ${filePath}`);
      return [];
    }
    
    const csvText = await response.text();
    return parseCSV(csvText);
  } catch (error) {
    console.error(`Error loading CSV file ${filePath}:`, error);
    return [];
  }
}

/**
 * 島嶼部のCSVファイルを読み込み
 * @param {string} island - 島名
 * @param {string} type - データタイプ ('public' or 'station')
 * @returns {Promise<Array>} CSVデータ
 */
async function loadIslandCSV(island, type = 'public') {
  const baseDir = type === 'public' ? 'data/tokyo/islands' : 'data/tokyo_station/islands';
  const fileName = convertAreaNameToFileName(island, 'island');
  const filePath = `${baseDir}/${fileName}.csv`;
  
  try {
    const response = await fetch(filePath);
    if (!response.ok) {
      console.warn(`CSV file not found: ${filePath}`);
      return [];
    }
    
    const csvText = await response.text();
    return parseCSV(csvText);
  } catch (error) {
    console.error(`Error loading CSV file ${filePath}:`, error);
    return [];
  }
}

/**
 * 地域タイプに応じてCSVファイルを読み込み
 * @param {string} area - 地域名
 * @param {string} areaType - 地域タイプ ('ward'|'city'|'town'|'island')
 * @param {string} type - データタイプ ('public' or 'station')
 * @returns {Promise<Array>} CSVデータ
 */
async function loadAreaCSV(area, areaType, type = 'public') {
  switch (areaType) {
    case 'ward':
      return await loadWardCSV(area, type);
    case 'city':
      return await loadCityCSV(area, type);
    case 'town':
      return await loadTownCSV(area, type);
    case 'island':
      return await loadIslandCSV(area, type);
    default:
      console.warn(`Unknown area type: ${areaType}`);
      return [];
  }
}

/**
 * キャッシュ機能付きで地域別CSVファイルを読み込み
 * @param {string} area - 地域名
 * @param {string} areaType - 地域タイプ ('ward'|'city'|'town'|'island')
 * @param {string} type - データタイプ ('public' or 'station')
 * @param {boolean} enableCache - キャッシュを使用するか
 * @returns {Promise<Array>} CSVデータ
 */
async function loadAreaCSVWithCache(area, areaType, type = 'public', enableCache = true) {
  const cacheKey = `${area}-${areaType}-${type}`;
  
  // キャッシュからデータを確認
  if (enableCache && areaDataCache.has(cacheKey)) {
    console.log(`Cache hit for ${cacheKey}`);
    return areaDataCache.get(cacheKey);
  }
  
  // キャッシュにない場合は読み込み
  console.log(`Loading ${cacheKey} from file`);
  const data = await loadAreaCSV(area, areaType, type);
  
  // キャッシュに保存
  if (enableCache) {
    areaDataCache.set(cacheKey, data);
    console.log(`Cached ${cacheKey} with ${data.length} items`);
  }
  
  return data;
}

/**
 * プリロード機能：周辺地域のデータを事前読み込み
 * @param {number} lat - 緯度
 * @param {number} lng - 経度
 * @param {boolean} enableCache - キャッシュを使用するか
 */
async function preloadAdjacentAreas(lat, lng, enableCache = true) {
  const areaInfo = estimateAreaFromCoordinates(lat, lng);
  const { area: primaryArea, type: areaType } = areaInfo;
  
  // 既にプリロード済みの場合はスキップ
  const preloadKey = `${primaryArea}-${areaType}`;
  if (preloadQueue.has(preloadKey)) {
    return;
  }
  
  preloadQueue.add(preloadKey);
  
  // バックグラウンドで隣接地域のデータをプリロード
  setTimeout(async () => {
    try {
      const adjacentAreas = getAdjacentAreas(primaryArea, areaType);
      console.log(`Preloading ${adjacentAreas.length} adjacent areas for ${primaryArea}`);
      
      const preloadPromises = [];
      
      for (const adjArea of adjacentAreas) {
        preloadPromises.push(
          Promise.all([
            loadAreaCSVWithCache(adjArea.area, adjArea.type, 'public', enableCache),
            loadAreaCSVWithCache(adjArea.area, adjArea.type, 'station', enableCache)
          ])
        );
      }
      
      await Promise.all(preloadPromises);
      console.log(`Preloading completed for ${primaryArea}`);
      
    } catch (error) {
      console.warn(`Error preloading adjacent areas for ${primaryArea}:`, error);
    } finally {
      preloadQueue.delete(preloadKey);
    }
  }, 1000); // 1秒後に実行
}

/**
 * キャッシュをクリア
 */
function clearAreaDataCache() {
  areaDataCache.clear();
  preloadQueue.clear();
  console.log('Area data cache cleared');
}

/**
 * キャッシュの統計情報を取得
 * @returns {Object} キャッシュの統計情報
 */
function getCacheStats() {
  const stats = {
    cacheSize: areaDataCache.size,
    preloadQueueSize: preloadQueue.size,
    cachedItems: Array.from(areaDataCache.keys()),
    preloadingItems: Array.from(preloadQueue)
  };
  
  let totalItems = 0;
  for (const data of areaDataCache.values()) {
    totalItems += data.length;
  }
  stats.totalCachedItems = totalItems;
  
  return stats;
}

/**
 * 軽量版データを読み込み
 * @param {string} type - データタイプ ('public' or 'station')
 * @returns {Promise<Array>} 軽量版データ配列
 */
async function loadLightweightData(type = 'public') {
  const fileName = type === 'public' ? 'integrated_public.csv' : 'integrated_station.csv';
  const filePath = `data/lightweight/${fileName}`;
  
  try {
    const response = await fetch(filePath);
    if (!response.ok) {
      console.warn(`Lightweight CSV file not found: ${filePath}`);
      return [];
    }
    
    const csvText = await response.text();
    return parseCSV(csvText);
  } catch (error) {
    console.error(`Error loading lightweight CSV file ${filePath}:`, error);
    return [];
  }
}

// キャッシュ機能用のグローバルキャッシュ
const areaDataCache = new Map();
const preloadQueue = new Set();

/**
 * 統合ファイル優先で近隣データを読み込み（信頼性重視）
 * @param {number} lat - 緯度
 * @param {number} lng - 経度
 * @param {number} radius - 検索半径（メートル）
 * @param {number} maxCount - 最大取得件数
 * @returns {Promise<Array>} 近隣データ配列
 */
async function loadNearbyDataIntegrated(lat, lng, radius = 1000, maxCount = 50) {
  console.log('Loading integrated files (reliable approach)...');
  
  try {
    // 統合ファイルを読み込み（確実に存在）
    const [publicResponse, stationResponse] = await Promise.all([
      fetch('./data/barrier_free_toilets.csv'),
      fetch('./data/station_barrier_free_toilets.csv')
    ]);
    
    const allData = [];
    
    if (publicResponse.ok) {
      const publicCsvText = await publicResponse.text();
      const publicData = parseCSV(publicCsvText);
      allData.push(...publicData);
      console.log(`Loaded ${publicData.length} items from integrated public file`);
    }
    
    if (stationResponse.ok) {
      const stationCsvText = await stationResponse.text();
      const stationData = parseCSV(stationCsvText);
      allData.push(...stationData);
      console.log(`Loaded ${stationData.length} items from integrated station file`);
    }
    
    if (allData.length === 0) {
      throw new Error('No data loaded from integrated files');
    }
    
    // 距離でフィルタリング
    const nearbyData = filterDataByDistance(allData, lat, lng, radius, maxCount);
    console.log(`Found ${nearbyData.length} nearby items from integrated data`);
    
    return nearbyData;
    
  } catch (error) {
    console.error('Error loading integrated data:', error);
    throw error;
  }
}

/**
 * 現在位置に基づいて近隣のデータを段階的に読み込み（後方互換性用）
 * @param {number} lat - 緯度
 * @param {number} lng - 経度
 * @param {number} radius - 検索半径（メートル）
 * @param {number} maxCount - 最大取得件数
 * @param {boolean} useLightweight - 軽量版を使用するか
 * @param {boolean} enableCache - キャッシュを使用するか
 * @param {boolean} enablePreload - プリロードを実行するか
 * @returns {Promise<Array>} 近隣データ配列
 */
async function loadNearbyData(lat, lng, radius = 1000, maxCount = 50, useLightweight = true, enableCache = true, enablePreload = true) {
  let nearbyData = [];
  
  if (useLightweight) {
    // 段階1: 軽量版データから高速検索
    console.log('Loading lightweight data first...');
    const [lightweightPublic, lightweightStation] = await Promise.all([
      loadLightweightData('public'),
      loadLightweightData('station')
    ]);
    
    const lightweightData = [...lightweightPublic, ...lightweightStation];
    nearbyData = filterDataByDistance(lightweightData, lat, lng, radius, maxCount);
    
    console.log(`Found ${nearbyData.length} items from lightweight data`);
    
    // 段階2: 軽量版で十分な結果が得られない場合、区別データを読み込み
    if (nearbyData.length < Math.min(maxCount, 20)) {
      console.log('Lightweight data insufficient, loading area-specific data...');
      const areaData = await loadNearbyDataFromAreas(lat, lng, radius, maxCount, enableCache);
      
      // 軽量版のデータと統合（重複除去）
      const existingCoords = new Set(nearbyData.map(item => `${item.lat},${item.lng}`));
      const newData = areaData.filter(item => !existingCoords.has(`${item.lat},${item.lng}`));
      
      nearbyData = [...nearbyData, ...newData];
      nearbyData.sort((a, b) => a.distance - b.distance);
      nearbyData = nearbyData.slice(0, maxCount);
    }
  } else {
    // 直接地域別データを読み込み
    nearbyData = await loadNearbyDataFromAreas(lat, lng, radius, maxCount, enableCache);
  }
  
  // プリロード機能：バックグラウンドで周辺地域のデータを事前読み込み
  if (enablePreload) {
    preloadAdjacentAreas(lat, lng, enableCache);
  }
  
  return nearbyData;
}

/**
 * 地域別データから近隣のデータを読み込み（23区・多摩地域対応）
 * @param {number} lat - 緯度
 * @param {number} lng - 経度
 * @param {number} radius - 検索半径（メートル）
 * @param {number} maxCount - 最大取得件数
 * @param {boolean} enableCache - キャッシュを使用するか
 * @returns {Promise<Array>} 近隣データ配列
 */
async function loadNearbyDataFromAreas(lat, lng, radius = 1000, maxCount = 50, enableCache = true) {
  const areaInfo = estimateAreaFromCoordinates(lat, lng);
  const { area: primaryArea, type: areaType } = areaInfo;
  
  console.log(`Loading data for ${areaType}: ${primaryArea}`);
  
  // 主要な地域のデータを読み込み（キャッシュ機能付き）
  const [publicData, stationData] = await Promise.all([
    loadAreaCSVWithCache(primaryArea, areaType, 'public', enableCache),
    loadAreaCSVWithCache(primaryArea, areaType, 'station', enableCache)
  ]);
  
  // データを統合
  const primaryData = [...publicData, ...stationData];
  
  // 距離でフィルタリング
  const nearbyData = filterDataByDistance(primaryData, lat, lng, radius, maxCount);
  
  // 主要な地域のデータだけでは不足の場合、隣接地域のデータも読み込み
  if (nearbyData.length < Math.min(maxCount, 20)) {
    console.log(`Primary area data insufficient (${nearbyData.length} items), loading adjacent areas...`);
    
    const adjacentAreas = getAdjacentAreas(primaryArea, areaType);
    const loadPromises = [];
    
    // 隣接地域のデータを並列で読み込み（段階的読み込み）
    for (const adjArea of adjacentAreas) {
      if (nearbyData.length >= maxCount) break;
      
      // 隣接地域のデータも公共施設と駅の両方を読み込み（キャッシュ機能付き）
      loadPromises.push(
        Promise.all([
          loadAreaCSVWithCache(adjArea.area, adjArea.type, 'public', enableCache),
          loadAreaCSVWithCache(adjArea.area, adjArea.type, 'station', enableCache)
        ]).then(([adjPublicData, adjStationData]) => ({
          area: adjArea,
          data: [...adjPublicData, ...adjStationData]
        }))
      );
    }
    
    // 隣接地域のデータを並列で取得
    const adjacentResults = await Promise.all(loadPromises);
    
    for (const result of adjacentResults) {
      if (nearbyData.length >= maxCount) break;
      
      const adjNearbyData = filterDataByDistance(result.data, lat, lng, radius, maxCount - nearbyData.length);
      
      nearbyData.push(...adjNearbyData);
      console.log(`Loaded ${adjNearbyData.length} items from adjacent ${result.area.type}: ${result.area.area}`);
    }
    
    // 距離順で再ソート
    nearbyData.sort((a, b) => a.distance - b.distance);
  }
  
  return nearbyData.slice(0, maxCount);
}

/**
 * 区別データから近隣のデータを読み込み（後方互換性）
 * @param {number} lat - 緯度
 * @param {number} lng - 経度
 * @param {number} radius - 検索半径（メートル）
 * @param {number} maxCount - 最大取得件数
 * @returns {Promise<Array>} 近隣データ配列
 */
async function loadNearbyDataFromWards(lat, lng, radius = 1000, maxCount = 50) {
  return await loadNearbyDataFromAreas(lat, lng, radius, maxCount);
}

/**
 * 指定された地域に隣接する地域のリストを取得
 * @param {string} area - 地域名
 * @param {string} areaType - 地域タイプ
 * @returns {Array<Object>} 隣接地域のリスト {area: 地域名, type: タイプ}
 */
function getAdjacentAreas(area, areaType) {
  if (areaType === 'ward') {
    return getAdjacentWards(area).map(ward => ({ area: ward, type: 'ward' }));
  } else if (areaType === 'city') {
    return getAdjacentCities(area);
  } else if (areaType === 'town') {
    return getAdjacentTowns(area);
  } else if (areaType === 'island') {
    return getAdjacentIslands(area);
  }
  
  return [];
}

/**
 * 指定された区に隣接する区のリストを取得
 * @param {string} ward - 区名
 * @returns {Array<string>} 隣接区のリスト
 */
function getAdjacentWards(ward) {
  const adjacentMap = {
    "千代田区": ["中央区", "港区", "新宿区", "文京区", "台東区"],
    "中央区": ["千代田区", "港区", "江東区", "墨田区", "台東区"],
    "港区": ["千代田区", "中央区", "新宿区", "渋谷区", "品川区", "目黒区"],
    "新宿区": ["千代田区", "港区", "渋谷区", "中野区", "豊島区", "文京区"],
    "文京区": ["千代田区", "新宿区", "豊島区", "北区", "荒川区", "台東区"],
    "台東区": ["千代田区", "中央区", "文京区", "荒川区", "墨田区"],
    "墨田区": ["中央区", "台東区", "荒川区", "足立区", "葛飾区", "江東区"],
    "江東区": ["中央区", "墨田区", "江戸川区"],
    "品川区": ["港区", "目黒区", "大田区"],
    "目黒区": ["港区", "渋谷区", "世田谷区", "大田区", "品川区"],
    "大田区": ["品川区", "目黒区", "世田谷区"],
    "世田谷区": ["渋谷区", "目黒区", "大田区", "杉並区"],
    "渋谷区": ["港区", "新宿区", "世田谷区", "目黒区", "中野区"],
    "中野区": ["新宿区", "渋谷区", "杉並区", "豊島区"],
    "杉並区": ["世田谷区", "中野区", "練馬区"],
    "豊島区": ["新宿区", "文京区", "中野区", "北区", "板橋区"],
    "北区": ["文京区", "荒川区", "足立区", "板橋区", "豊島区"],
    "荒川区": ["文京区", "台東区", "墨田区", "足立区", "北区"],
    "板橋区": ["豊島区", "北区", "足立区", "練馬区"],
    "練馬区": ["杉並区", "中野区", "豊島区", "板橋区"],
    "足立区": ["北区", "荒川区", "墨田区", "葛飾区", "板橋区"],
    "葛飾区": ["墨田区", "足立区", "江戸川区"],
    "江戸川区": ["江東区", "葛飾区"]
  };
  
  return adjacentMap[ward] || [];
}

/**
 * 指定された市に隣接する地域のリストを取得
 * @param {string} city - 市名
 * @returns {Array<Object>} 隣接地域のリスト
 */
function getAdjacentCities(city) {
  const adjacentMap = {
    "八王子市": [
      { area: "日野市", type: "city" },
      { area: "多摩市", type: "city" },
      { area: "町田市", type: "city" },
      { area: "あきる野市", type: "city" }
    ],
    "立川市": [
      { area: "昭島市", type: "city" },
      { area: "国分寺市", type: "city" },
      { area: "国立市", type: "city" },
      { area: "東大和市", type: "city" }
    ],
    "武蔵野市": [
      { area: "三鷹市", type: "city" },
      { area: "小金井市", type: "city" },
      { area: "西東京市", type: "city" },
      { area: "杉並区", type: "ward" }
    ],
    "三鷹市": [
      { area: "武蔵野市", type: "city" },
      { area: "調布市", type: "city" },
      { area: "小金井市", type: "city" },
      { area: "世田谷区", type: "ward" }
    ],
    "調布市": [
      { area: "三鷹市", type: "city" },
      { area: "府中市", type: "city" },
      { area: "狛江市", type: "city" },
      { area: "世田谷区", type: "ward" }
    ],
    "町田市": [
      { area: "八王子市", type: "city" },
      { area: "多摩市", type: "city" },
      { area: "稲城市", type: "city" }
    ],
    "府中市": [
      { area: "調布市", type: "city" },
      { area: "国分寺市", type: "city" },
      { area: "国立市", type: "city" },
      { area: "日野市", type: "city" }
    ],
    "小金井市": [
      { area: "武蔵野市", type: "city" },
      { area: "三鷹市", type: "city" },
      { area: "小平市", type: "city" },
      { area: "国分寺市", type: "city" }
    ]
    // 他の市の隣接関係も必要に応じて追加
  };
  
  return adjacentMap[city] || [];
}

/**
 * 指定された町村に隣接する地域のリストを取得
 * @param {string} town - 町村名
 * @returns {Array<Object>} 隣接地域のリスト
 */
function getAdjacentTowns(town) {
  const adjacentMap = {
    "瑞穂町": [
      { area: "福生市", type: "city" },
      { area: "羽村市", type: "city" },
      { area: "武蔵村山市", type: "city" }
    ],
    "日の出町": [
      { area: "あきる野市", type: "city" },
      { area: "檜原村", type: "town" }
    ],
    "檜原村": [
      { area: "日の出町", type: "town" },
      { area: "奥多摩町", type: "town" }
    ],
    "奥多摩町": [
      { area: "檜原村", type: "town" },
      { area: "青梅市", type: "city" }
    ]
  };
  
  return adjacentMap[town] || [];
}

/**
 * 指定された島に隣接する島のリストを取得
 * @param {string} island - 島名
 * @returns {Array<Object>} 隣接島のリスト
 */
function getAdjacentIslands(island) {
  // 島嶼部は地理的に離れているため、統合ファイルを使用
  const adjacentMap = {
    "大島町": [
      { area: "新島村", type: "island" },
      { area: "三宅村", type: "island" }
    ],
    "八丈町": [
      { area: "三宅村", type: "island" }
    ]
    // 島嶼部は距離が離れているため、隣接の概念は限定的
  };
  
  return adjacentMap[island] || [];
}

export {
  calculateDistance,
  parseCSV,
  filterDataByDistance,
  formatDistance,
  loadNearbyData,
  loadNearbyDataIntegrated,
  estimateWardFromCoordinates,
  estimateAreaFromCoordinates,
  loadAreaCSV,
  loadAreaCSVWithCache,
  preloadAdjacentAreas,
  clearAreaDataCache,
  getCacheStats
};