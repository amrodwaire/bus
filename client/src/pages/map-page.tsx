import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bus, MapPin, X, Check, AlertCircle, Navigation2, Filter, ShieldCheck, ShieldAlert, ShieldX, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { MapView, type PassengerPickup } from "@/components/map-view";
import { BusCard } from "@/components/bus-card";
import { BottomNav } from "@/components/bottom-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { LoadingSpinner } from "@/components/loading-spinner";
import { apiRequest } from "@/lib/queryClient";
import { detectGovernorate, getGovernorateName, governorateNames } from "@/lib/governorate-utils";
import { getRouteOnRoad, getWalkingRoute, findNearestWaypoint, isNearRoute, hasBusPassed, getDistanceMeters, type RouteResult } from "@/lib/routing-service";
import type { Bus as BusType, Governorate, RouteWaypoint } from "@shared/schema";

interface RoutePoint {
    lat: number;
    lng: number;
    gov: Governorate;
}

export default function MapPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const { t, language } = useLanguage();
    const queryClient = useQueryClient();

    const [selectedBus, setSelectedBus] = useState<BusType | null>(null);
    const [showReservationDialog, setShowReservationDialog] = useState(false);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [userGovernorate, setUserGovernorate] = useState<Governorate>("amman");
    const autoCancelledRef = useRef(false);
    const gpsReadyRef = useRef(false);

    const [routeStep, setRouteStep] = useState<0 | 1 | 2>(0);
    const [fromPoint, setFromPoint] = useState<RoutePoint | null>(null);
    const [toPoint, setToPoint] = useState<RoutePoint | null>(null);
    const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
    const [walkingPath, setWalkingPath] = useState<[number, number][] | undefined>(undefined);
    const [walkingInfo, setWalkingInfo] = useState<{ distanceKm: number; durationMin: number } | null>(null);
    const busApproachNotifiedRef = useRef<string | null>(null);
    const citizenLocationSentRef = useRef(0);

    const { data: buses = [], isLoading } = useQuery<BusType[]>({
        queryKey: ["/api/buses"],
    });

    const routeIsSet = fromPoint !== null && toPoint !== null;

    // Fetch all bus routes (waypoints) — only when citizen has set their route
    const { data: allBusRoutes = {} } = useQuery<Record<string, RouteWaypoint[]>>({
        queryKey: ["/api/routes"],
        enabled: routeIsSet,
        refetchInterval: 15000,
    });

    const { data: activeReservation } = useQuery({
        queryKey: ["/api/reservations/user", user?.id, "active"],
        queryFn: async () => {
            const response = await apiRequest("GET", `/api/reservations/user/${user?.id}/active`);
            return response.json();
        },
        enabled: !!user?.id && user?.role === "citizen",
    });

    // ============ TRAFFIC ALERTS INTEGRATION ============
    const { data: trafficAlerts = [] } = useQuery<any[]>({
        queryKey: ["/api/traffic-alerts"],
        refetchInterval: 5000, // تحديث الخريطة بالبلاغات كل 5 ثواني
    });

    // تحويل البلاغات لعلامات (Markers) جاهزة للخريطة
    const alertMarkers = useMemo(() => {
        return trafficAlerts.map((alert: any) => ({
            userId: alert.id, // استخدام ID البلاغ
            name: alert.type === 'road_closed' ? '⛔ طريق مغلق (تنبيه)' : '🚗 أزمة مرورية (تنبيه)',
            lat: alert.lat,
            lng: alert.lng
        }));
    }, [trafficAlerts]);
    // ====================================================

    const hasActiveReservation = !!activeReservation;

    useEffect(() => {
        if (!navigator.geolocation) {
            setUserLocation({ lat: 31.9539, lng: 35.9106 });
            setUserGovernorate("amman");
            return;
        }
        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
                setUserLocation(loc);
                gpsReadyRef.current = true;
                const gov = detectGovernorate(loc.lat, loc.lng);
                if (gov) setUserGovernorate(gov);
            },
            () => {
                setUserLocation({ lat: 31.9539, lng: 35.9106 });
                setUserGovernorate("amman");
            },
            { enableHighAccuracy: true, maximumAge: 5000 }
        );
        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    const cancelMutation = useMutation({
        mutationFn: async ({ reservationId }: { reservationId: string; isAuto?: boolean }) => {
            return apiRequest("PATCH", `/api/reservations/${reservationId}`, {
                status: "cancelled",
            });
        },
        onSuccess: (_, { isAuto }) => {
            if (isAuto) {
                toast({
                    title: t('autoCancelTitle'),
                    description: t('autoCancelDesc'),
                    variant: "destructive",
                });
            } else {
                toast({ title: t('reservationCancelled'), description: t('reservationCancelledDesc') });
            }
            queryClient.invalidateQueries({ queryKey: ["/api/buses"] });
            queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
            queryClient.invalidateQueries({ queryKey: ["/api/reservations/user", user?.id, "active"] });
        },
        onError: () => {
            toast({ title: t('error'), description: t('cancelFailed'), variant: "destructive" });
        },
    });

    useEffect(() => {
        if (!userLocation || !activeReservation || autoCancelledRef.current) return;
        if (!gpsReadyRef.current) return;
        if (!activeReservation.pickupLat || !activeReservation.pickupLng) return;

        const dist = getDistanceMeters(
            userLocation.lat, userLocation.lng,
            activeReservation.pickupLat, activeReservation.pickupLng
        );

        if (dist > 100) {
            autoCancelledRef.current = true;
            cancelMutation.mutate({ reservationId: activeReservation.id, isAuto: true });
        }
    }, [userLocation, activeReservation]);

    useEffect(() => {
        autoCancelledRef.current = false;
        busApproachNotifiedRef.current = null;
    }, [activeReservation?.id]);

    useEffect(() => {
        if (!userLocation || !user?.id || user.role !== "citizen") return;
        if (!hasActiveReservation) return;
        const now = Date.now();
        if (now - citizenLocationSentRef.current < 10000) return;
        citizenLocationSentRef.current = now;
        apiRequest("POST", "/api/citizen/location", {
            userId: user.id,
            lat: userLocation.lat,
            lng: userLocation.lng,
        }).catch(() => { });
    }, [userLocation, user?.id, hasActiveReservation]);

    useEffect(() => {
        if (!userLocation || !hasActiveReservation || !activeReservation?.busId) return;
        const reservedBus = buses.find(b => b.id === activeReservation.busId);
        if (!reservedBus?.currentLat || !reservedBus?.currentLng) return;
        const dist = getDistanceMeters(
            userLocation.lat, userLocation.lng,
            reservedBus.currentLat, reservedBus.currentLng
        );
        if (dist < 500 && busApproachNotifiedRef.current !== reservedBus.id) {
            busApproachNotifiedRef.current = reservedBus.id;
            toast({
                title: t('busApproaching'),
                description: t('busApproachingDesc'),
            });
        }
    }, [userLocation, buses, activeReservation]);

    useEffect(() => {
        if (!fromPoint || !hasActiveReservation || !activeReservation?.busId) return;
        const busWaypoints = allBusRoutes[activeReservation.busId];
        if (!busWaypoints || busWaypoints.length === 0) {
            setWalkingPath(undefined);
            setWalkingInfo(null);
            return;
        }
        const nearest = findNearestWaypoint(fromPoint, busWaypoints.map(wp => ({ lat: wp.lat, lng: wp.lng })));
        if (!nearest || nearest.distanceM < 100) {
            setWalkingPath(undefined);
            setWalkingInfo(null);
            return;
        }
        getWalkingRoute(fromPoint, nearest).then(result => {
            if (result) {
                setWalkingPath(result.coordinates);
                setWalkingInfo({ distanceKm: result.distanceKm, durationMin: result.durationMin });
            } else {
                setWalkingPath(undefined);
                setWalkingInfo(null);
            }
        }).catch(() => {
            setWalkingPath(undefined);
            setWalkingInfo(null);
        });
    }, [fromPoint, activeReservation?.busId, allBusRoutes]);

    const reserveMutation = useMutation({
        mutationFn: async (busId: string) => {
            return apiRequest("POST", "/api/reservations", {
                busId,
                passengerId: user?.id,
                pickupLat: userLocation?.lat || 31.9539,
                pickupLng: userLocation?.lng || 35.9106,
            });
        },
        onSuccess: () => {
            toast({ title: t('reservationConfirmed'), description: t('seatReserved') });
            queryClient.invalidateQueries({ queryKey: ["/api/buses"] });
            queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
            queryClient.invalidateQueries({ queryKey: ["/api/reservations/user", user?.id, "active"] });
            setShowReservationDialog(false);
            setSelectedBus(null);
        },
        onError: (error: Error) => {
            toast({
                title: t('reservationFailed'),
                description: error.message || t('reservationError'),
                variant: "destructive",
            });
        },
    });

    const handleBusClick = (bus: BusType) => { setSelectedBus(bus); };
    const handleReserve = (bus: BusType) => {
        if (!fromPoint || !toPoint) {
            toast({
                title: t('routeRequiredTitle'),
                description: t('routeRequiredDesc'),
                variant: "destructive",
            });
            return;
        }
        setSelectedBus(bus);
        setShowReservationDialog(true);
    };
    const confirmReservation = () => { if (selectedBus && user) reserveMutation.mutate(selectedBus.id); };

    const handleMapClick = async (lat: number, lng: number) => {
        if (routeStep === 1) {
            if (userLocation) {
                const distFromUser = getDistanceMeters(userLocation.lat, userLocation.lng, lat, lng);
                if (distFromUser > 500) {
                    toast({
                        title: t('fromPointTooFar'),
                        description: t('fromPointTooFarDesc'),
                        variant: "destructive",
                    });
                    return;
                }
            }

            const clickedGov = detectGovernorate(lat, lng) ?? "amman";
            setFromPoint({ lat, lng, gov: clickedGov });
            setRouteStep(2);
        } else if (routeStep === 2) {
            if (fromPoint) {
                const distFromStart = getDistanceMeters(fromPoint.lat, fromPoint.lng, lat, lng);
                if (distFromStart < 300) {
                    toast({
                        title: t('toPointTooClose'),
                        description: t('toPointTooCloseDesc'),
                        variant: "destructive",
                    });
                    return;
                }
            }

            const clickedGov = detectGovernorate(lat, lng) ?? "amman";
            const newTo = { lat, lng, gov: clickedGov };
            setToPoint(newTo);
            setRouteStep(0);
            if (fromPoint) {
                const result = await getRouteOnRoad(fromPoint, newTo);
                if (result) {
                    setRouteResult(result);
                    if (result.roadStatus === "blocked") {
                        toast({ title: t('roadBlocked'), description: t('roadBlockedDesc'), variant: "destructive" });
                    } else if (result.roadStatus === "detour") {
                        toast({
                            title: t('roadDetour'),
                            description: t('roadDetourDesc').replace('{ratio}', String(result.detourRatio || '')),
                        });
                    }
                } else {
                    setRouteResult(null);
                    toast({ title: t('roadBlocked'), description: t('roadBlockedDesc'), variant: "destructive" });
                }
            }
        }
    };

    const computeETA = useCallback((bus: BusType): number | null => {
        if (!userLocation || !bus.currentLat || !bus.currentLng) return null;
        const dist = getDistanceMeters(userLocation.lat, userLocation.lng, bus.currentLat, bus.currentLng);
        const distKm = dist / 1000;
        const speed = bus.speed && bus.speed > 0 ? bus.speed : 40;
        const etaMin = Math.round((distKm / speed) * 60);
        return etaMin > 0 ? etaMin : 1;
    }, [userLocation]);

    const computeDistKm = useCallback((bus: BusType): number | null => {
        if (!userLocation || !bus.currentLat || !bus.currentLng) return null;
        const dist = getDistanceMeters(userLocation.lat, userLocation.lng, bus.currentLat, bus.currentLng);
        return Math.round((dist / 1000) * 10) / 10;
    }, [userLocation]);

    const handleClearRoute = () => {
        setFromPoint(null);
        setToPoint(null);
        setRouteResult(null);
        setRouteStep(0);
        setWalkingPath(undefined);
        setWalkingInfo(null);
    };

    const handleStartSetting = () => {
        setFromPoint(null);
        setToPoint(null);
        setRouteResult(null);
        setRouteStep(1);
    };

    const busRouteMatchesCitizenRoute = (busId: string, citizenPath: [number, number][] | { lat: number; lng: number }[]): boolean => {
        const waypoints = allBusRoutes[busId];
        if (!waypoints || waypoints.length === 0) return false;
        return waypoints.some(wp =>
            isNearRoute({ lat: wp.lat, lng: wp.lng }, citizenPath, 1500)
        );
    };

    const filteredBuses = useMemo(() => {
        return buses.filter(b => {
            if (!b.isVisible) return false;

            if (routeIsSet && fromPoint && toPoint) {
                const busLat = b.currentLat;
                const busLng = b.currentLng;
                if (!busLat || !busLng) return false;

                const busWaypoints = allBusRoutes[b.id];
                const hasDriverRoute = busWaypoints && busWaypoints.length > 0;

                if (hasDriverRoute && routeResult) {
                    const routeOverlaps = busRouteMatchesCitizenRoute(b.id, routeResult.coordinates);
                    if (!routeOverlaps) return false;
                } else {
                    const destGov = b.destinationGovernorate as Governorate | null;
                    const headingToDestination = destGov === toPoint.gov;
                    const nearRoute = routeResult && isNearRoute(
                        { lat: busLat, lng: busLng },
                        routeResult.coordinates,
                        3000
                    );
                    if (!headingToDestination && !nearRoute) return false;
                }

                if (userLocation && hasBusPassed(
                    { lat: busLat, lng: busLng },
                    userLocation,
                    fromPoint,
                    toPoint
                )) {
                    return false;
                }

                return true;
            }

            return false;
        });
    }, [buses, userGovernorate, fromPoint, toPoint, routeIsSet, routeResult, userLocation, allBusRoutes]);

    const getDisplayRouteName = (bus: BusType) => {
        return language === "en" && bus.routeNameEn ? bus.routeNameEn : bus.routeName;
    };

    const getGovLabel = (gov: string) => {
        const entry = governorateNames[gov as Governorate];
        if (!entry) return gov;
        return language === "en" ? entry.en : entry.ar;
    };

    const citizenPickupMarker: PassengerPickup[] = hasActiveReservation && activeReservation?.pickupLat
        ? [{
            lat: activeReservation.pickupLat,
            lng: activeReservation.pickupLng,
            priority: 1,
            name: t('yourPickupPoint'),
        }]
        : [];

    const routeLabel = routeIsSet && fromPoint && toPoint
        ? `${getGovLabel(fromPoint.gov)} → ${getGovLabel(toPoint.gov)}`
        : null;

    return (
        <div className="min-h-screen bg-background pb-20">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
                <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                            <Bus className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <div>
                            <h1 className="font-bold text-lg">{t('appName')}</h1>
                            <p className="text-xs text-muted-foreground">
                                {routeLabel ?? t('availableBuses')}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="gap-1" data-testid="badge-governorate">
                            <MapPin className="h-3 w-3" />
                            {getGovernorateName(userGovernorate, language)}
                        </Badge>
                        <LanguageToggle />
                        <ThemeToggle />
                    </div>
                </div>
            </header>

            {/* Trip Route Selector (Citizens only) */}
            {user?.role === "citizen" && (
                <section className="px-4 pt-4">
                    <Card className="p-3">
                        {/* Idle — no route set */}
                        {!routeIsSet && routeStep === 0 && (
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="font-semibold text-sm flex items-center gap-2">
                                        <Navigation2 className="h-4 w-4 text-primary" />
                                        {t('setTripRoute')}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{t('clickMapToSetRoute')}</p>
                                </div>
                                <Button size="sm" onClick={handleStartSetting} data-testid="button-start-route">
                                    {t('setRoute')}
                                </Button>
                            </div>
                        )}

                        {/* Step 1 — picking from */}
                        {routeStep === 1 && (
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">A</div>
                                <p className="text-sm font-medium flex-1">{t('tapMapForStart')}</p>
                                <Button size="icon" variant="ghost" onClick={() => setRouteStep(0)} data-testid="button-cancel-route-step">
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        )}

                        {/* Step 2 — from is set, picking to */}
                        {routeStep === 2 && fromPoint && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">A</div>
                                    <span className="text-sm font-medium">{getGovLabel(fromPoint.gov)}</span>
                                    <Button size="icon" variant="ghost" className="h-6 w-6 ms-auto" onClick={() => { setFromPoint(null); setRouteStep(1); }}>
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">B</div>
                                    <span className="text-sm text-muted-foreground">{t('tapMapForEnd')}</span>
                                </div>
                            </div>
                        )}

                        {/* Done — both points set */}
                        {routeIsSet && fromPoint && toPoint && routeStep === 0 && (
                            <div className="flex items-center justify-between gap-3">
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">A</div>
                                        <span className="text-sm font-semibold">{getGovLabel(fromPoint.gov)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">B</div>
                                        <span className="text-sm font-semibold">{getGovLabel(toPoint.gov)}</span>
                                    </div>
                                    {routeResult && (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground ps-8">
                                            <span className="text-blue-600 dark:text-blue-400 font-semibold">{routeResult.distanceKm} {t('km')}</span>
                                            <span>·</span>
                                            <span>{routeResult.durationMin} {t('min')}</span>
                                        </div>
                                    )}
                                </div>
                                {!hasActiveReservation && (
                                    <Button size="sm" variant="outline" onClick={handleClearRoute} data-testid="button-clear-route" className="gap-1">
                                        <X className="h-3.5 w-3.5" />
                                        {t('clearRoute')}
                                    </Button>
                                )}
                            </div>
                        )}
                    </Card>
                </section>
            )}

            {/* Map Section */}
            <section className="p-4 relative z-0">
                <MapView
                    buses={(() => {
                        if (!activeReservation?.busId) return filteredBuses;
                        const alreadyIncluded = filteredBuses.some(b => b.id === activeReservation.busId);
                        if (alreadyIncluded) return filteredBuses;
                        const reservedBus = buses.find(b => b.id === activeReservation.busId);
                        return reservedBus ? [...filteredBuses, reservedBus] : filteredBuses;
                    })()}
                    userLocation={userLocation}
                    onBusClick={routeStep === 0 ? handleBusClick : undefined}
                    selectedBusId={selectedBus?.id}
                    height="350px"
                    onMapClick={routeStep > 0 ? handleMapClick : undefined}
                    routeFrom={fromPoint ?? undefined}
                    routeTo={toPoint ?? undefined}
                    routeMode={routeStep === 1 ? "from" : routeStep === 2 ? "to" : undefined}
                    routePath={routeResult?.coordinates}
                    routeDistanceKm={routeResult?.distanceKm}
                    routeDurationMin={routeResult?.durationMin}
                    passengerPickups={citizenPickupMarker}
                    reservedBusId={activeReservation?.busId}
                    walkingPath={walkingPath}
                    // تمرير بلاغات المرور ليتم رسمها على الخريطة
                    citizenMarkers={alertMarkers}
                />
            </section>

            {/* Road Status Banner */}
            {routeResult && routeIsSet && (
                <section className="px-4 pb-2">
                    {routeResult.roadStatus === "blocked" ? (
                        <Card className="p-3 border-red-500/40 bg-red-500/10" data-testid="banner-road-blocked">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center flex-shrink-0">
                                    <ShieldX className="h-4 w-4" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-red-800 dark:text-red-300">{t('roadBlocked')}</p>
                                    <p className="text-xs text-red-600 dark:text-red-400">{t('roadBlockedDesc')}</p>
                                </div>
                            </div>
                        </Card>
                    ) : routeResult.roadStatus === "detour" ? (
                        <Card className="p-3 border-yellow-500/40 bg-yellow-500/10" data-testid="banner-road-detour">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-yellow-500 text-white flex items-center justify-center flex-shrink-0">
                                    <ShieldAlert className="h-4 w-4" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">{t('roadDetour')}</p>
                                    <p className="text-xs text-yellow-600 dark:text-yellow-400">
                                        {t('roadDetourDesc').replace('{ratio}', String(routeResult.detourRatio || ''))}
                                    </p>
                                </div>
                            </div>
                        </Card>
                    ) : (
                        <Card className="p-3 border-green-500/40 bg-green-500/10" data-testid="banner-road-clear">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center flex-shrink-0">
                                    <ShieldCheck className="h-4 w-4" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-green-800 dark:text-green-300">{t('roadClear')}</p>
                                    <p className="text-xs text-green-600 dark:text-green-400">{t('roadClearDesc')}</p>
                                </div>
                            </div>
                        </Card>
                    )}
                </section>
            )}

            {/* Walking route info */}
            {walkingInfo && hasActiveReservation && (
                <section className="px-4 pb-2">
                    <Card className="p-3 border-orange-500/40 bg-orange-500/10">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center flex-shrink-0">
                                <Navigation2 className="h-4 w-4" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">{t('walkToStop')}</p>
                                <p className="text-xs text-orange-600 dark:text-orange-400">
                                    {walkingInfo.distanceKm} {t('km')} · {walkingInfo.durationMin} {t('walkMin')}
                                </p>
                            </div>
                        </div>
                    </Card>
                </section>
            )}

            {/* Active Reservation Notice + Cancel */}
            {hasActiveReservation && user?.role === "citizen" && (
                <section className="px-4 pb-2">
                    <Card className="p-3 border-yellow-500/40 bg-yellow-500/10">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">{t('hasActiveReservationNotice')}</p>
                            </div>
                            <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => activeReservation?.id && cancelMutation.mutate({ reservationId: activeReservation.id })}
                                disabled={cancelMutation.isPending}
                                data-testid="button-cancel-active-reservation"
                                className="flex-shrink-0"
                            >
                                {cancelMutation.isPending ? t('processing') : t('cancelBooking')}
                            </Button>
                        </div>
                    </Card>
                </section>
            )}

            {/* Bus List Section */}
            <section className="px-4">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-lg">
                        {routeIsSet ? t('showingBusesOn') : t('nearbyBuses')}
                    </h2>
                    <Badge variant="outline">{filteredBuses.length} {t('bus')}</Badge>
                </div>

                {isLoading ? (
                    <LoadingSpinner />
                ) : !routeIsSet && !hasActiveReservation ? (
                    <Card className="p-8 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                            <Navigation2 className="h-8 w-8 text-primary" />
                        </div>
                        <h3 className="font-semibold mb-2">{t('setRouteToSeeBuses')}</h3>
                        <p className="text-sm text-muted-foreground">{t('setRouteToSeeBusesDesc')}</p>
                    </Card>
                ) : filteredBuses.length === 0 ? (
                    <Card className="p-8 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                            <Bus className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="font-semibold mb-2">
                            {routeIsSet ? t('noBusesOnRoute') : t('noBusesAvailable')}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {routeIsSet ? t('noBusesOnRouteDesc') : t('busesWillAppear')}
                        </p>
                        {routeIsSet && !hasActiveReservation && (
                            <Button size="sm" variant="outline" onClick={handleClearRoute} className="mt-4" data-testid="button-clear-route-empty">
                                <X className="h-4 w-4" />
                                {t('clearRoute')}
                            </Button>
                        )}
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {filteredBuses.map((bus) => (
                            <BusCard
                                key={bus.id}
                                bus={bus}
                                onReserve={handleReserve}
                                showReserveButton={user?.role === "citizen"}
                                hasActiveReservation={hasActiveReservation}
                                etaMin={computeETA(bus)}
                                distanceKm={computeDistKm(bus)}
                            />
                        ))}
                    </div>
                )}
            </section>

            {/* Selected Bus Details */}
            {selectedBus && !showReservationDialog && (
                <div className="fixed bottom-20 left-4 right-4 z-30">
                    <Card className="p-4 shadow-lg">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <Bus className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-bold">{getDisplayRouteName(selectedBus)}</h3>
                                    <p className="text-sm text-muted-foreground">{selectedBus.plateNumber}</p>
                                    <p className="text-sm mt-1">
                                        {selectedBus.totalCapacity - selectedBus.currentPassengers} {t('availableSeats')}
                                    </p>
                                    {selectedBus.price != null && (
                                        <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                                            {selectedBus.price} {t('jd')}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-3 mt-1">
                                        {selectedBus.speed != null && selectedBus.speed > 0 && (
                                            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                                                {selectedBus.speed} {t('kmh')}
                                            </span>
                                        )}
                                        {computeETA(selectedBus) && (
                                            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                                                {t('eta')} {computeETA(selectedBus)} {t('min')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <Button size="icon" variant="ghost" onClick={() => setSelectedBus(null)} data-testid="button-close-bus-details">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        {user?.role === "citizen" && selectedBus.totalCapacity - selectedBus.currentPassengers > 0 && (
                            <div className="mt-4 space-y-2">
                                {hasActiveReservation && (
                                    <p className="text-xs text-center text-muted-foreground">{t('hasActiveReservationShort')}</p>
                                )}
                                <Button
                                    className="w-full"
                                    onClick={() => handleReserve(selectedBus)}
                                    data-testid="button-reserve-from-details"
                                    disabled={hasActiveReservation}
                                    variant={hasActiveReservation ? "secondary" : "default"}
                                >
                                    {t('reserveSeat')}
                                </Button>
                            </div>
                        )}
                    </Card>
                </div>
            )}

            {/* Reservation Confirmation Dialog */}
            <Dialog open={showReservationDialog} onOpenChange={setShowReservationDialog}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{t('confirmReservation')}</DialogTitle>
                        <DialogDescription>{t('confirmReservationQuestion')}</DialogDescription>
                    </DialogHeader>

                    {selectedBus && (
                        <div className="py-4">
                            <Card className="p-4 bg-muted/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                                        <Bus className="h-6 w-6 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold">{getDisplayRouteName(selectedBus)}</h3>
                                        <p className="text-sm text-muted-foreground">{selectedBus.plateNumber}</p>
                                        {selectedBus.price != null && (
                                            <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                                                {t('seatPrice')}: {selectedBus.price} {t('jd')}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </Card>

                            <div className="flex items-start gap-2 mt-4 p-3 bg-accent/50 rounded-lg">
                                <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                                <p className="text-sm">{t('locationWarning')}</p>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setShowReservationDialog(false)} data-testid="button-cancel-reservation">
                            {t('cancelReservation')}
                        </Button>
                        <Button onClick={confirmReservation} disabled={reserveMutation.isPending} data-testid="button-confirm-reservation">
                            {reserveMutation.isPending ? t('processing') : (
                                <><Check className="h-4 w-4" />{t('confirmReservation')}</>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <BottomNav />
        </div>
    );
}