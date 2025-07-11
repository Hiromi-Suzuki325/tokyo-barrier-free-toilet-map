import CONFIG from './config.js';
import { parseCSV, filterDataByDistance, formatDistance, loadNearbyData, estimateAreaFromCoordinates } from './utils.js';

class PinService {
  constructor(map) {
    this.map = map;
    this.pins = []; // 後方互換性のため保持
    this.personalPins = []; // 個人ピン（常に表示）
    this.facilityPins = []; // 施設データピン（一度非表示になったらボタンを押すまで非表示のまま）
    this.pinCounter = 0;
    this.init();
  }

  // ==========================================
  // 定数定義
  // ==========================================
  static CONSTANTS = {
    SEARCH_RADIUS: 500,
    MAX_RESULTS: 50,
    DUPLICATE_TOLERANCE: 0.0001,
    DATA_TYPE_LABELS: {
      toilets: 'トイレ',
      stations: '駅',
      facilities: '施設',
      barrier_free_toilets: 'バリアフリートイレ',
      station_barrier_free_toilets: '駅バリアフリートイレ'
    },
    DATA_TYPE_COLORS: {
      toilets: '#00cc00',
      stations: '#0066cc',
      facilities: '#ff6600',
      barrier_free_toilets: '#cc00cc',
      station_barrier_free_toilets: '#0099cc'
    },
    AREA_TYPE_LABELS: {
      'ward': '区',
      'city': '市',
      'town': '町村',
      'island': '島'
    }
  };

  // ==========================================
  // 初期化メソッド
  // ==========================================
  init() {
    this.setupEventListeners();
    this.setupMapEventListeners();
    this.loadPinsFromLocalStorage();
  }

  setupEventListeners() {
    // 近くのデータ表示ボタン（統合）
    document.getElementById('load-all-nearby-data').addEventListener('click', () => this.loadAllNearbyData());
  }

  setupMapEventListeners() {
    // 地図の移動・ズーム完了時に施設データピンの表示を更新
    this.map.on('moveend', () => this.updateFacilityPinsVisibility());
    this.map.on('zoomend', () => this.updateFacilityPinsVisibility());
  }

  // ==========================================
  // ピン管理メソッド
  // ==========================================
  addPin(lng, lat, name = null, color = null, note = null, skipDuplicateCheck = false, pinType = 'personal') {
    const id = ++this.pinCounter;
    const pinName = name || `ピン${id}`;
    const pinColor = color || CONFIG.MARKER_COLORS.pin;
    const pinNote = note || '';
    
    // 重複チェック（スキップ指定がない場合のみ）
    if (!skipDuplicateCheck && this.isDuplicatePin(lng, lat, pinName)) {
      return null;
    }
    
    const marker = new maplibregl.Marker({
      color: pinColor
    })
      .setLngLat([lng, lat])
      .addTo(this.map);

    const popup = new maplibregl.Popup({
      offset: CONFIG.POPUP_OFFSET,
      closeButton: true,
      closeOnClick: false
    }).setHTML(`
      <div style="padding: 10px;">
        <strong>${pinName}</strong><br>
        緯度: ${lat.toFixed(6)}<br>
        経度: ${lng.toFixed(6)}<br>
        ${pinNote ? `<div style="margin: 5px 0; padding: 5px; background: #f8f9fa; border-radius: 3px; font-size: 12px; line-height: 1.4;">${pinNote}</div>` : ''}
      </div>
    `);

    marker.setPopup(popup);

    // マーカーのクリックイベントを明示的に設定
    marker.getElement().addEventListener('click', (e) => {
      e.stopPropagation();
      // 他のすべてのポップアップを閉じてから、このピンのポップアップを開く
      this.closeAllPopups();
      marker.getPopup().setLngLat([lng, lat]).addTo(this.map);
    });

    const pin = {
      id: id,
      lat: lat,
      lng: lng,
      name: pinName,
      color: pinColor,
      note: pinNote,
      marker: marker,
      pinType: pinType,
      isVisible: true // 表示状態を管理（施設データピン用）
    };

    // ピンタイプに応じて適切な配列に追加
    if (pinType === 'personal') {
      this.personalPins.push(pin);
    } else if (pinType === 'facility') {
      this.facilityPins.push(pin);
    }
    
    // 後方互換性のため既存の pins 配列にも追加
    this.pins.push(pin);
    
    // 個人ピンのみ localStorage に保存
    if (pinType === 'personal') {
      this.savePinsToLocalStorage();
    }
    
    return pin;
  }

  // すべてのポップアップを閉じる
  closeAllPopups() {
    this.pins.forEach(pin => {
      if (pin.marker.getPopup() && pin.marker.getPopup().isOpen()) {
        pin.marker.getPopup().remove();
      }
    });
  }

  clearAllPins() {
    if (this.pins.length === 0) {
      alert('削除するピンがありません。');
      return;
    }
    
    if (confirm(`${this.pins.length}個のピンを削除しますか？`)) {
      this.pins.forEach(pin => pin.marker.remove());
      this.pins = [];
      this.personalPins = [];
      this.facilityPins = [];
      this.savePinsToLocalStorage();
    }
  }

  // 重複ピンをチェック（座標とタイプで判定）
  isDuplicatePin(lng, lat, name, tolerance = PinService.CONSTANTS.DUPLICATE_TOLERANCE) {
    return this.pins.some(pin => {
      const latDiff = Math.abs(pin.lat - lat);
      const lngDiff = Math.abs(pin.lng - lng);
      const nameSimilar = pin.name === name;
      
      // 座標が非常に近く、名前が同じ場合は重複と判定
      return latDiff < tolerance && lngDiff < tolerance && nameSimilar;
    });
  }

  // ==========================================
  // データ保存・読み込み関連
  // ==========================================
  savePinsToLocalStorage() {
    // 個人ピンのみローカルストレージに保存
    const personalPinsData = this.personalPins.map(pin => ({
      id: pin.id,
      lat: pin.lat,
      lng: pin.lng,
      name: pin.name,
      color: pin.color,
      note: pin.note,
      pinType: pin.pinType
    }));
    localStorage.setItem('mapPins', JSON.stringify(personalPinsData));
  }

  loadPinsFromLocalStorage() {
    const savedPins = localStorage.getItem('mapPins');
    if (savedPins) {
      const pinsData = JSON.parse(savedPins);
      pinsData.forEach(pinData => {
        // 個人ピンとして復元（pinTypeが設定されていない場合は個人ピンとして扱う）
        const pinType = pinData.pinType || 'personal';
        this.addPin(pinData.lng, pinData.lat, pinData.name, pinData.color, pinData.note, true, pinType);
      });
    }
  }

  // ==========================================
  // データ読み込み関連
  // ==========================================
  async loadNearbyData(dataType) {
    try {
      const center = this.map.getCenter();
      const centerLat = center.lat;
      const centerLng = center.lng;
      
      // CSVファイルを読み込み
      const response = await fetch(`./data/${dataType}.csv`);
      if (!response.ok) {
        throw new Error(`Failed to load ${dataType}.csv`);
      }
      
      const csvText = await response.text();
      const data = parseCSV(csvText);
      
      // 指定半径内のデータを取得
      const nearbyData = filterDataByDistance(data, centerLat, centerLng, PinService.CONSTANTS.SEARCH_RADIUS, PinService.CONSTANTS.MAX_RESULTS);
      
      if (nearbyData.length === 0) {
        this.showNoDataMessage(dataType);
        return;
      }
      
      // 確認ダイアログ
      if (!this.confirmDataDisplay(nearbyData.length, dataType)) {
        return;
      }
      
      // ピンを追加（施設データピンとして）
      this.addFacilityPinsFromData(nearbyData.map(item => ({
        ...item,
        color: item.color || this.getDataTypeColor(dataType)
      })));
      
      this.showDataLoadedMessage(nearbyData.length, dataType);
      
    } catch (error) {
      this.handleDataLoadError('近隣データ読み込み', error);
    }
  }

  // ==========================================
  // 表示制御関連
  // ==========================================
  // 施設データピンの表示状態を更新
  updateFacilityPinsVisibility() {
    const bounds = this.map.getBounds();
    console.log('Updating facility pins visibility, bounds:', bounds);
    console.log('Facility pins count:', this.facilityPins.length);
    
    this.facilityPins.forEach(pin => {
      const isInViewport = this.isPinInViewport(pin, bounds);
      console.log(`Pin ${pin.name} at ${pin.lat}, ${pin.lng}: inViewport=${isInViewport}, hasMarker=${!!pin.marker._map}`);
      
      if (isInViewport) {
        // 表示範囲内の場合、現在非表示でも再表示はしない（ボタンを押すまで非表示のまま）
        // ただし、既に表示されているピンはそのまま表示を維持
      } else {
        // 表示範囲外の場合、マーカーを非表示にする
        if (pin.marker._map) {
          console.log(`Removing pin ${pin.name} from map`);
          pin.marker.remove();
          pin.isVisible = false;
        }
      }
    });
  }

  isPinInViewport(pin, bounds) {
    const { lat, lng } = pin;
    return lat >= bounds.getSouth() && 
           lat <= bounds.getNorth() && 
           lng >= bounds.getWest() && 
           lng <= bounds.getEast();
  }

  // ピンの表示範囲チェックと非表示処理を実行
  handlePinVisibilityCheck(pin) {
    if (!pin) return;
    
    const bounds = this.map.getBounds();
    const isInViewport = this.isPinInViewport(pin, bounds);
    this.logInfo(`ピン表示範囲チェック: ${pin.name} (${pin.lat}, ${pin.lng}) -> 表示範囲内=${isInViewport}`);
    
    if (!isInViewport) {
      pin.marker.remove();
      pin.isVisible = false;
      this.logInfo(`ピンを非表示に設定: ${pin.name}`);
    }
  }

  // ==========================================
  // ヘルパーメソッド
  // ==========================================
  // ログ出力用ヘルパー
  logInfo(message, data = null) {
    const prefix = '[PinService]';
    if (data) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  logError(message, error = null) {
    const prefix = '[PinService ERROR]';
    if (error) {
      console.error(`${prefix} ${message}`, error);
    } else {
      console.error(`${prefix} ${message}`);
    }
  }

  // エラーハンドリング用ヘルパー
  handleDataLoadError(operation, error) {
    this.logError(`${operation}でエラーが発生しました`, error);
    alert(`データの読み込みに失敗しました。\n操作: ${operation}`);
  }

  getDataTypeLabel(dataType) {
    return PinService.CONSTANTS.DATA_TYPE_LABELS[dataType] || 'データ';
  }
  
  getDataTypeColor(dataType) {
    return PinService.CONSTANTS.DATA_TYPE_COLORS[dataType] || CONFIG.MARKER_COLORS.pin;
  }
  
  formatPinName(item) {
    return item.name || 'Unknown';
  }
  
  formatPinNote(item) {
    const parts = [];
    
    if (item.address) parts.push(`住所: ${item.address}`);
    if (item.floor) parts.push(`階: ${item.floor}`);
    if (item.toilet_name) parts.push(`トイレ: ${item.toilet_name}`);
    
    // 構造化された備考データを表示
    if (item.description && item.description.trim()) {
      parts.push(`<div style="margin-top: 8px;"><strong>説明:</strong><br>${item.description}</div>`);
    }
    
    if (item.equipment && item.equipment.trim()) {
      parts.push(`<div style="margin-top: 8px;"><strong>設備:</strong><br>${item.equipment}</div>`);
    }
    
    // 従来のnoteフィールドがあり、descriptionとequipmentに分割されていない場合
    if (item.note && !item.description && !item.equipment) {
      parts.push(`備考: ${item.note}`);
    }
    
    if (item.distance) parts.push(`<div style="margin-top: 8px; font-weight: bold; color: #0066cc;">距離: ${formatDistance(item.distance)}</div>`);
    
    return parts.join('<br>');
  }

  // 全ての近くのデータを統合して読み込み（最適化版）
  async loadAllNearbyData() {
    try {
      const center = this.map.getCenter();
      const centerLat = center.lat;
      const centerLng = center.lng;
      
      this.logInfo(`地図中心座標: lat=${centerLat}, lng=${centerLng}`);
      
      const areaInfo = estimateAreaFromCoordinates(centerLat, centerLng);
      this.logInfo('推定エリア情報', areaInfo);
      
      // 確認ダイアログ
      if (!this.confirmLoadAllNearbyData(areaInfo)) {
        return;
      }
      
      await this.loadNearbyDataWithFallback(centerLat, centerLng, areaInfo);
      
    } catch (error) {
      this.handleDataLoadError('統合データ読み込み', error);
    }
  }

  // 統合データ読み込みの確認ダイアログ
  confirmLoadAllNearbyData(areaInfo) {
    return confirm(`近くのバリアフリートイレを表示しますか？\n範囲：${PinService.CONSTANTS.SEARCH_RADIUS}m以内\n推定エリア：${areaInfo.area}（${PinService.CONSTANTS.AREA_TYPE_LABELS[areaInfo.type] || areaInfo.type}）\n重複するピンは自動的にスキップされます。`);
  }

  // 地域データ読み込み（フォールバック付き）
  async loadNearbyDataWithFallback(centerLat, centerLng, areaInfo) {
    try {
      // 地域別データを優先的に読み込み
      const nearbyData = await loadNearbyData(
        centerLat, 
        centerLng, 
        PinService.CONSTANTS.SEARCH_RADIUS, 
        PinService.CONSTANTS.MAX_RESULTS,
        false // 軽量版を使用しない
      );
      
      this.logInfo(`地域データから${nearbyData.length}件の近隣アイテムを発見`);
      
      if (nearbyData.length === 0) {
        this.logInfo('地域ファイルにデータが見つからないため、統合データにフォールバック');
        await this.loadIntegratedData(centerLat, centerLng);
        return;
      }
      
      const { totalLoaded, totalSkipped } = this.addFacilityPinsFromData(nearbyData);
      this.showFinalResultMessage(totalLoaded, totalSkipped, areaInfo.area);
      
    } catch (areaError) {
      this.logError('地域データ読み込みエラー、統合データにフォールバック', areaError);
      await this.loadIntegratedData(centerLat, centerLng);
    }
  }

  // データからピンを追加（重複チェック付き）
  addFacilityPinsFromData(data) {
    let totalLoaded = 0;
    let totalSkipped = 0;
    
    data.forEach(item => {
      const result = this.addSingleFacilityPin(item);
      if (result.added) {
        totalLoaded++;
      } else {
        totalSkipped++;
      }
    });
    
    return { totalLoaded, totalSkipped };
  }

  // 単一の施設ピンを追加（重複チェック付き）
  addSingleFacilityPin(item, defaultColor = 'barrier_free_toilets') {
    const displayName = this.formatPinName(item);
    
    // 重複チェック
    if (this.isDuplicatePin(item.lng, item.lat, displayName)) {
      return { added: false, pin: null };
    }
    
    const displayNote = this.formatPinNote(item);
    const pin = this.addPin(
      item.lng, 
      item.lat, 
      displayName, 
      item.color || this.getDataTypeColor(defaultColor), 
      displayNote,
      false,
      'facility'
    );
    
    // 表示範囲チェックを実行
    this.handlePinVisibilityCheck(pin);
    
    return { added: true, pin };
  }

  // ==========================================
  // メッセージ表示用メソッド
  // ==========================================
  confirmDataDisplay(count, dataType) {
    const message = `${count}件の${this.getDataTypeLabel(dataType)}が見つかりました。表示しますか？`;
    return confirm(message);
  }

  showNoDataMessage(dataType) {
    alert(`現在の表示範囲（${PinService.CONSTANTS.SEARCH_RADIUS}m以内）には${this.getDataTypeLabel(dataType)}がありません。`);
  }

  showDataLoadedMessage(count, dataType) {
    alert(`${count}件の${this.getDataTypeLabel(dataType)}を表示しました。`);
  }

  showFinalResultMessage(totalLoaded, totalSkipped, estimatedWard = null) {
    let message = `${totalLoaded}件のデータを表示しました。`;
    if (totalSkipped > 0) {
      message += `\n（${totalSkipped}件の重複データをスキップしました）`;
    }
    if (estimatedWard) {
      message += `\n読み込み元：${estimatedWard}エリア`;
    }
    alert(message);
  }
  
  // 統合ファイルへのフォールバック機能
  async loadIntegratedData(centerLat, centerLng) {
    try {
      this.logInfo('統合データファイルを読み込み中...');
      
      const allData = await this.loadIntegratedDataFiles();
      const nearbyData = filterDataByDistance(allData, centerLat, centerLng, PinService.CONSTANTS.SEARCH_RADIUS, PinService.CONSTANTS.MAX_RESULTS);
      
      this.logInfo(`統合データから${nearbyData.length}件の近隣アイテムを発見`);
      
      if (nearbyData.length === 0) {
        alert(`現在の表示範囲（${PinService.CONSTANTS.SEARCH_RADIUS}m以内）にはデータがありません。`);
        return;
      }
      
      const { totalLoaded, totalSkipped } = this.addFacilityPinsFromData(nearbyData);
      
      // 結果をレポート（フォールバック使用を明示）
      let message = `${totalLoaded}件のデータを表示しました。`;
      if (totalSkipped > 0) {
        message += `\n（${totalSkipped}件の重複データをスキップしました）`;
      }
      message += `\n読み込み元：統合ファイル（フォールバック）`;
      alert(message);
      
    } catch (error) {
      this.handleDataLoadError('統合ファイル読み込み', error);
    }
  }

  // 統合データファイルの読み込み
  async loadIntegratedDataFiles() {
    const [publicResponse, stationResponse] = await Promise.all([
      fetch('./data/barrier_free_toilets.csv'),
      fetch('./data/station_barrier_free_toilets.csv')
    ]);
    
    if (!publicResponse.ok && !stationResponse.ok) {
      throw new Error('Both integrated files are not available');
    }
    
    const allData = [];
    
    if (publicResponse.ok) {
      const publicCsvText = await publicResponse.text();
      const publicData = parseCSV(publicCsvText);
      allData.push(...publicData);
      this.logInfo(`公共統合ファイルから${publicData.length}件のアイテムを読み込み`);
    }
    
    if (stationResponse.ok) {
      const stationCsvText = await stationResponse.text();
      const stationData = parseCSV(stationCsvText);
      allData.push(...stationData);
      this.logInfo(`駅統合ファイルから${stationData.length}件のアイテムを読み込み`);
    }
    
    return allData;
  }
}

export default PinService;