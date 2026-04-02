import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bus, MapPin, X, Check, AlertCircle, Navigation2 } from "lucide-react";
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
import { MapView } from "@/components/map-view";
import { BusCard } from "@/components/bus-card";
import { BottomNav } from "@/components/bottom-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { LoadingSpinner } from "@/components/loading-spinner";
import { apiRequest } from "@/lib/queryClient";
import { detectGovernorate, getGovernorateName, governorateNames } from "@/lib/governorate-utils";
import type { Bus as BusType, Governorate } from "@shared/schema";

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

  // Map-based trip route — 0=idle, 1=picking from, 2=picking to
  const [routeStep, setRouteStep] = useState<0 | 1 | 2>(0);
  const [fromPoint, setFromPoint] = useState<RoutePoint | null>(null);
  const [toPoint, setToPoint] = useState<RoutePoint | null>(null);

  const { data: buses = [], isLoading } = useQuery<BusType[]>({
    queryKey: ["/api/buses"],
  });

  const { data: activeReservation } = useQuery({
    queryKey: ["/api/reservations/user", user?.id, "active"],
    queryFn: () =>
      fetch(`/api/reservations/user/${user?.id}/active`).then((r) => r.json()),
    enabled: !!user?.id && user?.role === "citizen",
  });

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
  const handleReserve = (bus: BusType) => { setSelectedBus(bus); setShowReservationDialog(true); };
  const confirmReservation = () => { if (selectedBus && user) reserveMutation.mutate(selectedBus.id); };

  // Handle map click for route selection
  const handleMapClick = (lat: number, lng: number) => {
    if (routeStep === 1) {
      const clickedGov = detectGovernorate(lat, lng) ?? "amman";
      // Validate: from point must be in user's governorate
      if (clickedGov !== userGovernorate) {
        toast({
          title: t('locationMismatch'),
          description: t('locationMismatchDesc')
            .replace('{current}', getGovLabel(userGovernorate))
            .replace('{selected}', getGovLabel(clickedGov)),
          variant: "destructive",
        });
        return;
      }
      setFromPoint({ lat, lng, gov: clickedGov });
      setRouteStep(2);
    } else if (routeStep === 2) {
      const clickedGov = detectGovernorate(lat, lng) ?? "amman";
      setToPoint({ lat, lng, gov: clickedGov });
      setRouteStep(0);
    }
  };

  const handleClearRoute = () => {
    setFromPoint(null);
    setToPoint(null);
    setRouteStep(0);
  };

  const handleStartSetting = () => {
    setFromPoint(null);
    setToPoint(null);
    setRouteStep(1);
  };

  const routeIsSet = fromPoint !== null && toPoint !== null;

  const filteredBuses = useMemo(() => {
    return buses.filter(b => {
      if (!b.isVisible) return false;

      if (routeIsSet && fromPoint && toPoint) {
        return b.governorate === fromPoint.gov && b.destinationGovernorate === toPoint.gov;
      }

      const busGov = b.governorate as Governorate | null;
      const destGov = b.destinationGovernorate as Governorate | null;
      if (!busGov && !destGov) return true;
      return busGov === userGovernorate || destGov === userGovernorate;
    });
  }, [buses, userGovernorate, fromPoint, toPoint, routeIsSet]);

  const getDisplayRouteName = (bus: BusType) => {
    return language === "en" && bus.routeNameEn ? bus.routeNameEn : bus.routeName;
  };

  const getGovLabel = (gov: string) => {
    const entry = governorateNames[gov as Governorate];
    if (!entry) return gov;
    return language === "en" ? entry.en : entry.ar;
  };

  const routeLabel = routeIsSet && fromPoint && toPoint
    ? `${getGovLabel(fromPoint.gov)} → ${getGovLabel(toPoint.gov)}`
    : null;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
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
                </div>
                <Button size="sm" variant="outline" onClick={handleClearRoute} data-testid="button-clear-route" className="gap-1">
                  <X className="h-3.5 w-3.5" />
                  {t('clearRoute')}
                </Button>
              </div>
            )}
          </Card>
        </section>
      )}

      {/* Map Section */}
      <section className="p-4">
        <MapView
          buses={filteredBuses}
          userLocation={userLocation}
          onBusClick={routeStep === 0 ? handleBusClick : undefined}
          selectedBusId={selectedBus?.id}
          height="350px"
          onMapClick={routeStep > 0 ? handleMapClick : undefined}
          routeFrom={fromPoint ?? undefined}
          routeTo={toPoint ?? undefined}
          routeMode={routeStep === 1 ? "from" : routeStep === 2 ? "to" : undefined}
        />
      </section>

      {/* Active Reservation Notice */}
      {hasActiveReservation && user?.role === "citizen" && (
        <section className="px-4 pb-2">
          <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm">
            <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
            <p className="text-yellow-800 dark:text-yellow-300">{t('hasActiveReservationNotice')}</p>
          </div>
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
            {routeIsSet && (
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
