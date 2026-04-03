import { useCallback, useEffect, useRef, useState } from "react";
import { Autocomplete, GoogleMap, MarkerF, useJsApiLoader } from "@react-google-maps/api";

const DEFAULT_CENTER = {
  lat: 19.076,
  lng: 72.8777,
};

const LIBRARIES = ["places"];

const MAP_CONTAINER_STYLE = {
  width: "100%",
  height: "16rem",
};

const parseCoordinate = (value) => {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const GoogleMapPicker = ({ latitude, longitude, onLocationSelect }) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const mapRef = useRef(null);
  const geocoderRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [selectedAddress, setSelectedAddress] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [error, setError] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState(() => {
    const parsedLatitude = parseCoordinate(latitude);
    const parsedLongitude = parseCoordinate(longitude);
    if (parsedLatitude === null || parsedLongitude === null) {
      return null;
    }

    return {
      lat: parsedLatitude,
      lng: parsedLongitude,
    };
  });

  const { isLoaded, loadError } = useJsApiLoader({
    id: "uttsav-google-maps-picker",
    googleMapsApiKey: apiKey || "",
    libraries: LIBRARIES,
  });

  useEffect(() => {
    if (!isLoaded || geocoderRef.current || !window.google?.maps) return;
    geocoderRef.current = new window.google.maps.Geocoder();
  }, [isLoaded]);

  useEffect(() => {
    const parsedLatitude = parseCoordinate(latitude);
    const parsedLongitude = parseCoordinate(longitude);
    if (parsedLatitude === null || parsedLongitude === null) return;

    setSelectedPosition((previousPosition) => {
      if (
        previousPosition &&
        Math.abs(previousPosition.lat - parsedLatitude) < 0.000001 &&
        Math.abs(previousPosition.lng - parsedLongitude) < 0.000001
      ) {
        return previousPosition;
      }

      return {
        lat: parsedLatitude,
        lng: parsedLongitude,
      };
    });
  }, [latitude, longitude]);

  const reverseGeocode = useCallback((lat, lng) => {
    if (!geocoderRef.current) return Promise.resolve("");

    return new Promise((resolve) => {
      geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === "OK" && Array.isArray(results) && results[0]?.formatted_address) {
          resolve(results[0].formatted_address);
          return;
        }

        resolve("");
      });
    });
  }, []);

  const commitLocationChange = useCallback(
    async (lat, lng, providedAddress = "") => {
      const nextAddress = providedAddress || (await reverseGeocode(lat, lng));
      const nextPosition = { lat, lng };

      setSelectedPosition(nextPosition);
      setSelectedAddress(nextAddress);
      setSearchValue(nextAddress || "");
      setError("");

      if (mapRef.current) {
        mapRef.current.panTo(nextPosition);
        mapRef.current.setZoom(15);
      }

      onLocationSelect?.({
        lat,
        lng,
        address: nextAddress,
      });
    },
    [onLocationSelect, reverseGeocode]
  );

  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  const onMapUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  const handleMapClick = useCallback(
    async (event) => {
      if (!event.latLng) return;

      await commitLocationChange(event.latLng.lat(), event.latLng.lng());
    },
    [commitLocationChange]
  );

  const handleMarkerDragEnd = useCallback(
    async (event) => {
      if (!event.latLng) return;

      await commitLocationChange(event.latLng.lat(), event.latLng.lng());
    },
    [commitLocationChange]
  );

  const handleAutocompleteLoad = useCallback((autocomplete) => {
    autocompleteRef.current = autocomplete;
  }, []);

  const handlePlaceChanged = useCallback(async () => {
    const place = autocompleteRef.current?.getPlace();
    const placeLocation = place?.geometry?.location;

    if (!placeLocation) {
      setError("No matching location found. Try a more specific address.");
      return;
    }

    const lat = placeLocation.lat();
    const lng = placeLocation.lng();
    const formattedAddress = place.formatted_address || place.name || "";

    await commitLocationChange(lat, lng, formattedAddress);
  }, [commitLocationChange]);

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported in this browser.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        await commitLocationChange(lat, lng);
        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
        setError("Unable to fetch your current location.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }, [commitLocationChange]);

  const mapCenter = selectedPosition || DEFAULT_CENTER;

  if (!apiKey) {
    return (
      <div className="rounded-xl border border-gray-200 bg-[#F8FAFC] p-4">
        <p className="mb-3 text-sm font-medium text-[#92400E]">
          Google Maps API key not configured. Set `VITE_GOOGLE_MAPS_API_KEY`.
        </p>
        <iframe
          title="Google Map Fallback"
          className="h-64 w-full rounded-lg border border-gray-200"
          src="https://maps.google.com/maps?q=19.0760,72.8777&z=12&output=embed"
        />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-gray-200 bg-[#F8FAFC] p-4">
        <p className="mb-3 text-sm font-medium text-[#92400E]">
          Unable to load Google Maps right now. You can still continue with manual address entry.
        </p>
        <iframe
          title="Google Map Fallback"
          className="h-64 w-full rounded-lg border border-gray-200"
          src="https://maps.google.com/maps?q=19.0760,72.8777&z=12&output=embed"
        />
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="rounded-xl border border-gray-200 bg-[#F8FAFC] p-4">
        <div className="h-64 w-full animate-pulse rounded-lg border border-gray-200 bg-white" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-[#F8FAFC] p-4">
      <div className="mb-3 flex flex-col gap-3 md:flex-row">
        <Autocomplete onLoad={handleAutocompleteLoad} onPlaceChanged={handlePlaceChanged}>
          <input
            type="text"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
              }
            }}
            placeholder="Search for a location"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-[#0F172A] placeholder:text-gray-400 focus:border-[#1E40AF] focus:outline-none"
          />
        </Autocomplete>

        <button
          type="button"
          onClick={handleLocateMe}
          disabled={isLocating}
          className="rounded-lg border border-[#1E40AF] bg-white px-4 py-2 text-sm font-semibold text-[#1E40AF] hover:bg-[#EFF6FF] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLocating ? "Locating..." : "Locate Me"}
        </button>
      </div>

      {selectedAddress ? <p className="mb-3 text-xs text-[#475569]">Selected: {selectedAddress}</p> : null}
      {error ? <p className="mb-3 text-xs font-medium text-[#DC2626]">{error}</p> : null}

      <GoogleMap
        center={mapCenter}
        zoom={selectedPosition ? 15 : 13}
        mapContainerStyle={MAP_CONTAINER_STYLE}
        onLoad={onMapLoad}
        onUnmount={onMapUnmount}
        onClick={handleMapClick}
        options={{
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
        }}
      >
        {selectedPosition ? (
          <MarkerF
            position={selectedPosition}
            draggable
            onDragEnd={handleMarkerDragEnd}
          />
        ) : null}
      </GoogleMap>
    </div>
  );
};

export default GoogleMapPicker;
