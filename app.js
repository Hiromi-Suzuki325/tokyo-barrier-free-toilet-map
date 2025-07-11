import CONFIG from './config.js';
import LocationService from './locationService.js';
import PinService from './pinService.js';

class MapApp {
  constructor() {
    this.map = null;
    this.locationService = null;
    this.pinService = null;
    this.init();
  }

  init() {
    this.initMap();
    this.initServices();
  }

  initMap() {
    this.map = new maplibregl.Map({
      container: "map",
      style: `https://api.maptiler.com/maps/streets/style.json?key=${CONFIG.MAPTILER_API_KEY}`,
      center: CONFIG.TOKYO_STATION_COORDS,
      zoom: CONFIG.DEFAULT_ZOOM,
    });
  }

  initServices() {
    this.locationService = new LocationService(this.map);
    this.pinService = new PinService(this.map);
    
    // グローバルアクセス用（ポップアップからの削除機能のため）
    window.pinService = this.pinService;
    
    // 即座にボタンを初期化（DOMContentLoadedの後なので要素は存在する）
    this.initResetNorthButton();
    this.initMapClickHandler();
  }
  
  initResetNorthButton() {
    const resetNorthBtn = document.getElementById('reset-north-btn');
    
    if (resetNorthBtn) {
      resetNorthBtn.addEventListener('click', () => {
        this.map.easeTo({
          bearing: 0,
          pitch: 0,
          duration: 500
        });
      });
    }
  }

  initMapClickHandler() {
    // 地図の空白部分をクリックした時にすべてのポップアップを閉じる
    this.map.on('click', (e) => {
      // ピンがクリックされた場合はイベントがstopPropagationされるため、ここには到達しない
      this.pinService.closeAllPopups();
    });
  }
}

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', () => {
  new MapApp();
});