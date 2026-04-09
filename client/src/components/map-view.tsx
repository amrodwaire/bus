import { useEffect, useRef, useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap, useMapEvents } from "react-leaflet";
import { divIcon, latLngBounds, DomEvent, Map as LeafletMap } from "leaflet";
import { Bus, Search, X, MapPin } from "lucide-react";
import type { Bus as BusType, RouteWaypoint } from "@shared/schema";
import { useLanguage } from "@/lib/language-context";
import "leaflet/dist/leaflet.css";

export interface PassengerPickup {
    lat: number;
    lng: number;
    priority: number;
    name?: string | null;
    phone?: string | null;
}

export interface CitizenMarker {
    userId: string;
    name: string;
    lat: number;
    lng: number;
}

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
    routePath?: [number, number][];
    routeDistanceKm?: number;
    routeDurationMin?: number;
    passengerPickups?: PassengerPickup[];
    reservedBusId?: string | null;
    showHiddenBuses?: boolean;
    walkingPath?: [number, number][];
    citizenMarkers?: CitizenMarker[];
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

function createBusIcon(availableSeats: number, isSelected: boolean, speed?: number | null) {
    const bgColor = availableSeats === 0 ? '#ef4444' : availableSeats <= 3 ? '#eab308' : '#22c55e';
    const speedBadge = speed != null && speed > 0
        ? `<div style="
        position:absolute;top:-10px;left:-14px;
        background:#1a73e8;color:white;font-size:9px;font-weight:bold;
        padding:2px 5px;border-radius:8px;white-space:nowrap;
        box-shadow:0 1px 3px rgba(0,0,0,0.3);border:1.5px solid white;
        line-height:1.1;z-index:2;
      ">${speed}<span style="font-size:7px;margin-inline-start:1px">km/h</span></div>`
        : '';
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
          box-shadow:0 2px 4px rgba(0,0,0,0.2);border:1px solid #e5e5e5;z-index:1;
        ">${availableSeats}</div>
        ${speedBadge}
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

function createReservedBusIcon(availableSeats: number) {
    const bgColor = availableSeats === 0 ? '#ef4444' : availableSeats <= 3 ? '#eab308' : '#22c55e';
    return divIcon({
        className: 'custom-bus-reserved-marker',
        html: `
      <div style="position:relative;width:56px;height:56px;">
        <div style="
          width:56px;height:56px;background:${bgColor};border-radius:10px;
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 0 0 4px rgba(99,102,241,0.6),0 0 0 8px rgba(99,102,241,0.2),0 4px 8px rgba(0,0,0,0.35);
        ">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/>
            <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/>
            <circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>
          </svg>
        </div>
        <div style="
          position:absolute;top:-10px;right:-10px;width:22px;height:22px;
          background:#6366f1;border-radius:50%;display:flex;align-items:center;
          justify-content:center;font-size:13px;border:2px solid white;
          box-shadow:0 2px 4px rgba(0,0,0,0.3);
        ">✓</div>
      </div>`,
        iconSize: [56, 56],
        iconAnchor: [28, 56],
        popupAnchor: [0, -56],
    });
}

function createPassengerPickupIcon(priority: number) {
    return divIcon({
        className: 'custom-passenger-marker',
        html: `
      <div style="position:relative;width:36px;height:44px;">
        <svg width="36" height="44" viewBox="0 0 36 44">
          <path d="M18 42 C18 42 34 27 34 16 C34 7 27 1 18 1 C9 1 2 7 2 16 C2 27 18 42 18 42Z"
            fill="#f97316" stroke="white" stroke-width="2.5"/>
          <circle cx="18" cy="15" r="7" fill="white" opacity="0.9"/>
        </svg>
        <div style="
          position:absolute;top:7px;left:0;width:36px;text-align:center;
          color:#f97316;font-size:13px;font-weight:900;
        ">${priority}</div>
      </div>`,
        iconSize: [36, 44],
        iconAnchor: [18, 44],
        popupAnchor: [0, -44],
    });
}

function createCitizenLocationIcon(name: string) {
    return divIcon({
        className: 'custom-citizen-marker',
        html: `
      <div style="position:relative;width:30px;height:30px;">
        <div style="
          width:30px;height:30px;background:#f97316;border-radius:50%;
          border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);
          display:flex;align-items:center;justify-content:center;
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="none">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
      </div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -18],
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
    routePath,
    routeDistanceKm,
    routeDurationMin,
    passengerPickups = [],
    reservedBusId = null,
    showHiddenBuses = false,
    walkingPath,
    citizenMarkers = [],
}: MapViewProps) {
    const { t, isRTL } = useLanguage();

    const defaultCenter = { lat: 31.9539, lng: 35.9106 };
    const center = userLocation || defaultCenter;
    const visibleBuses = buses.filter(b => (showHiddenBuses || b.isVisible) && b.currentLat && b.currentLng);

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
    const mapRef = useRef<LeafletMap | null>(null);

    return (
        <div
            className="relative rounded-xl overflow-hidden shadow-lg border border-border isolate"
            style={{ height, cursor: onMapClick ? 'crosshair' : 'default' }}
        >
            <MapContainer
                center={[center.lat, center.lng]}
                zoom={14}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
                ref={mapRef}
            >
                <TileLayer
                    attribution='&copy; <a href="https://carto.com/">carto.com</a> contributors'
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                />

                {hasBothRoutePoints ? (
                    <FitRouteBounds from={routeFrom} to={routeTo} />
                ) : (
                    <MapController center={center} initialOnly />
                )}

                {onMapClick && <MapClickHandler onMapClick={onMapClick} />}

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

                {routePath && routePath.length > 0 && (
                    <>
                        <Polyline
                            positions={routePath}
                            pathOptions={{
                                color: '#1a73e8',
                                weight: 6,
                                opacity: 0.15,
                            }}
                        />
                        <Polyline
                            positions={routePath}
                            pathOptions={{
                                color: '#4285F4',
                                weight: 4,
                                opacity: 0.9,
                            }}
                        />
                    </>
                )}

                {hasBothRoutePoints && !routePath && (
                    <Polyline
                        positions={[
                            [routeFrom.lat, routeFrom.lng],
                            [routeTo.lat, routeTo.lng],
                        ]}
                        pathOptions={{
                            color: '#4285F4',
                            weight: 4,
                            opacity: 0.5,
                            dashArray: '12, 8',
                        }}
                    />
                )}

                {walkingPath && walkingPath.length > 0 && (
                    <Polyline
                        positions={walkingPath}
                        pathOptions={{
                            color: '#f97316',
                            weight: 4,
                            opacity: 0.8,
                            dashArray: '8, 6',
                        }}
                    />
                )}

                {citizenMarkers.map((cm) => (
                    <Marker
                        key={`citizen-${cm.userId}`}
                        position={[cm.lat, cm.lng]}
                        icon={createCitizenLocationIcon(cm.name)}
                    >
                        <Popup>
                            <div className="text-center p-1 min-w-[100px]">
                                <p className="font-bold text-orange-600 text-sm">{cm.name}</p>
                                <p className="text-xs text-gray-500">{t('citizenLocation')}</p>
                            </div>
                        </Popup>
                    </Marker>
                ))}

                {passengerPickups.map((pickup, i) => (
                    <Marker
                        key={`pickup-${i}`}
                        position={[pickup.lat, pickup.lng]}
                        icon={createPassengerPickupIcon(pickup.priority)}
                    >
                        <Popup>
                            <div className="p-1 text-center min-w-[120px]">
                                <p className="font-bold text-orange-600">{t('passenger')} #{pickup.priority}</p>
                                {pickup.name && <p className="text-sm mt-0.5">{pickup.name}</p>}
                                {pickup.phone && <p className="text-xs text-gray-500 mt-0.5">{pickup.phone}</p>}
                                <p className="text-xs text-gray-400 mt-1 font-mono">{pickup.lat.toFixed(4)}, {pickup.lng.toFixed(4)}</p>
                            </div>
                        </Popup>
                    </Marker>
                ))}

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
                    const isReserved = reservedBusId === bus.id;
                    return (
                        <Marker
                            key={bus.id}
                            position={[bus.currentLat!, bus.currentLng!]}
                            icon={isReserved
                                ? createReservedBusIcon(availableSeats)
                                : createBusIcon(availableSeats, isSelected, bus.speed)
                            }
                            eventHandlers={{ click: () => onBusClick?.(bus) }}
                            zIndexOffset={isReserved ? 1000 : 0}
                        >
                            <Popup>
                                <div className="text-center p-2 min-w-[140px]">
                                    {isReserved && (
                                        <div className="text-xs font-bold text-indigo-600 bg-indigo-50 rounded px-2 py-1 mb-2">
                                            ✓ {t('yourReservedBus')}
                                        </div>
                                    )}
                                    <h3 className="font-bold text-base">{bus.routeName}</h3>
                                    <p className="text-sm text-gray-600">{bus.plateNumber}</p>
                                    <p className="text-sm mt-1">{availableSeats} {t('availableSeats')}</p>
                                    {bus.price != null && (
                                        <p className="text-sm font-semibold text-green-600 mt-1">{bus.price} {t('jd')}</p>
                                    )}
                                    {bus.speed != null && bus.speed > 0 && (
                                        <p className="text-xs text-blue-600 font-semibold mt-1">{bus.speed} {t('kmh')}</p>
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
                {showUserLocation && userLocation && (
                    <RecenterButton userLocation={userLocation} />
                )}
            </MapContainer>

            <MapSearchOverlay isRTL={isRTL} mapRef={mapRef} />

            {routeMapLabel && (
                <div className={`absolute top-3 left-1/2 -translate-x-1/2 z-[1000] text-white text-sm font-medium px-4 py-2 rounded-full shadow-lg backdrop-blur-sm ${routeMode === "from"
                        ? "bg-green-600/90"
                        : routeMode === "to"
                            ? "bg-red-500/90"
                            : "bg-indigo-600/90"
                    }`}>
                    {routeMapLabel}
                </div>
            )}

            {routeDistanceKm != null && routeDurationMin != null && !routeMode && (
                <div className="absolute bottom-3 start-3 z-[1000] bg-white dark:bg-zinc-800 text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg border border-border flex items-center gap-2" data-testid="badge-route-info">
                    <span className="text-blue-600 dark:text-blue-400">{routeDistanceKm} {t('km')}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">{routeDurationMin} {t('min')}</span>
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

interface SearchResult {
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
}

function MapSearchOverlay({ isRTL, mapRef }: { isRTL: boolean; mapRef: React.RefObject<LeafletMap | null> }) {
    const { t } = useLanguage();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>();
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // تحديث الرابط الحقيقي تبعك 100%
    const SERVER_URL = import.meta.env.VITE_API_URL || "https://bus-p4kg.onrender.com";

    const searchNominatim = useCallback(async (q: string) => {
        if (q.trim().length < 2) {
            setResults([]);
            setIsOpen(false);
            return;
        }
        setLoading(true);
        setIsOpen(true);

        try {
            const lang = isRTL ? "ar" : "en";

            const url = `${SERVER_URL}/api/search/location?q=${encodeURIComponent(q)}&lang=${lang}`;

            const res = await fetch(url);

            if (res.ok) {
                const data: SearchResult[] = await res.json();
                setResults(data);
            } else {
                setResults([]);
            }
        } catch (error) {
            console.error("Search API Error:", error);
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, [isRTL]);

    const handleInput = (val: string) => {
        setQuery(val);
        if (val.trim().length < 2) {
            setResults([]);
            setIsOpen(false);
            return;
        }
        setIsOpen(true);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => searchNominatim(val), 500);
    };

    const selectResult = (r: SearchResult) => {
        const lat = parseFloat(r.lat);
        const lng = parseFloat(r.lon);
        setQuery(r.display_name.split(",")[0]);
        setIsOpen(false);
        setResults([]);
        inputRef.current?.blur();

        if (mapRef.current) {
            mapRef.current.setView([lat, lng], 16, { animate: true });
        }
    };

    const clear = () => {
        setQuery("");
        setResults([]);
        setIsOpen(false);
    };

    useEffect(() => {
        const handler = (e: MouseEvent | TouchEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        document.addEventListener("touchstart", handler);
        return () => {
            document.removeEventListener("mousedown", handler);
            document.removeEventListener("touchstart", handler);
        };
    }, []);

    const stopPropagation = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
    }, []);

    return (
        <div
            ref={containerRef}
            className="absolute top-3 left-3 right-3 z-[1002]"
            style={{ direction: isRTL ? "rtl" : "ltr" }}
            onMouseDown={stopPropagation}
            onTouchStart={stopPropagation}
            onClick={stopPropagation}
        >
            <div className="relative">
                <div className="flex items-center bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-border overflow-hidden relative z-10">
                    <Search className="h-4 w-4 text-muted-foreground mx-3 flex-shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => handleInput(e.target.value)}
                        onFocus={() => { if (query.trim().length >= 2) setIsOpen(true); }}
                        placeholder={t('searchLocation')}
                        className="flex-1 py-2.5 bg-transparent text-sm outline-none placeholder:text-muted-foreground w-full"
                        data-testid="input-map-search"
                    />
                    {query && (
                        <button onClick={clear} className="px-3 py-2 text-muted-foreground hover:text-foreground h-full flex items-center justify-center" data-testid="button-clear-search">
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {isOpen && query.length >= 2 && (
                    <div className="absolute w-full top-full left-0 mt-1 bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-border overflow-hidden max-h-60 overflow-y-auto z-20">
                        {loading ? (
                            <div className="px-4 py-4 text-sm text-muted-foreground text-center flex items-center justify-center gap-2">
                                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                {t('searching')}...
                            </div>
                        ) : results.length === 0 ? (
                            <div className="px-4 py-4 text-sm text-muted-foreground text-center">
                                لا توجد نتائج لـ "{query}"
                            </div>
                        ) : (
                            results.map((r) => (
                                <button
                                    key={r.place_id}
                                    onClick={() => selectResult(r)}
                                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/50 text-start transition-colors border-b border-border last:border-0"
                                    data-testid={`search-result-${r.place_id}`}
                                >
                                    <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                                    <span className="text-sm line-clamp-2">{r.display_name}</span>
                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function RecenterButton({ userLocation }: { userLocation: { lat: number; lng: number } }) {
    const map = useMap();
    const { t } = useLanguage();
    return (
        <button
            onClick={() => map.setView([userLocation.lat, userLocation.lng], 17, { animate: true })}
            className="absolute bottom-5 end-3 z-[1000] bg-white dark:bg-zinc-800 rounded-full shadow-xl border-2 border-blue-400 flex items-center gap-2 px-3 py-2 hover:bg-blue-50 dark:hover:bg-zinc-700 active:scale-95 transition-all"
            data-testid="button-recenter-map"
            title={t('myLocation')}
            style={{ minWidth: 44 }}
        >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" fill="#3b82f6" fillOpacity="0.25" />
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
            </svg>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">{t('myLocation')}</span>
        </button>
    );
}