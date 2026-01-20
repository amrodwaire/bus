import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Bus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { BottomNav } from "@/components/bottom-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { LoadingSpinner } from "@/components/loading-spinner";
import { EmptyState } from "@/components/empty-state";
import { ReservationCard } from "@/components/reservation-card";
import { apiRequest } from "@/lib/queryClient";
import type { Reservation, Bus as BusType } from "@shared/schema";

type ReservationWithBus = Reservation & { bus?: BusType };

export default function Reservations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user's reservations
  const { data: reservations = [], isLoading } = useQuery<ReservationWithBus[]>({
    queryKey: [`/api/reservations/user/${user?.id}`],
    enabled: !!user?.id,
  });

  // Cancel reservation mutation
  const cancelMutation = useMutation({
    mutationFn: async (reservationId: string) => {
      return apiRequest("PATCH", `/api/reservations/${reservationId}`, {
        status: "cancelled",
      });
    },
    onSuccess: () => {
      toast({
        title: "تم إلغاء الحجز",
        description: "تم إلغاء حجزك بنجاح",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/reservations/user/${user?.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/buses"] });
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "فشل في إلغاء الحجز",
        variant: "destructive",
      });
    },
  });

  const handleCancel = (reservation: Reservation) => {
    cancelMutation.mutate(reservation.id);
  };

  // Filter reservations by status
  const activeReservations = reservations.filter(
    r => r.status === "pending" || r.status === "confirmed"
  );
  const completedReservations = reservations.filter(
    r => r.status === "completed"
  );
  const cancelledReservations = reservations.filter(
    r => r.status === "cancelled"
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-lg">حجوزاتي</h1>
              <p className="text-xs text-muted-foreground">إدارة حجوزاتك</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="p-4">
        {isLoading ? (
          <LoadingSpinner text="جاري تحميل الحجوزات..." />
        ) : reservations.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="لا توجد حجوزات"
            description="لم تقم بأي حجوزات بعد. ابحث عن باص وقم بحجز مقعدك!"
          />
        ) : (
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="w-full grid grid-cols-3 mb-4">
              <TabsTrigger value="active" data-testid="tab-active">
                نشطة ({activeReservations.length})
              </TabsTrigger>
              <TabsTrigger value="completed" data-testid="tab-completed">
                مكتملة ({completedReservations.length})
              </TabsTrigger>
              <TabsTrigger value="cancelled" data-testid="tab-cancelled">
                ملغية ({cancelledReservations.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-3">
              {activeReservations.length === 0 ? (
                <Card className="p-6 text-center">
                  <Bus className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">لا توجد حجوزات نشطة</p>
                </Card>
              ) : (
                activeReservations.map((reservation) => (
                  <ReservationCard
                    key={reservation.id}
                    reservation={reservation}
                    onCancel={handleCancel}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-3">
              {completedReservations.length === 0 ? (
                <Card className="p-6 text-center">
                  <Bus className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">لا توجد حجوزات مكتملة</p>
                </Card>
              ) : (
                completedReservations.map((reservation) => (
                  <ReservationCard
                    key={reservation.id}
                    reservation={reservation}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="cancelled" className="space-y-3">
              {cancelledReservations.length === 0 ? (
                <Card className="p-6 text-center">
                  <Bus className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">لا توجد حجوزات ملغية</p>
                </Card>
              ) : (
                cancelledReservations.map((reservation) => (
                  <ReservationCard
                    key={reservation.id}
                    reservation={reservation}
                  />
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
