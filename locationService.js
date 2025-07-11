import CONFIG from './config.js';

class LocationService {
  constructor(map) {
    this.map = map;
    this.currentLocationMarker = null;
    this.locationButton = document.getElementById('location-btn');
    this.init();
  }

  init() {
    if (!this.locationButton) {
      console.error('Location button not found');
      return;
    }
    this.locationButton.addEventListener('click', () => this.getCurrentLocation());
  }

  getCurrentLocation() {
    // HTTPSチェック
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      this.showErrorMessage('位置情報の取得にHTTPS接続が必要です。');
      return;
    }

    if (!navigator.geolocation) {
      this.showErrorMessage('このブラウザは位置情報をサポートしていません。');
      return;
    }

    this.setButtonLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => this.onLocationSuccess(position),
      (error) => this.onLocationError(error),
      CONFIG.GEOLOCATION_OPTIONS
    );
  }

  onLocationSuccess(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    
    this.map.flyTo({
      center: [lng, lat],
      zoom: CONFIG.CURRENT_LOCATION_ZOOM,
      essential: true
    });

    this.updateCurrentLocationMarker(lng, lat);
    this.setButtonLoading(false);
  }

  onLocationError(error) {
    console.error('Geolocation error:', error);
    const errorMessage = this.getLocationErrorMessage(error);
    this.showErrorMessage(errorMessage);
    this.setButtonLoading(false);
  }

  getLocationErrorMessage(error) {
    switch(error.code) {
      case error.PERMISSION_DENIED:
        return '位置情報の取得が拒否されました。';
      case error.POSITION_UNAVAILABLE:
        return '位置情報が利用できません。';
      case error.TIMEOUT:
        return '位置情報の取得がタイムアウトしました。';
      default:
        return '位置情報の取得に失敗しました。';
    }
  }

  showErrorMessage(message) {
    alert(message);
  }

  updateCurrentLocationMarker(lng, lat) {
    if (this.currentLocationMarker) {
      this.currentLocationMarker.remove();
    }

    this.currentLocationMarker = new maplibregl.Marker({
      color: CONFIG.MARKER_COLORS.currentLocation
    })
      .setLngLat([lng, lat])
      .addTo(this.map);
  }

  setButtonLoading(isLoading) {
    if (this.locationButton) {
      this.locationButton.disabled = isLoading;
      this.locationButton.innerHTML = isLoading ? '⏳' : '📍';
    }
  }
}

export default LocationService;