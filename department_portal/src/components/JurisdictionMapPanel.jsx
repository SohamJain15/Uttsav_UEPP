import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const FALLBACK_CENTER = { lat: 19.076, lng: 72.8777 };
const GOOGLE_MAPS_SCRIPT_ID = 'uttsav-dept-google-maps-script';

let googleMapsLoaderPromise = null;

const loadGoogleMapsApi = () => {
  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (!GOOGLE_MAPS_KEY) {
    return Promise.reject(new Error('Google Maps API key is missing in department portal env.'));
  }

  if (!googleMapsLoaderPromise) {
    googleMapsLoaderPromise = new Promise((resolve, reject) => {
      const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID);
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(window.google.maps), { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Maps script.')), {
          once: true,
        });
        return;
      }

      const script = document.createElement('script');
      script.id = GOOGLE_MAPS_SCRIPT_ID;
      script.async = true;
      script.defer = true;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}`;
      script.onload = () => resolve(window.google.maps);
      script.onerror = () => reject(new Error('Failed to load Google Maps script.'));
      document.head.appendChild(script);
    });
  }

  return googleMapsLoaderPromise;
};

const getPinColor = (application) => {
  const status = String(application.departmentStatus || application.overallStatus || '').trim().toLowerCase();
  if (status === 'approved') return '#16A34A';
  if (status === 'rejected') return '#DC2626';
  return '#F59E0B';
};

const getMapApplications = (applications = []) =>
  [...applications]
    .filter((application) => application && application.id)
    .filter((application) => application.overallStatus !== 'Rejected' && application.departmentStatus !== 'Rejected')
    .slice(0, 15);

const toLatLng = (application) => {
  if (!Number.isFinite(application.latitude) || !Number.isFinite(application.longitude)) {
    return null;
  }
  return {
    lat: application.latitude,
    lng: application.longitude,
  };
};

const JurisdictionMapPanel = ({ applications = [] }) => {
  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const markersByIdRef = useRef({});
  const markersRef = useRef([]);
  const infoWindowRef = useRef(null);
  const [mapError, setMapError] = useState('');
  const [selectedId, setSelectedId] = useState('');

  const visibleApplications = useMemo(() => getMapApplications(applications), [applications]);
  const geoApplications = useMemo(
    () => visibleApplications.filter((application) => toLatLng(application)),
    [visibleApplications]
  );

  useEffect(() => {
    let isCancelled = false;

    const renderMap = async () => {
      if (!mapElementRef.current || !geoApplications.length) {
        return;
      }

      try {
        const maps = await loadGoogleMapsApi();
        if (isCancelled || !mapElementRef.current) return;

        const firstPoint = toLatLng(geoApplications[0]) || FALLBACK_CENTER;
        if (!mapRef.current) {
          mapRef.current = new maps.Map(mapElementRef.current, {
            center: firstPoint,
            zoom: 11,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true,
          });
          infoWindowRef.current = new maps.InfoWindow();
        }

        markersRef.current.forEach((marker) => marker.setMap(null));
        markersRef.current = [];
        markersByIdRef.current = {};

        const bounds = new maps.LatLngBounds();
        geoApplications.forEach((application, index) => {
          const point = toLatLng(application);
          if (!point) return;

          const marker = new maps.Marker({
            position: point,
            map: mapRef.current,
            title: application.eventName,
            label: `${(index + 1) % 10}`,
            icon: {
              path: maps.SymbolPath.CIRCLE,
              fillColor: getPinColor(application),
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 1.5,
              scale: 9,
            },
          });

          marker.addListener('click', () => {
            setSelectedId(application.id);
            infoWindowRef.current.setContent(
              `<div style="min-width:180px"><b>${application.eventName}</b><br/>${application.id}<br/>${application.area}, ${application.pincode}</div>`
            );
            infoWindowRef.current.open({
              anchor: marker,
              map: mapRef.current,
            });
          });

          markersByIdRef.current[application.id] = marker;
          markersRef.current.push(marker);
          bounds.extend(point);
        });

        if (geoApplications.length > 1) {
          mapRef.current.fitBounds(bounds, 56);
        } else {
          mapRef.current.setCenter(firstPoint);
          mapRef.current.setZoom(12);
        }

        setMapError('');
      } catch (error) {
        if (!isCancelled) {
          setMapError(error?.message || 'Failed to load interactive map.');
        }
      }
    };

    renderMap();

    return () => {
      isCancelled = true;
    };
  }, [geoApplications]);

  const focusOnApplication = (application) => {
    const marker = markersByIdRef.current[application.id];
    if (!marker || !mapRef.current || !window.google?.maps) {
      return;
    }
    const markerPosition = marker.getPosition();
    if (!markerPosition) return;

    mapRef.current.panTo(markerPosition);
    mapRef.current.setZoom(Math.max(mapRef.current.getZoom() || 11, 13));
    window.google.maps.event.trigger(marker, 'click');
  };

  return (
    <section className="rounded-2xl border border-borderMain bg-cardBg p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />
          <div>
            <h3 className="text-base font-semibold text-textMain">Uttsav Live Map</h3>
            <p className="text-xs text-textSecondary">
              Zoomable map for ongoing and active applications
            </p>
          </div>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          {visibleApplications.length} Active Events
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[230px_1fr]">
        <div className="rounded-2xl border border-borderMain bg-slate-50 p-3">
          <p className="rounded-xl border border-borderMain bg-white px-3 py-2 text-sm font-semibold text-textMain">
            Ongoing Events
          </p>

          <div className="mt-3 max-h-[430px] space-y-2 overflow-y-auto pr-1">
            {visibleApplications.length ? (
              visibleApplications.map((application, index) => (
                <div
                  key={application.id}
                  className={`rounded-xl border bg-white px-3 py-2 text-sm transition ${
                    selectedId === application.id ? 'border-primary/60' : 'border-borderMain'
                  }`}
                >
                  <p className="font-semibold text-textMain">
                    {index + 1}) {application.eventName}
                  </p>
                  <p className="text-xs text-textSecondary">
                    {application.id} | {application.area}, {application.pincode}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => focusOnApplication(application)}
                      className="rounded-lg border border-primary/40 px-2 py-1 text-xs font-semibold text-primary transition hover:bg-primary/10"
                    >
                      Focus
                    </button>
                    <Link
                      to={`/application/${application.id}`}
                      className="rounded-lg border border-borderMain px-2 py-1 text-xs font-semibold text-textMain transition hover:border-primary/40"
                    >
                      Open
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-borderMain bg-white px-3 py-3 text-sm text-textSecondary">
                No ongoing non-rejected applications.
              </div>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-borderMain bg-slate-100">
          {mapError ? (
            <div className="flex h-[430px] items-center justify-center px-4 text-center text-sm text-statusRed">
              {mapError}
            </div>
          ) : geoApplications.length ? (
            <div
              ref={mapElementRef}
              className="h-[430px] w-full"
              aria-label="Interactive jurisdiction map"
            />
          ) : (
            <div className="flex h-[430px] items-center justify-center px-4 text-center text-sm text-textSecondary">
              Map will appear when active applications have coordinates.
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default JurisdictionMapPanel;
