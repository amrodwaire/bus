import { MapPin, Clock, Bus, X, CheckCircle, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/language-context";
import type { Reservation, Bus as BusType } from "@shared/schema";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";

interface ReservationCardProps {
  reservation: Reservation & { bus?: BusType };
  onCancel?: (reservation: Reservation) => void;
}

export function ReservationCard({ reservation, onCancel }: ReservationCardProps) {
  const { t, language, isRTL } = useLanguage();

  const getStatusBadge = () => {
    switch (reservation.status) {
      case "confirmed":
        return (
          <Badge variant="default" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            {t('confirmed')}
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            {t('pending')}
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-green-600 gap-1">
            <CheckCircle className="h-3 w-3" />
            {t('completed')}
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="destructive" className="gap-1">
            <X className="h-3 w-3" />
            {t('cancelled')}
          </Badge>
        );
      default:
        return null;
    }
  };

  const displayRouteName = reservation.bus
    ? (language === "en" && reservation.bus.routeNameEn
        ? reservation.bus.routeNameEn
        : reservation.bus.routeName)
    : t('unknownRoute');

  const formattedDate = reservation.createdAt
    ? format(new Date(reservation.createdAt), "dd MMMM yyyy - HH:mm", {
        locale: language === "ar" ? ar : enUS,
      })
    : "";

  const canCancel = (reservation.status === "pending" || reservation.status === "confirmed") && onCancel;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Bus className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold">{displayRouteName}</h3>
              {getStatusBadge()}
            </div>
            {reservation.bus && (
              <p className="text-sm text-muted-foreground">{reservation.bus.plateNumber}</p>
            )}
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
              <Clock className="h-3 w-3" />
              <span>{formattedDate}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <AlertCircle className="h-3 w-3" />
              <span>{t('priority')}: {reservation.priority}</span>
            </div>
          </div>
        </div>

        {canCancel && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCancel(reservation)}
            data-testid={`button-cancel-reservation-${reservation.id}`}
            className={`text-destructive hover:bg-destructive/10 ${isRTL ? "mr-auto" : "ml-auto"}`}
          >
            <X className={`h-4 w-4 ${isRTL ? "ml-1" : "mr-1"}`} />
            {t('cancelBooking')}
          </Button>
        )}
      </div>
    </Card>
  );
}
