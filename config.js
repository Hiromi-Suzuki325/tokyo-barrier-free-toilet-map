const CONFIG = {
  MAPTILER_API_KEY: process.env.MAPTILER_API_KEY || "REDACTED_API_KEY",
  TOKYO_STATION_COORDS: [
    parseFloat(process.env.TOKYO_STATION_LNG) || 139.767,
    parseFloat(process.env.TOKYO_STATION_LAT) || 35.681
  ],
  DEFAULT_ZOOM: parseInt(process.env.DEFAULT_ZOOM) || 15,
  CURRENT_LOCATION_ZOOM: parseInt(process.env.CURRENT_LOCATION_ZOOM) || 15,
  GEOLOCATION_OPTIONS: {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 60000,
  },
  MARKER_COLORS: {
    currentLocation: "#ff0000",
    pin: "#0066cc",
  },
  POPUP_OFFSET: 25,
};

export default CONFIG;
