import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Bus, 
  Users, 
  Eye, 
  EyeOff, 
  Plus, 
  Minus, 
  Route,
  User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { MapView } from "@/components/map-view";
import { apiRequest } from "@/lib/queryClient";
import type { Bus as BusType, Reservation, RouteWaypoint } from "@shared/schema";

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
  });
  
  // Get route name based on language
  const getDisplayRouteName = (bus: BusType) => {
    return language === "en" && bus.routeNameEn ? bus.routeNameEn : bus.routeName;
  };

  const { data: driverBus, isLoading: busLoading } = useQuery<BusType | null>({
    queryKey: [`/api/buses/driver/${user?.id}`],
    enabled: !!user?.id,
  });

  const { data: reservations = [] } = useQuery<Reservation[]>({
    queryKey: [`/api/reservations/bus/${driverBus?.id}`],
    enabled: !!driverBus?.id,
  });

  const { data: waypoints = [] } = useQuery<RouteWaypoint[]>({
    queryKey: [`/api/routes/${driverBus?.id}`],
    enabled: !!driverBus?.id,
  });

  const createBusMutation = useMutation({
    mutationFn: async (data: typeof busFormData) => {
      return apiRequest("POST", "/api/buses", {
        ...data,
        driverId: user?.id,
      });
    },
    onSuccess: () => {
      toast({
        title: t('busCreated'),
        description: t('registerBusDesc'),
      });
      queryClient.invalidateQueries({ queryKey: [`/api/buses/driver/${user?.id}`] });
      setShowBusDialog(false);
    },
    onError: () => {
      toast({
        title: t('error'),
        description: t('error'),
        variant: "destructive",
      });
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
      toast({
        title: t('error'),
        description: t('error'),
        variant: "destructive",
      });
    },
  });

  const handlePassengerChange = (delta: number) => {
    if (!driverBus) return;
    const newCount = Math.max(0, Math.min(driverBus.totalCapacity, driverBus.currentPassengers + delta));
    updateBusMutation.mutate({ currentPassengers: newCount });
  };

  const handleVisibilityToggle = () => {
    if (!driverBus) return;
    updateBusMutation.mutate({ isVisible: !driverBus.isVisible });
    toast({
      title: driverBus.isVisible ? t('hidden') : t('visible'),
      description: driverBus.isVisible ? t('hidden') : t('visible'),
    });
  };

  const handleCreateBus = (e: React.FormEvent) => {
    e.preventDefault();
    createBusMutation.mutate(busFormData);
  };

  const availableSeats = driverBus ? driverBus.totalCapacity - driverBus.currentPassengers : 0;
  const pendingReservations = reservations.filter(r => r.status === "pending" || r.status === "confirmed");

  if (busLoading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-40 bg-background border-b border-border">
          <div className="flex items-center justify-between p-4">
            <h1 className="font-bold text-lg">{t('driverDashboard')}</h1>
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
            </div>
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
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
            </div>
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
          <DialogContent className="max-w-sm">
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

        <Card className="p-4">
          <h3 className="font-bold flex items-center gap-2 mb-3">
            <Route className="h-5 w-5" />
            {t('tripRoute')}
          </h3>
          <MapView
            buses={[driverBus]}
            waypoints={waypoints}
            height="180px"
            showUserLocation={false}
          />
        </Card>

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
              {pendingReservations.slice(0, 5).map((reservation, index) => (
                <div 
                  key={reservation.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm">{t('passenger')} #{reservation.priority}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {t('priority')} {index + 1}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <BottomNav />
    </div>
  );
}
