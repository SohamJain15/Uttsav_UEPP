import { useEffect, useRef, useState } from "react";

const DEFAULT_CENTER = {
  lat: 19.076,
  lng: 72.8777,
};

let googleMapsLoader = null;

const loadGoogleMaps = (apiKey) => {
  if (typeof window !== "undefined" && window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (googleMapsLoader) {
    return googleMapsLoader;
  }

  googleMapsLoader = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.maps) {
        resolve(window.google.maps);
      } else {
        reject(new Error("Google Maps failed to initialize."));
      }
    };
    script.onerror = () => reject(new Error("Failed to load Google Maps script."));
    document.body.appendChild(script);
  });

  return googleMapsLoader;
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const GoogleMapPicker = ({ latitude, longitude, onLocationSelect }) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const mapClickListenerRef = useRef(null);
  const markerDragListenerRef = useRef(null);
  const [error, setError] = useState("");
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    let isMounted = true;

    const initializeMap = async () => {
      if (!apiKey) {
        setError("Google Maps unavailable");
        return;
      }

      const getInitialCenter = () =>
        new Promise((resolve) => {
          if (!navigator.geolocation) {
            resolve(DEFAULT_CENTER);
            return;
          }

          navigator.geolocation.getCurrentPosition(
            (position) => {
              resolve({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              });
            },
            () => resolve(DEFAULT_CENTER),
            {
              enableHighAccuracy: true,
              timeout: 7000,
              maximumAge: 60000,
            }
          );
        });

      try {
        const persistedLat = toNumber(latitude);
        const persistedLng = toNumber(longitude);
        const center =
          persistedLat !== null && persistedLng !== null
            ? { lat: persistedLat, lng: persistedLng }
            : await getInitialCenter();

        await loadGoogleMaps(apiKey);
        if (!isMounted || !mapContainerRef.current) return;

        mapRef.current = new window.google.maps.Map(mapContainerRef.current, {
          center,
          zoom: 13,
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
        });

        const updateLocation = (lat, lng, shouldPan = false) => {
          if (!markerRef.current) return;

          markerRef.current.setPosition({ lat, lng });
          if (shouldPan) {
            mapRef.current.panTo({ lat, lng });
          }

          onLocationSelect?.({
            lat,
            lng,
            url: `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`,
          });
        };

        markerRef.current = new window.google.maps.Marker({
          map: mapRef.current,
          position: center,
          draggable: true,
        });

        updateLocation(center.lat, center.lng);

        mapClickListenerRef.current = mapRef.current.addListener("click", (event) => {
          if (!event.latLng) return;
          updateLocation(event.latLng.lat(), event.latLng.lng());
        });

        markerDragListenerRef.current = markerRef.current.addListener("dragend", (event) => {
          if (!event.latLng) return;
          updateLocation(event.latLng.lat(), event.latLng.lng(), true);
        });
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message || "Unable to load Google Maps.");
        }
      }
    };

    initializeMap();

    return () => {
      isMounted = false;
      if (mapClickListenerRef.current && window.google?.maps?.event) {
        window.google.maps.event.removeListener(mapClickListenerRef.current);
      }
      if (markerDragListenerRef.current && window.google?.maps?.event) {
        window.google.maps.event.removeListener(markerDragListenerRef.current);
      }
    };
  }, [apiKey, onLocationSelect, latitude, longitude]);

  useEffect(() => {
    const lat = toNumber(latitude);
    const lng = toNumber(longitude);
    if (lat === null || lng === null) return;
    if (!mapRef.current || !markerRef.current) return;

    markerRef.current.setPosition({ lat, lng });
    mapRef.current.panTo({ lat, lng });
  }, [latitude, longitude]);

  if (error) {
    return (
      <div className="rounded-xl border border-gray-200 bg-[#F8FAFC] p-4">
        <iframe
          title="Google Map Fallback"
          className="h-64 w-full rounded-lg border border-gray-200"
          src="https://maps.google.com/maps?q=19.0760,72.8777&z=12&output=embed"
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-[#F8FAFC] p-4">
      <div ref={mapContainerRef} className="h-64 w-full rounded-lg border border-gray-200 bg-white" />
    </div>
  );
};

export default GoogleMapPicker;
