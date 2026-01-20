import { Bus, Users, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/language-context";
import type { Bus as BusType } from "@shared/schema";

interface BusCardProps {
  bus: BusType;
  onReserve?: (bus: BusType) => void;
  showReserveButton?: boolean;
  compact?: boolean;
}

export function BusCard({ bus, onReserve, showReserveButton = true, compact = false }: BusCardProps) {
  const { t, language } = useLanguage();
  const availableSeats = bus.totalCapacity - bus.currentPassengers;
  
  // Get route name based on current language
  const displayRouteName = language === "en" && bus.routeNameEn ? bus.routeNameEn : bus.routeName;
  const isFull = availableSeats <= 0;
  const isAlmostFull = availableSeats <= 3 && availableSeats > 0;

  const getStatusBadge = () => {
    if (isFull) {
      return <Badge variant="destructive">{t('full')}</Badge>;
    }
    if (isAlmostFull) {
      return <Badge className="bg-yellow-500 text-yellow-950">{t('almostFull')}</Badge>;
    }
    return <Badge variant="default">{t('available')}</Badge>;
  };

  if (compact) {
    return (
      <Card className="p-3 hover-elevate">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
              <Bus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">{displayRouteName}</p>
              <p className="text-xs text-muted-foreground">{bus.plateNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-sm">
              <Users className="h-4 w-4" />
              <span className="font-medium">{availableSeats}/{bus.totalCapacity}</span>
            </div>
            {getStatusBadge()}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 hover-elevate">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Bus className="h-7 w-7 text-primary" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-lg">{displayRouteName}</h3>
              {getStatusBadge()}
            </div>
            <p className="text-sm text-muted-foreground">{bus.plateNumber}</p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{availableSeats} {t('availableSeats')}</span>
              </div>
              {bus.currentLat && bus.currentLng && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  <span>{t('onMap')}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {showReserveButton && !isFull && onReserve && (
          <Button
            onClick={() => onReserve(bus)}
            data-testid={`button-reserve-bus-${bus.id}`}
            className="flex-shrink-0"
          >
            {t('reserveSeat')}
          </Button>
        )}
      </div>
    </Card>
  );
}
