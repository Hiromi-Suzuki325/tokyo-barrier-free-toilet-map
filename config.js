const CONFIG = {
  MAPTILER_API_KEY: "REDACTED_API_KEY",
  TOKYO_STATION_COORDS: [139.767, 35.681],
  DEFAULT_ZOOM: 15,
  CURRENT_LOCATION_ZOOM: 15,
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
