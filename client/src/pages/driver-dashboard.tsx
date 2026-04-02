import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bus,
  Users,
  Eye,
  EyeOff,
  Plus,
  Minus,
  Route,
  User,
  MapPin,
  Save,
  Trash2,
  Pencil,
  Banknote,
  X,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { jordanGovernorates } from "@shared/schema";
import { governorateNames } from "@/lib/governorate-utils";
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
import { BottomNav } from "@/components/bottom-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { LoadingSpinner } from "@/components/loading-spinner";
import { MapView, type PassengerPickup } from "@/components/map-view";
import { apiRequest } from "@/lib/queryClient";
import { getMultiSegmentRoute, type RouteResult } from "@/lib/routing-service";
import type { Bus as BusType, Reservation, RouteWaypoint } from "@shared/schema";

type ReservationWithPassenger = Reservation & {
  passengerName?: string | null;
  passengerPhone?: string | null;
};

interface TempWaypoint {
  lat: number;
  lng: number;
}

export default function DriverDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();

  const [showBusDialog, setShowBusDialog] = useState(false);
  const [busFormData, setBusFormData] = useState({
    plateNumber: "",
    routeName: "",
    routeNameEn: "",
    governorate: "amman",
    destinationGovernorate: "",
    totalCapacity: 15,
    price: "" as string | number,
  });

  const [isEditingRoute, setIsEditingRoute] = useState(false);
  const [tempWaypoints, setTempWaypoints] = useState<TempWaypoint[]>([]);
  const [driverRoutePath, setDriverRoutePath] = useState<[number, number][] | undefined>(undefined);
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; durationMin: number } | null>(null);
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [editPrice, setEditPrice] = useState("");
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationTracking, setLocationTracking] = useState<"off" | "active" | "denied">("off");
  const locationUpdateRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getDisplayRouteName = (bus: BusType) => {
    return language === "en" && bus.routeNameEn ? bus.routeNameEn : bus.routeName;
  };

  const { data: driverBus, isLoading: busLoading } = useQuery<BusType | null>({
    queryKey: [`/api/buses/driver/${user?.id}`],
    enabled: !!user?.id,
  });

  const { data: reservations = [] } = useQuery<ReservationWithPassenger[]>({
    queryKey: [`/api/reservations/bus/${driverBus?.id}`],
    enabled: !!driverBus?.id,
    refetchInterval: 10000,
  });

  const { data: savedWaypoints = [] } = useQuery<RouteWaypoint[]>({
    queryKey: [`/api/routes/${driverBus?.id}`],
    enabled: !!driverBus?.id,
  });

  const computeRoutePath = useCallback(async (points: TempWaypoint[]) => {
    if (points.length < 2) {
      setDriverRoutePath(undefined);
      setRouteInfo(null);
      return;
    }
    const result = await getMultiSegmentRoute(points);
    if (result) {
      setDriverRoutePath(result.coordinates);
      setRouteInfo({ distanceKm: result.distanceKm, durationMin: result.durationMin });
    } else {
      setDriverRoutePath(undefined);
      setRouteInfo(null);
    }
  }, []);

  useEffect(() => {
    if (savedWaypoints.length > 0 && !isEditingRoute) {
      setTempWaypoints(savedWaypoints.map(wp => ({ lat: wp.lat, lng: wp.lng })));
      computeRoutePath(savedWaypoints.map(wp => ({ lat: wp.lat, lng: wp.lng })));
    }
  }, [savedWaypoints]);

  // GPS tracking: update bus location as driver moves
  useEffect(() => {
    if (!driverBus?.id) return;
    if (!navigator.geolocation) return;

    let watchId: number;
    let lastLat: number | null = null;
    let lastLng: number | null = null;

    const sendLocation = (lat: number, lng: number) => {
      // Only send if moved more than ~10m
      if (
        lastLat !== null &&
        Math.abs(lat - lastLat) < 0.0001 &&
        Math.abs(lng - lastLng!) < 0.0001
      ) return;
      lastLat = lat;
      lastLng = lng;
      // Silent background update — no toast, no cache invalidation
      apiRequest("PATCH", `/api/buses/${driverBus.id}`, {
        currentLat: lat,
        currentLng: lng,
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: [`/api/buses/driver/${user?.id}`] });
        queryClient.invalidateQueries({ queryKey: ["/api/buses"] });
      }).catch(() => {});
    };

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setDriverLocation({ lat: latitude, lng: longitude });
        setLocationTracking("active");
        sendLocation(latitude, longitude);
      },
      (err) => {
        if (err.code === 1) setLocationTracking("denied");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      if (locationUpdateRef.current) clearTimeout(locationUpdateRef.current);
    };
  }, [driverBus?.id]);

  const createBusMutation = useMutation({
    mutationFn: async (data: typeof busFormData) => {
      const payload: any = {
        ...data,
        driverId: user?.id,
        price: data.price !== "" ? parseFloat(String(data.price)) : null,
        destinationGovernorate: data.destinationGovernorate || null,
      };
      return apiRequest("POST", "/api/buses", payload);
    },
    onSuccess: () => {
      toast({ title: t('busCreated'), description: t('registerBusDesc') });
      queryClient.invalidateQueries({ queryKey: [`/api/buses/driver/${user?.id}`] });
      setShowBusDialog(false);
    },
    onError: () => {
      toast({ title: t('error'), description: t('error'), variant: "destructive" });
    },
  });

  const updateBusMutation = useMutation({
    mutationFn: async (updates: Partial<BusType>) => {
      return apiRequest("PATCH", `/api/buses/${driverBus?.id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/buses/driver/${user?.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/buses"] });
    },
    onError: () => {
      toast({ title: t('error'), description: t('error'), variant: "destructive" });
    },
  });

  const saveWaypointsMutation = useMutation({
    mutationFn: async (waypoints: TempWaypoint[]) => {
      return apiRequest("POST", `/api/routes/${driverBus?.id}`, { waypoints });
    },
    onSuccess: () => {
      toast({
        title: t('routeSaved'),
        description: `${tempWaypoints.length} ${t('stopsAdded')}`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/routes/${driverBus?.id}`] });
      setIsEditingRoute(false);
    },
    onError: () => {
      toast({ title: t('error'), description: t('error'), variant: "destructive" });
    },
  });

  const handlePassengerChange = (delta: number) => {
    if (!driverBus) return;
    const newCount = Math.max(0, Math.min(driverBus.totalCapacity, driverBus.currentPassengers + delta));
    updateBusMutation.mutate({ currentPassengers: newCount });
  };

  const handleVisibilityToggle = () => {
    if (!driverBus) return;
    const newVisible = !driverBus.isVisible;
    updateBusMutation.mutate({ isVisible: newVisible });
    toast({ title: newVisible ? t('visible') : t('hidden') });
  };

  const handleCreateBus = (e: React.FormEvent) => {
    e.preventDefault();
    createBusMutation.mutate(busFormData);
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (!isEditingRoute) return;
    const newWaypoints = [...tempWaypoints, { lat, lng }];
    setTempWaypoints(newWaypoints);
    computeRoutePath(newWaypoints);
  };

  const handleRemoveWaypoint = (index: number) => {
    const newWaypoints = tempWaypoints.filter((_, i) => i !== index);
    setTempWaypoints(newWaypoints);
    computeRoutePath(newWaypoints);
  };

  const handleStartEditing = () => {
    setTempWaypoints(savedWaypoints.map(wp => ({ lat: wp.lat, lng: wp.lng })));
    setIsEditingRoute(true);
  };

  const handleCancelEditing = () => {
    const pts = savedWaypoints.map(wp => ({ lat: wp.lat, lng: wp.lng }));
    setTempWaypoints(pts);
    setIsEditingRoute(false);
    computeRoutePath(pts);
  };

  const handleSavePrice = () => {
    const parsed = editPrice !== "" ? parseFloat(editPrice) : null;
    const priceVal = parsed !== null && isNaN(parsed) ? null : parsed;
    updateBusMutation.mutate({ price: priceVal } as any, {
      onSuccess: () => {
        setIsEditingPrice(false);
        toast({ title: t('saved') });
      },
    });
  };

  const availableSeats = driverBus ? driverBus.totalCapacity - driverBus.currentPassengers : 0;
  const pendingReservations = reservations.filter(r => r.status === "pending" || r.status === "confirmed");

  const passengerPickups: PassengerPickup[] = pendingReservations
    .sort((a, b) => a.priority - b.priority)
    .map(r => ({
      lat: r.pickupLat,
      lng: r.pickupLng,
      priority: r.priority,
      name: r.passengerName,
      phone: r.passengerPhone,
    }));


  if (busLoading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-40 bg-background border-b border-border">
          <div className="flex items-center justify-between p-4">
            <h1 className="font-bold text-lg">{t('driverDashboard')}</h1>
            <div className="flex items-center gap-2"><LanguageToggle /><ThemeToggle /></div>
          </div>
        </header>
        <LoadingSpinner />
        <BottomNav />
      </div>
    );
  }

  if (!driverBus) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-40 bg-background border-b border-border">
          <div className="flex items-center justify-between p-4">
            <h1 className="font-bold text-lg">{t('driverDashboard')}</h1>
            <div className="flex items-center gap-2"><LanguageToggle /><ThemeToggle /></div>
          </div>
        </header>
        <div className="p-4">
          <Card className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Bus className="h-8 w-8 text-primary" />
            </div>
            <h2 className="font-bold text-xl mb-2">{t('noBusRegistered')}</h2>
            <p className="text-muted-foreground mb-6">{t('registerBusDesc')}</p>
            <Button onClick={() => setShowBusDialog(true)} data-testid="button-add-bus">
              <Plus className="h-4 w-4" />
              {t('registerBus')}
            </Button>
          </Card>
        </div>
        <Dialog open={showBusDialog} onOpenChange={setShowBusDialog}>
          <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('createBus')}</DialogTitle>
              <DialogDescription>{t('enterBusDetails')}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateBus} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="plateNumber">{t('plateNumber')}</Label>
                <Input
                  id="plateNumber"
                  placeholder={t('examplePlate')}
                  value={busFormData.plateNumber}
                  onChange={(e) => setBusFormData({ ...busFormData, plateNumber: e.target.value })}
                  data-testid="input-plate-number"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="routeName">{t('routeName')} ({t('arabic')})</Label>
                <Input
                  id="routeName"
                  placeholder="مثال: عمان - الزرقاء"
                  value={busFormData.routeName}
                  onChange={(e) => setBusFormData({ ...busFormData, routeName: e.target.value })}
                  data-testid="input-route-name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="routeNameEn">{t('routeName')} ({t('english')})</Label>
                <Input
                  id="routeNameEn"
                  placeholder="e.g. Amman - Zarqa"
                  value={busFormData.routeNameEn}
                  onChange={(e) => setBusFormData({ ...busFormData, routeNameEn: e.target.value })}
                  data-testid="input-route-name-en"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity">{t('totalCapacity')}</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  max="50"
                  value={busFormData.totalCapacity}
                  onChange={(e) => setBusFormData({ ...busFormData, totalCapacity: parseInt(e.target.value) || 15 })}
                  data-testid="input-capacity"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">{t('seatPrice')} ({t('jd')})</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.05"
                  placeholder="0.50"
                  value={busFormData.price}
                  onChange={(e) => setBusFormData({ ...busFormData, price: e.target.value })}
                  data-testid="input-price"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('originGovernorate')}</Label>
                <Select
                  value={busFormData.governorate}
                  onValueChange={(val) => setBusFormData({ ...busFormData, governorate: val })}
                >
                  <SelectTrigger data-testid="select-governorate">
                    <SelectValue placeholder={t('selectGovernorate')} />
                  </SelectTrigger>
                  <SelectContent>
                    {jordanGovernorates.map((gov) => (
                      <SelectItem key={gov} value={gov}>
                        {language === "en" ? governorateNames[gov].en : governorateNames[gov].ar}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('destinationGovernorate')}</Label>
                <Select
                  value={busFormData.destinationGovernorate}
                  onValueChange={(val) => setBusFormData({ ...busFormData, destinationGovernorate: val })}
                >
                  <SelectTrigger data-testid="select-destination-governorate">
                    <SelectValue placeholder={t('selectGovernorate')} />
                  </SelectTrigger>
                  <SelectContent>
                    {jordanGovernorates.map((gov) => (
                      <SelectItem key={gov} value={gov}>
                        {language === "en" ? governorateNames[gov].en : governorateNames[gov].ar}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={createBusMutation.isPending}
                  data-testid="button-submit-bus"
                >
                  {createBusMutation.isPending ? t('registering') : t('createBus')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div>
            <h1 className="font-bold text-lg">{t('driverDashboard')}</h1>
            <p className="text-xs text-muted-foreground">{getDisplayRouteName(driverBus)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={driverBus.isVisible ? "default" : "secondary"}>
              {driverBus.isVisible ? t('visible') : t('hidden')}
            </Badge>
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* Bus Info + Visibility */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bus className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="font-bold">{getDisplayRouteName(driverBus)}</h2>
                <p className="text-sm text-muted-foreground">{driverBus.plateNumber}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between py-3 border-t border-border">
            <div className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-green-600" />
              <span className="font-medium">{t('seatPrice')}</span>
            </div>
            {isEditingPrice ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  step="0.05"
                  placeholder="0.50"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  className="w-24 h-8 text-sm"
                  data-testid="input-edit-price"
                />
                <span className="text-xs text-muted-foreground">{t('jd')}</span>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleSavePrice} data-testid="button-save-price">
                  <Check className="h-4 w-4 text-green-600" />
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setIsEditingPrice(false)} data-testid="button-cancel-price">
                  <X className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-green-600 dark:text-green-400">
                  {driverBus.price != null ? `${driverBus.price} ${t('jd')}` : t('notSet')}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={() => {
                    setEditPrice(driverBus.price != null ? String(driverBus.price) : "");
                    setIsEditingPrice(true);
                  }}
                  data-testid="button-edit-price"
                >
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            )}
          </div>

          {/* GPS tracking status */}
          <div className="flex items-center justify-between py-3 border-t border-border">
            <div className="flex items-center gap-2">
              <MapPin className={`h-5 w-5 ${locationTracking === "active" ? "text-green-600" : "text-muted-foreground"}`} />
              <span className="font-medium">{t('liveLocation')}</span>
            </div>
            <Badge
              variant={locationTracking === "active" ? "default" : locationTracking === "denied" ? "destructive" : "secondary"}
              className="text-xs"
              data-testid="badge-gps-status"
            >
              {locationTracking === "active"
                ? t('gpsActive')
                : locationTracking === "denied"
                  ? t('gpsDenied')
                  : t('gpsWaiting')}
            </Badge>
          </div>

          <div className="flex items-center justify-between py-3 border-t border-border">
            <div className="flex items-center gap-2">
              {driverBus.isVisible ? (
                <Eye className="h-5 w-5 text-primary" />
              ) : (
                <EyeOff className="h-5 w-5 text-muted-foreground" />
              )}
              <span className="font-medium">{t('busVisibility')}</span>
            </div>
            <Switch
              checked={driverBus.isVisible}
              onCheckedChange={handleVisibilityToggle}
              data-testid="switch-visibility"
            />
          </div>
        </Card>

        {/* Passenger Count */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t('passengerCount')}
            </h3>
            <Badge variant={availableSeats === 0 ? "destructive" : availableSeats <= 3 ? "secondary" : "default"}>
              {availableSeats === 0 ? t('full') : `${availableSeats} ${t('availableSeats')}`}
            </Badge>
          </div>

          <div className="flex items-center justify-center gap-6 py-4">
            <Button
              size="lg"
              variant="outline"
              onClick={() => handlePassengerChange(-1)}
              disabled={driverBus.currentPassengers <= 0 || updateBusMutation.isPending}
              data-testid="button-decrease-passengers"
              className="h-14 w-14 rounded-full"
            >
              <Minus className="h-6 w-6" />
            </Button>

            <div className="text-center min-w-[100px]">
              <div className="text-4xl font-bold">{driverBus.currentPassengers}</div>
              <div className="text-sm text-muted-foreground">/ {driverBus.totalCapacity}</div>
            </div>

            <Button
              size="lg"
              onClick={() => handlePassengerChange(1)}
              disabled={driverBus.currentPassengers >= driverBus.totalCapacity || updateBusMutation.isPending}
              data-testid="button-increase-passengers"
              className="h-14 w-14 rounded-full"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </div>

          <div className="mt-4">
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  availableSeats === 0
                    ? 'bg-destructive'
                    : availableSeats <= 3
                      ? 'bg-yellow-500'
                      : 'bg-primary'
                }`}
                style={{ width: `${(driverBus.currentPassengers / driverBus.totalCapacity) * 100}%` }}
              />
            </div>
          </div>
        </Card>

        {/* Route Management (Interactive Waypoints) */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold flex items-center gap-2">
              <Route className="h-5 w-5" />
              {t('tripRoute')}
            </h3>
            <div className="flex items-center gap-2">
              {!isEditingRoute ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleStartEditing}
                  data-testid="button-edit-route"
                >
                  <Pencil className="h-4 w-4" />
                  {t('editRoute')}
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelEditing}
                    data-testid="button-cancel-route-edit"
                  >
                    <X className="h-4 w-4" />
                    {t('cancelReservation')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => saveWaypointsMutation.mutate(tempWaypoints)}
                    disabled={saveWaypointsMutation.isPending}
                    data-testid="button-save-route"
                  >
                    <Save className="h-4 w-4" />
                    {t('saveRoute')}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {isEditingRoute && (
            <div className="mb-3 p-2 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-lg text-sm text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span>{t('clickMapToAddStop')}</span>
            </div>
          )}

          <MapView
            buses={[driverBus]}
            editableWaypoints={isEditingRoute ? tempWaypoints : undefined}
            waypoints={isEditingRoute ? [] : savedWaypoints}
            routePath={driverRoutePath}
            routeDistanceKm={routeInfo?.distanceKm}
            routeDurationMin={routeInfo?.durationMin}
            userLocation={driverLocation}
            height="300px"
            showUserLocation={!!driverLocation}
            showHiddenBuses
            onMapClick={isEditingRoute ? handleMapClick : undefined}
            passengerPickups={!isEditingRoute ? passengerPickups : undefined}
          />

          {/* Waypoints list */}
          {(isEditingRoute ? tempWaypoints : savedWaypoints).length > 0 ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-muted-foreground font-medium">
                {(isEditingRoute ? tempWaypoints : savedWaypoints).length} {t('stops')}
              </p>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {(isEditingRoute ? tempWaypoints : (savedWaypoints as { lat: number; lng: number }[])).map((wp, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {index + 1}
                      </div>
                      <span className="text-muted-foreground text-xs font-mono">
                        {wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}
                      </span>
                    </div>
                    {isEditingRoute && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveWaypoint(index)}
                        data-testid={`button-remove-waypoint-${index}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {isEditingRoute && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => { setTempWaypoints([]); setDriverRoutePath(undefined); setRouteInfo(null); }}
                  data-testid="button-clear-stops"
                >
                  <Trash2 className="h-4 w-4" />
                  {t('clearStops')}
                </Button>
              )}
            </div>
          ) : (
            <div className="mt-3 text-center py-4">
              <p className="text-sm text-muted-foreground">{t('noStopsYet')}</p>
              {!isEditingRoute && (
                <p className="text-xs text-muted-foreground mt-1">{t('addStopsHint')}</p>
              )}
            </div>
          )}
        </Card>

        {/* Reservations — passenger pickup list */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold flex items-center gap-2">
              <User className="h-5 w-5" />
              {t('reservations')}
            </h3>
            <Badge variant="outline">{pendingReservations.length} {t('bookings')}</Badge>
          </div>

          {pendingReservations.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">{t('noCurrentReservations')}</p>
          ) : (
            <div className="space-y-2">
              {pendingReservations
                .sort((a, b) => a.priority - b.priority)
                .map((reservation) => (
                  <div
                    key={reservation.id}
                    className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                    data-testid={`card-reservation-${reservation.id}`}
                  >
                    <div className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-950/40 border-2 border-orange-400 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{reservation.priority}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {reservation.passengerName ?? `${t('passenger')} #${reservation.priority}`}
                      </p>
                      {reservation.passengerPhone && (
                        <p className="text-xs text-muted-foreground">{reservation.passengerPhone}</p>
                      )}
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">
                        📍 {reservation.pickupLat.toFixed(4)}, {reservation.pickupLng.toFixed(4)}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-xs flex-shrink-0 border-orange-300 text-orange-600 dark:text-orange-400"
                    >
                      {t('priority')} {reservation.priority}
                    </Badge>
                  </div>
                ))}
              {pendingReservations.length > 0 && (
                <p className="text-xs text-center text-muted-foreground pt-1">
                  {t('passengersOnMap')}
                </p>
              )}
            </div>
          )}
        </Card>
      </div>

      <BottomNav />
    </div>
  );
}
