import CONFIG from "./config.js";
// 日本語説明: モバイル時にポップアップの代わりにボトムシートを開くためのユーティリティ
import { openBottomSheet, isMobile, onBottomSheetClose } from './bottomSheet.js';
import {
  parseCSV,
  filterDataByDistance,
  formatDistance,
  loadNearbyData,
  loadNearbyDataIntegrated,
  estimateAreaFromCoordinates,
} from "./utils.js";

class PinService {
  constructor(map) {
    this.map = map;
    this.pins = []; // 後方互換性のため保持
    this.personalPins = []; // 個人ピン（常に表示）
    this.facilityPins = []; // 施設データピン（一度非表示になったらボタンを押すまで非表示のまま）
    this.pinCounter = 0;
    // 日本語説明: 現在選択中のピンを保持（ボトムシートと連動して色を変更）
    this.selectedPin = null;
    this.init();
  }

  // ==========================================
  // 定数定義
  // ==========================================
  static CONSTANTS = {
    SEARCH_RADIUS: 500,
    MAX_RESULTS: 50,
    DUPLICATE_TOLERANCE: 0.0001,
    // 日本語説明: 選択中ピンの強調色（オレンジ系）
    SELECTED_COLOR: "#ff9900",
    DATA_TYPE_LABELS: {
      toilets: "トイレ",
      stations: "駅",
      facilities: "施設",
      barrier_free_toilets: "バリアフリートイレ",
      station_barrier_free_toilets: "駅バリアフリートイレ",
    },
    DATA_TYPE_COLORS: {
      toilets: "#00cc00",
      stations: "#0066cc",
      facilities: "#ff6600",
      barrier_free_toilets: "#cc00cc",
      station_barrier_free_toilets: "#0099cc",
    },
    AREA_TYPE_LABELS: {
      ward: "区",
      city: "市",
      town: "町村",
      island: "島",
    },
  };

  // ==========================================
  // 初期化メソッド
  // ==========================================
  init() {
    this.setupEventListeners();
    this.setupMapEventListeners();
    this.loadPinsFromLocalStorage();
    // 日本語説明: ボトムシートが閉じられたら選択状態を解除する
    onBottomSheetClose(() => this.clearSelectedPin());
  }

  setupEventListeners() {
    // 近くのデータ表示ボタン（統合）
    document
      .getElementById("load-all-nearby-data")
      .addEventListener("click", () => this.loadAllNearbyData());
  }

  setupMapEventListeners() {
    // 地図の移動・ズーム完了時に施設データピンの表示を更新
    this.map.on("moveend", () => this.updateFacilityPinsVisibility());
    this.map.on("zoomend", () => this.updateFacilityPinsVisibility());
  }

  // ==========================================
  // ピン管理メソッド
  // ==========================================
  addPin(
    lng,
    lat,
    name = null,
    color = null,
    note = null,
    skipDuplicateCheck = false,
    pinType = "personal"
  ) {
    const id = ++this.pinCounter;
    const pinName = name || `ピン${id}`;
    const pinColor = color || CONFIG.MARKER_COLORS.pin;
    const pinNote = note || "";

    // 重複チェック（スキップ指定がない場合のみ）
    if (!skipDuplicateCheck && this.isDuplicatePin(lng, lat, pinName)) {
      return null;
    }

    const marker = new maplibregl.Marker({
      color: pinColor,
    })
      .setLngLat([lng, lat])
      .addTo(this.map);

    // 既存のCSSクラス（.popup-*）に合わせてマークアップを構造化し、可読性を高める
    // 日本語説明: タイトル・座標・詳細/備考をそれぞれ専用クラスで表示する
    const noteSection = pinNote
      ? pinType === "facility"
        ? `${pinNote}`
        : `<div class="popup-note">${pinNote}</div>`
      : "";
    const popupHTML = `
      <div>
        <div class="popup-title">${pinName}</div>
        <div class="popup-coordinates">緯度: ${lat.toFixed(
          6
        )} / 経度: ${lng.toFixed(6)}</div>
        ${noteSection}
      </div>
    `;

    const popup = new maplibregl.Popup({
      offset: CONFIG.POPUP_OFFSET,
      closeButton: true,
      closeOnClick: false,
    }).setHTML(popupHTML);

    marker.setPopup(popup);

    // マーカーのクリックイベントを明示的に設定
    marker.getElement().addEventListener("click", (e) => {
      e.stopPropagation();

      // クリックしたピンを視認しやすい位置へ移動（滑らかなアニメーション）
      // 日本語説明: モバイルではボトムシートを考慮して、ポイントが画面下から約65%（=上から35%）に来るようオフセット
      const flyOptions = {
        center: [lng, lat],
        zoom: Math.max(this.map.getZoom(), 15), // 現在のズームレベルを維持（最低15）
        duration: 800, // アニメーション時間（ミリ秒）
        essential: true, // アニメーションをスキップさせない
      };
      if (isMobile()) {
        const vh = window.innerHeight || document.documentElement.clientHeight || 0;
        const desiredFromTop = 1 - 0.65; // 画面下から65% => 上から35%
        const offsetY = (desiredFromTop - 0.5) * vh; // 中心(50%)との差分をpxに換算（上方向は負）
        flyOptions.offset = [0, offsetY];
      }
      this.map.flyTo(flyOptions);

      // 他のすべてのポップアップを閉じてから、このピンのポップアップを開く
      this.closeAllPopups();
      // 日本語説明: モバイルではボトムシートを開く前に選択色を適用。
      // デスクトップでは従来のポップアップのみ（色変更は行わない）
      if (isMobile()) {
        // 日本語説明: 既存選択を解除して、このピンを選択状態にする
        this.setSelectedPin(pin);
        openBottomSheet(popupHTML, pinName);
      } else {
        marker.getPopup().setLngLat([lng, lat]).addTo(this.map);
      }
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
      isVisible: true, // 表示状態を管理（施設データピン用）
    };

    // ピンタイプに応じて適切な配列に追加
    if (pinType === "personal") {
      this.personalPins.push(pin);
    } else if (pinType === "facility") {
      this.facilityPins.push(pin);
    }

    // 後方互換性のため既存の pins 配列にも追加
    this.pins.push(pin);

    // 個人ピンのみ localStorage に保存
    if (pinType === "personal") {
      this.savePinsToLocalStorage();
    }

    return pin;
  }

  // 日本語説明: 指定したマーカー要素の色をできる限り確実に変更するユーティリティ
  updateMarkerColor(marker, color) {
    try {
      if (typeof marker.setColor === 'function') {
        marker.setColor(color);
        return;
      }
    } catch (_) {}
    try {
      const el = marker.getElement();
      const path = el && el.querySelector && el.querySelector('svg path');
      if (path) {
        path.setAttribute('fill', color);
        return;
      }
    } catch (_) {}
    // 最後の手段: 背景色を変更（デフォルトマーカーでは反映されない可能性あり）
    try {
      const el = marker.getElement();
      if (el && el.style) el.style.backgroundColor = color;
    } catch (_) {}
  }

  // 日本語説明: ピンを選択状態にし、選択色（オレンジ）に変更。以前の選択は解除。
  setSelectedPin(pin) {
    if (!pin) return;
    if (this.selectedPin && this.selectedPin.id === pin.id) return; // 既に選択中
    this.clearSelectedPin();
    this.updateMarkerColor(pin.marker, PinService.CONSTANTS.SELECTED_COLOR);
    this.selectedPin = pin;
  }

  // 日本語説明: 選択状態を解除し、元の色に戻す
  clearSelectedPin() {
    if (!this.selectedPin) return;
    const prev = this.selectedPin;
    try {
      // 日本語説明: 保存している元色で復元
      this.updateMarkerColor(prev.marker, prev.color);
    } catch (_) {}
    this.selectedPin = null;
  }

  // すべてのポップアップを閉じる
  closeAllPopups() {
    this.pins.forEach((pin) => {
      if (pin.marker.getPopup() && pin.marker.getPopup().isOpen()) {
        pin.marker.getPopup().remove();
      }
    });
  }

  clearAllPins() {
    if (this.pins.length === 0) {
      alert("削除するピンがありません。");
      return;
    }

    if (confirm(`${this.pins.length}個のピンを削除しますか？`)) {
      this.pins.forEach((pin) => pin.marker.remove());
      this.pins = [];
      this.personalPins = [];
      this.facilityPins = [];
      this.savePinsToLocalStorage();
    }
  }

  // 重複ピンをチェック（座標とタイプで判定）
  isDuplicatePin(
    lng,
    lat,
    name,
    tolerance = PinService.CONSTANTS.DUPLICATE_TOLERANCE
  ) {
    return this.pins.some((pin) => {
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
    const personalPinsData = this.personalPins.map((pin) => ({
      id: pin.id,
      lat: pin.lat,
      lng: pin.lng,
      name: pin.name,
      color: pin.color,
      note: pin.note,
      pinType: pin.pinType,
    }));
    localStorage.setItem("mapPins", JSON.stringify(personalPinsData));
  }

  loadPinsFromLocalStorage() {
    const savedPins = localStorage.getItem("mapPins");
    if (savedPins) {
      const pinsData = JSON.parse(savedPins);
      pinsData.forEach((pinData) => {
        // 個人ピンとして復元（pinTypeが設定されていない場合は個人ピンとして扱う）
        const pinType = pinData.pinType || "personal";
        this.addPin(
          pinData.lng,
          pinData.lat,
          pinData.name,
          pinData.color,
          pinData.note,
          true,
          pinType
        );
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
      const response = await fetch(`/data/${dataType}.csv`);
      if (!response.ok) {
        throw new Error(`Failed to load ${dataType}.csv`);
      }

      const csvText = await response.text();
      const data = parseCSV(csvText);

      // 指定半径内のデータを取得
      const nearbyData = filterDataByDistance(
        data,
        centerLat,
        centerLng,
        PinService.CONSTANTS.SEARCH_RADIUS,
        PinService.CONSTANTS.MAX_RESULTS
      );

      if (nearbyData.length === 0) {
        this.showNoDataMessage(dataType);
        return;
      }

      // 確認ダイアログ
      if (!this.confirmDataDisplay(nearbyData.length, dataType)) {
        return;
      }

      // ピンを追加（施設データピンとして）
      this.addFacilityPinsFromData(
        nearbyData.map((item) => ({
          ...item,
          color: item.color || this.getDataTypeColor(dataType),
        }))
      );

      this.showDataLoadedMessage(nearbyData.length, dataType);
    } catch (error) {
      this.handleDataLoadError("近隣データ読み込み", error);
    }
  }

  // ==========================================
  // 表示制御関連
  // ==========================================
  // 施設データピンの表示状態を更新
  updateFacilityPinsVisibility() {
    const bounds = this.map.getBounds();
    console.log("Updating facility pins visibility, bounds:", bounds);
    console.log("Facility pins count:", this.facilityPins.length);

    this.facilityPins.forEach((pin) => {
      const isInViewport = this.isPinInViewport(pin, bounds);
      console.log(
        `Pin ${pin.name} at ${pin.lat}, ${
          pin.lng
        }: inViewport=${isInViewport}, hasMarker=${!!pin.marker._map}`
      );

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
    return (
      lat >= bounds.getSouth() &&
      lat <= bounds.getNorth() &&
      lng >= bounds.getWest() &&
      lng <= bounds.getEast()
    );
  }

  // ピンの表示範囲チェックと非表示処理を実行
  handlePinVisibilityCheck(pin) {
    if (!pin) return;

    const bounds = this.map.getBounds();
    const isInViewport = this.isPinInViewport(pin, bounds);
    this.logInfo(
      `ピン表示範囲チェック: ${pin.name} (${pin.lat}, ${pin.lng}) -> 表示範囲内=${isInViewport}`
    );

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
    const prefix = "[PinService]";
    if (data) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  logError(message, error = null) {
    const prefix = "[PinService ERROR]";
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
    return PinService.CONSTANTS.DATA_TYPE_LABELS[dataType] || "データ";
  }

  getDataTypeColor(dataType) {
    return (
      PinService.CONSTANTS.DATA_TYPE_COLORS[dataType] ||
      CONFIG.MARKER_COLORS.pin
    );
  }

  formatPinName(item) {
    return item.name || "Unknown";
  }

  formatPinNote(item) {
    // 施設データの表示用HTMLを既存CSSクラスに合わせて生成
    // 見やすさ向上のため、各項目を分離し、クラスベースの装飾に切り替える
    const parts = [];

    // 距離（バッジ風表示）
    if (item.distance) {
      parts.push(
        `<span class="popup-distance">距離: ${formatDistance(
          item.distance
        )}</span>`
      );
    }

    // 住所などの基本情報
    const basics = [];
    if (item.address) basics.push(`住所: ${item.address}`);
    if (item.floor) basics.push(`階: ${item.floor}`);
    if (item.toilet_name) basics.push(`トイレ: ${item.toilet_name}`);
    if (basics.length > 0) {
      parts.push(`<div class="popup-address">${basics.join("<br>")}</div>`);
    }

    // 説明・設備（詳細情報）
    if (item.description && item.description.trim()) {
      parts.push(
        `<div class="popup-details"><strong>説明:</strong><br>${item.description}</div>`
      );
    }
    if (item.equipment && item.equipment.trim()) {
      parts.push(
        `<div class="popup-details"><strong>設備:</strong><br>${item.equipment}</div>`
      );
    }

    // 旧noteのみが存在するケース（後方互換）
    if (item.note && !item.description && !item.equipment) {
      parts.push(`<div class="popup-note">備考: ${item.note}</div>`);
    }

    return parts.join("");
  }

  // 全ての近くのデータを統合して読み込み（最適化版）
  async loadAllNearbyData() {
    try {
      const center = this.map.getCenter();
      const centerLat = center.lat;
      const centerLng = center.lng;

      this.logInfo(`地図中心座標: lat=${centerLat}, lng=${centerLng}`);

      const areaInfo = estimateAreaFromCoordinates(centerLat, centerLng);
      this.logInfo("推定エリア情報", areaInfo);

      // 確認ダイアログ
      if (!this.confirmLoadAllNearbyData(areaInfo)) {
        return;
      }

      await this.loadNearbyDataWithFallback(centerLat, centerLng, areaInfo);
    } catch (error) {
      this.handleDataLoadError("統合データ読み込み", error);
    }
  }

  // 統合データ読み込みの確認ダイアログ
  confirmLoadAllNearbyData(areaInfo) {
    // 仕様変更: ダイアログを表示せず常に実行する
    // 日本語説明: トイレ表示ボタン押下時の確認ダイアログは廃止
    return true;
  }

  // 統合ファイル優先データ読み込み（信頼性重視）
  async loadNearbyDataWithFallback(centerLat, centerLng, areaInfo) {
    try {
      // 統合ファイルを最優先で読み込み（確実に存在）
      this.logInfo("統合ファイル（確実）から読み込み開始...");
      await this.loadIntegratedData(centerLat, centerLng);
    } catch (error) {
      this.logError("統合ファイル読み込みエラー", error);
      // 統合ファイルが失敗した場合のみ地域別ファイルを試行
      try {
        this.logInfo("地域別ファイルにフォールバック...");
        const nearbyData = await loadNearbyData(
          centerLat,
          centerLng,
          PinService.CONSTANTS.SEARCH_RADIUS,
          PinService.CONSTANTS.MAX_RESULTS,
          false
        );

        if (nearbyData.length > 0) {
          const { totalLoaded, totalSkipped } =
            this.addFacilityPinsFromData(nearbyData);
          this.showFinalResultMessage(totalLoaded, totalSkipped, areaInfo.area);
        } else {
          alert(
            `現在の表示範囲（${PinService.CONSTANTS.SEARCH_RADIUS}m以内）にはデータがありません。`
          );
        }
      } catch (fallbackError) {
        this.logError("全ての読み込み方法が失敗", fallbackError);
        alert(
          "データの読み込みに失敗しました。しばらくしてから再試行してください。"
        );
      }
    }
  }

  // データからピンを追加（重複チェック付き）
  addFacilityPinsFromData(data) {
    let totalLoaded = 0;
    let totalSkipped = 0;

    data.forEach((item) => {
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
  addSingleFacilityPin(item, defaultColor = "barrier_free_toilets") {
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
      "facility"
    );

    // 表示範囲チェックを実行
    this.handlePinVisibilityCheck(pin);

    return { added: true, pin };
  }

  // ==========================================
  // メッセージ表示用メソッド
  // ==========================================
  confirmDataDisplay(count, dataType) {
    const message = `${count}件の${this.getDataTypeLabel(
      dataType
    )}が見つかりました。表示しますか？`;
    return confirm(message);
  }

  showNoDataMessage(dataType) {
    alert(
      `現在の表示範囲（${
        PinService.CONSTANTS.SEARCH_RADIUS
      }m以内）には${this.getDataTypeLabel(dataType)}がありません。`
    );
  }

  showDataLoadedMessage(count, dataType) {
    alert(`${count}件の${this.getDataTypeLabel(dataType)}を表示しました。`);
  }

  showFinalResultMessage(totalLoaded, totalSkipped, estimatedWard = null) {
    // 仕様変更: 結果のアラートは廃止。開発者向けにログのみ出力。
    // 日本語説明: モーダルダイアログはUX低下のため排除し、静かな動作とする
    const parts = [];
    parts.push(`${totalLoaded}件のデータを表示`);
    if (totalSkipped > 0) parts.push(`重複スキップ: ${totalSkipped}`);
    if (estimatedWard) parts.push(`読み込み元: ${estimatedWard}`);
    console.log("[PinService] 結果:", parts.join(" / "));
  }

  // 統合ファイル優先読み込み機能
  async loadIntegratedData(centerLat, centerLng) {
    try {
      this.logInfo("統合データファイルを読み込み中...");

      // 新しい統合ファイル専用関数を使用
      const nearbyData = await loadNearbyDataIntegrated(
        centerLat,
        centerLng,
        PinService.CONSTANTS.SEARCH_RADIUS,
        PinService.CONSTANTS.MAX_RESULTS
      );

      this.logInfo(`統合データから${nearbyData.length}件の近隣アイテムを発見`);

      if (nearbyData.length === 0) {
        alert(
          `現在の表示範囲（${PinService.CONSTANTS.SEARCH_RADIUS}m以内）にはデータがありません。`
        );
        return;
      }

      const { totalLoaded, totalSkipped } =
        this.addFacilityPinsFromData(nearbyData);

      // 結果をレポート（統合ファイル優先使用を明示）
      let message = `${totalLoaded}件のバリアフリートイレを表示しました。`;
      if (totalSkipped > 0) {
        message += `\n（${totalSkipped}件の重複データをスキップしました）`;
      }
      message += `\n読み込み元：東京都全域統合データ`;
      alert(message);
    } catch (error) {
      this.logError("統合ファイル読み込みエラー", error);
      throw error; // 上位レベルでのエラーハンドリングのため再スロー
    }
  }
}

export default PinService;
