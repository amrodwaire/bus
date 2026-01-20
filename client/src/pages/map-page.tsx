import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bus, MapPin, X, Check, AlertCircle } from "lucide-react";
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
import { MapView } from "@/components/map-view";
import { BusCard } from "@/components/bus-card";
import { BottomNav } from "@/components/bottom-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { LoadingSpinner } from "@/components/loading-spinner";
import { apiRequest } from "@/lib/queryClient";
import type { Bus as BusType } from "@shared/schema";

export default function MapPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedBus, setSelectedBus] = useState<BusType | null>(null);
  const [showReservationDialog, setShowReservationDialog] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Fetch available buses
  const { data: buses = [], isLoading } = useQuery<BusType[]>({
    queryKey: ["/api/buses"],
  });

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.log("Location access denied:", error);
          // Default to Amman
          setUserLocation({ lat: 31.9539, lng: 35.9106 });
        }
      );
    }
  }, []);

  // Create reservation mutation
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
      toast({
        title: "تم الحجز بنجاح",
        description: "تم حجز مقعدك في الباص",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/buses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
      setShowReservationDialog(false);
      setSelectedBus(null);
    },
    onError: (error: Error) => {
      toast({
        title: "فشل الحجز",
        description: error.message || "حدث خطأ أثناء الحجز",
        variant: "destructive",
      });
    },
  });

  const handleBusClick = (bus: BusType) => {
    setSelectedBus(bus);
  };

  const handleReserve = (bus: BusType) => {
    setSelectedBus(bus);
    setShowReservationDialog(true);
  };

  const confirmReservation = () => {
    if (selectedBus && user) {
      reserveMutation.mutate(selectedBus.id);
    }
  };

  // Filter visible buses
  const visibleBuses = buses.filter(b => b.isVisible);

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
              <h1 className="font-bold text-lg">كوستر</h1>
              <p className="text-xs text-muted-foreground">الباصات المتاحة</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <MapPin className="h-3 w-3" />
              عمان
            </Badge>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Map Section */}
      <section className="p-4">
        <MapView
          buses={visibleBuses}
          userLocation={userLocation}
          onBusClick={handleBusClick}
          selectedBusId={selectedBus?.id}
          height="280px"
        />
      </section>

      {/* Bus List Section */}
      <section className="px-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">الباصات القريبة</h2>
          <Badge variant="outline">{visibleBuses.length} باص</Badge>
        </div>

        {isLoading ? (
          <LoadingSpinner text="جاري تحميل الباصات..." />
        ) : visibleBuses.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Bus className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-2">لا توجد باصات متاحة</h3>
            <p className="text-sm text-muted-foreground">
              سيتم عرض الباصات المتاحة عند توفرها
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {visibleBuses.map((bus) => (
              <BusCard
                key={bus.id}
                bus={bus}
                onReserve={handleReserve}
                showReserveButton={user?.role === "citizen"}
              />
            ))}
          </div>
        )}
      </section>

      {/* Selected Bus Details Dialog */}
      {selectedBus && !showReservationDialog && (
        <div className="fixed bottom-20 left-4 right-4 z-30">
          <Card className="p-4 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bus className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold">{selectedBus.routeName}</h3>
                  <p className="text-sm text-muted-foreground">{selectedBus.plateNumber}</p>
                  <p className="text-sm mt-1">
                    {selectedBus.totalCapacity - selectedBus.currentPassengers} مقعد متاح
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setSelectedBus(null)}
                  data-testid="button-close-bus-details"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {user?.role === "citizen" && selectedBus.totalCapacity - selectedBus.currentPassengers > 0 && (
              <Button
                className="w-full mt-4"
                onClick={() => handleReserve(selectedBus)}
                data-testid="button-reserve-from-details"
              >
                احجز مقعد
              </Button>
            )}
          </Card>
        </div>
      )}

      {/* Reservation Confirmation Dialog */}
      <Dialog open={showReservationDialog} onOpenChange={setShowReservationDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>تأكيد الحجز</DialogTitle>
            <DialogDescription>
              هل تريد حجز مقعد في هذا الباص؟
            </DialogDescription>
          </DialogHeader>
          
          {selectedBus && (
            <div className="py-4">
              <Card className="p-4 bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Bus className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold">{selectedBus.routeName}</h3>
                    <p className="text-sm text-muted-foreground">{selectedBus.plateNumber}</p>
                  </div>
                </div>
              </Card>
              
              <div className="flex items-start gap-2 mt-4 p-3 bg-accent/50 rounded-lg">
                <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm">
                  سيتم حجز مقعدك بناءً على موقعك الحالي. تأكد من أنك على مسار الباص.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowReservationDialog(false)}
              data-testid="button-cancel-reservation"
            >
              إلغاء
            </Button>
            <Button
              onClick={confirmReservation}
              disabled={reserveMutation.isPending}
              data-testid="button-confirm-reservation"
            >
              {reserveMutation.isPending ? (
                "جاري الحجز..."
              ) : (
                <>
                  <Check className="h-4 w-4 ml-1" />
                  تأكيد الحجز
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
