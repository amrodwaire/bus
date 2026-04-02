import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap, useMapEvents } from "react-leaflet";
import { divIcon, latLngBounds } from "leaflet";
import { Bus } from "lucide-react";
import type { Bus as BusType, RouteWaypoint } from "@shared/schema";
import { useLanguage } from "@/lib/language-context";
import "leaflet/dist/leaflet.css";

interface MapViewProps {
  buses: BusType[];
  waypoints?: RouteWaypoint[];
  userLocation?: { lat: number; lng: number } | null;
  onBusClick?: (bus: BusType) => void;
  selectedBusId?: string | null;
  height?: string;
  showUserLocation?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  editableWaypoints?: { lat: number; lng: number }[];
  routeFrom?: { lat: number; lng: number };
  routeTo?: { lat: number; lng: number };
  routeMode?: "from" | "to";
}

function MapController({ center, initialOnly }: { center: { lat: number; lng: number }; initialOnly?: boolean }) {
  const map = useMap();
  const hasCentered = useRef(false);
  useEffect(() => {
    if (initialOnly && hasCentered.current) return;
    map.setView([center.lat, center.lng], map.getZoom());
    hasCentered.current = true;
  }, [center, map, initialOnly]);
  return null;
}

function FitRouteBounds({ from, to }: { from: { lat: number; lng: number }; to: { lat: number; lng: number } }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current) return;
    const bounds = latLngBounds([from.lat, from.lng], [to.lat, to.lng]);
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    fitted.current = true;
  }, [from, to, map]);
  return null;
}

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function createBusIcon(availableSeats: number, isSelected: boolean) {
  const bgColor = availableSeats === 0 ? '#ef4444' : availableSeats <= 3 ? '#eab308' : '#22c55e';
  return divIcon({
    className: 'custom-bus-marker',
    html: `
      <div style="position:relative;width:48px;height:48px;${isSelected ? 'transform:scale(1.2);' : ''}">
        <div style="
          width:48px;height:48px;background:${bgColor};border-radius:8px;
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 4px 6px rgba(0,0,0,0.3);
          ${isSelected ? 'box-shadow:0 0 0 4px rgba(34,197,94,0.5),0 4px 6px rgba(0,0,0,0.3);' : ''}
        ">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/>
            <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/>
            <circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>
          </svg>
        </div>
        <div style="
          position:absolute;top:-8px;right:-8px;width:24px;height:24px;
          background:white;border-radius:50%;display:flex;align-items:center;
          justify-content:center;font-size:12px;font-weight:bold;
          box-shadow:0 2px 4px rgba(0,0,0,0.2);border:1px solid #e5e5e5;
        ">${availableSeats}</div>
      </div>`,
    iconSize: [48, 48],
    iconAnchor: [24, 48],
    popupAnchor: [0, -48],
  });
}

function createWaypointIcon(index: number, isEditable: boolean) {
  const bgColor = isEditable ? '#6366f1' : '#64748b';
  return divIcon({
    className: 'custom-waypoint-marker',
    html: `<div style="
      width:32px;height:32px;background:${bgColor};border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      color:white;font-size:13px;font-weight:bold;
      border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);
    ">${index + 1}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

function createRoutePointIcon(type: "from" | "to") {
  const bgColor = type === "from" ? "#22c55e" : "#ef4444";
  const letter = type === "from" ? "A" : "B";
  return divIcon({
    className: `custom-route-${type}-marker`,
    html: `
      <div style="position:relative;width:40px;height:52px;">
        <svg width="40" height="52" viewBox="0 0 40 52">
          <path d="M20 50 C20 50 38 30 38 18 C38 8 30 1 20 1 C10 1 2 8 2 18 C2 30 20 50 20 50Z"
            fill="${bgColor}" stroke="white" stroke-width="2.5"/>
          <circle cx="20" cy="18" r="11" fill="white" opacity="0.3"/>
        </svg>
        <div style="
          position:absolute;top:6px;left:0;width:40px;text-align:center;
          color:white;font-size:18px;font-weight:900;
          text-shadow:0 1px 3px rgba(0,0,0,0.4);
        ">${letter}</div>
      </div>`,
    iconSize: [40, 52],
    iconAnchor: [20, 52],
    popupAnchor: [0, -52],
  });
}

const userLocationIcon = divIcon({
  className: 'custom-user-marker',
  html: `
    <div style="position:relative;width:22px;height:22px;">
      <div style="
        width:22px;height:22px;
        background:#4285F4;
        border-radius:50%;
        border:3px solid white;
        box-shadow:0 1px 4px rgba(0,0,0,0.4);
      "></div>
    </div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

export function MapView({
  buses,
  waypoints = [],
  userLocation,
  onBusClick,
  selectedBusId,
  height = "400px",
  showUserLocation = true,
  onMapClick,
  editableWaypoints = [],
  routeFrom,
  routeTo,
  routeMode,
}: MapViewProps) {
  const { t } = useLanguage();

  const defaultCenter = { lat: 31.9539, lng: 35.9106 };
  const center = userLocation || defaultCenter;
  const visibleBuses = buses.filter(b => b.isVisible && b.currentLat && b.currentLng);

  const displayWaypoints = editableWaypoints.length > 0 ? editableWaypoints : waypoints;
  const isEditable = editableWaypoints.length > 0;

  const routeMapLabel = routeMode === "from"
    ? t('tapMapForStart')
    : routeMode === "to"
      ? t('tapMapForEnd')
      : onMapClick
        ? t('clickMapToAddStop')
        : null;

  const hasBothRoutePoints = routeFrom && routeTo;

  return (
    <div
      className="relative rounded-xl overflow-hidden shadow-lg border border-border"
      style={{ height, cursor: onMapClick ? 'crosshair' : 'default' }}
    >
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={14}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {hasBothRoutePoints ? (
          <FitRouteBounds from={routeFrom} to={routeTo} />
        ) : (
          <MapController center={center} initialOnly />
        )}

        {onMapClick && <MapClickHandler onMapClick={onMapClick} />}

        {/* User location: pulsating blue ring + solid dot */}
        {showUserLocation && userLocation && (
          <>
            <Circle
              center={[userLocation.lat, userLocation.lng]}
              radius={50}
              pathOptions={{
                fillColor: '#4285F4',
                fillOpacity: 0.1,
                color: '#4285F4',
                weight: 1,
                opacity: 0.3,
              }}
            />
            <Marker position={[userLocation.lat, userLocation.lng]} icon={userLocationIcon}>
              <Popup>
                <div className="text-center font-medium text-sm">{t('yourLocation')}</div>
              </Popup>
            </Marker>
          </>
        )}

        {/* Dashed polyline between from → to */}
        {hasBothRoutePoints && (
          <Polyline
            positions={[
              [routeFrom.lat, routeFrom.lng],
              [routeTo.lat, routeTo.lng],
            ]}
            pathOptions={{
              color: '#4285F4',
              weight: 4,
              opacity: 0.8,
              dashArray: '12, 8',
            }}
          />
        )}

        {/* Route from/to markers */}
        {routeFrom && (
          <Marker position={[routeFrom.lat, routeFrom.lng]} icon={createRoutePointIcon("from")}>
            <Popup><div className="text-center font-bold text-green-600">{t('from')}</div></Popup>
          </Marker>
        )}
        {routeTo && (
          <Marker position={[routeTo.lat, routeTo.lng]} icon={createRoutePointIcon("to")}>
            <Popup><div className="text-center font-bold text-red-600">{t('to')}</div></Popup>
          </Marker>
        )}

        {visibleBuses.map((bus) => {
          const availableSeats = bus.totalCapacity - bus.currentPassengers;
          const isSelected = selectedBusId === bus.id;
          return (
            <Marker
              key={bus.id}
              position={[bus.currentLat!, bus.currentLng!]}
              icon={createBusIcon(availableSeats, isSelected)}
              eventHandlers={{ click: () => onBusClick?.(bus) }}
            >
              <Popup>
                <div className="text-center p-2">
                  <h3 className="font-bold text-base">{bus.routeName}</h3>
                  <p className="text-sm text-gray-600">{bus.plateNumber}</p>
                  <p className="text-sm mt-1">{availableSeats} {t('availableSeats')}</p>
                  {bus.price != null && (
                    <p className="text-sm font-semibold text-green-600 mt-1">{bus.price} {t('jd')}</p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {displayWaypoints.map((wp, index) => (
          <Marker
            key={`wp-${index}`}
            position={[wp.lat, wp.lng]}
            icon={createWaypointIcon(index, isEditable)}
          >
            <Popup>
              <div className="text-center p-1">
                <p className="font-medium">{t('stop')} {index + 1}</p>
                {('name' in wp) && (wp as any).name && (
                  <p className="text-sm text-gray-600">{(wp as any).name}</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
        {showUserLocation && userLocation && !onMapClick && (
          <RecenterButton userLocation={userLocation} />
        )}
      </MapContainer>

      {/* Instruction label overlay */}
      {routeMapLabel && (
        <div className={`absolute top-3 left-1/2 -translate-x-1/2 z-[1000] text-white text-sm font-medium px-4 py-2 rounded-full shadow-lg backdrop-blur-sm ${
          routeMode === "from"
            ? "bg-green-600/90"
            : routeMode === "to"
              ? "bg-red-500/90"
              : "bg-indigo-600/90"
        }`}>
          {routeMapLabel}
        </div>
      )}

      {visibleBuses.length === 0 && !onMapClick && !routeFrom && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-[1000]">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-3">
            <Bus className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">{t('noBusesAvailable')}</p>
          <p className="text-sm text-muted-foreground">{t('busesWillAppear')}</p>
        </div>
      )}
    </div>
  );
}

function RecenterButton({ userLocation }: { userLocation: { lat: number; lng: number } }) {
  const map = useMap();
  return (
    <button
      onClick={() => map.setView([userLocation.lat, userLocation.lng], 15, { animate: true })}
      className="absolute bottom-3 right-3 z-[1000] w-10 h-10 bg-white dark:bg-zinc-800 rounded-full shadow-lg border border-border flex items-center justify-center hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
      data-testid="button-recenter-map"
      title="My location"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
      </svg>
    </button>
  );
}
