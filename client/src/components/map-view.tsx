import { useEffect, useRef, useState } from "react";
import { MapPin, Bus, Navigation } from "lucide-react";
import type { Bus as BusType, RouteWaypoint } from "@shared/schema";

interface MapViewProps {
  buses: BusType[];
  waypoints?: RouteWaypoint[];
  userLocation?: { lat: number; lng: number } | null;
  onBusClick?: (bus: BusType) => void;
  selectedBusId?: string | null;
  height?: string;
  showUserLocation?: boolean;
}

export function MapView({
  buses,
  waypoints = [],
  userLocation,
  onBusClick,
  selectedBusId,
  height = "400px",
  showUserLocation = true,
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  
  // Jordan's approximate center (Amman)
  const defaultCenter = { lat: 31.9539, lng: 35.9106 };
  const center = userLocation || defaultCenter;

  // Calculate bounds to show all buses
  const visibleBuses = buses.filter(b => b.isVisible && b.currentLat && b.currentLng);

  return (
    <div 
      ref={mapRef} 
      className="relative bg-muted rounded-lg overflow-hidden"
      style={{ height }}
    >
      {/* Map Background - Simulated map view */}
      <div className="absolute inset-0 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-950 dark:to-green-900">
        {/* Grid lines to simulate map */}
        <svg className="absolute inset-0 w-full h-full opacity-20">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
        
        {/* Main roads simulation */}
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-0 right-0 h-2 bg-gray-300 dark:bg-gray-700 transform -translate-y-1/2" />
          <div className="absolute top-0 bottom-0 left-1/2 w-2 bg-gray-300 dark:bg-gray-700 transform -translate-x-1/2" />
          <div className="absolute top-1/4 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-800" />
          <div className="absolute top-3/4 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-800" />
        </div>
      </div>

      {/* User Location Marker */}
      {showUserLocation && userLocation && (
        <div 
          className="absolute z-20 transform -translate-x-1/2 -translate-y-1/2"
          style={{ 
            top: '50%', 
            left: '50%',
          }}
        >
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-30" style={{ width: 32, height: 32 }} />
            <div className="w-8 h-8 bg-blue-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center">
              <Navigation className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>
      )}

      {/* Bus Markers */}
      {visibleBuses.map((bus, index) => {
        const availableSeats = bus.totalCapacity - bus.currentPassengers;
        const isSelected = selectedBusId === bus.id;
        
        // Position buses in different locations on the map
        const positions = [
          { top: '30%', left: '25%' },
          { top: '45%', left: '70%' },
          { top: '60%', left: '40%' },
          { top: '25%', left: '60%' },
          { top: '70%', left: '20%' },
          { top: '55%', left: '80%' },
        ];
        const pos = positions[index % positions.length];
        
        return (
          <div
            key={bus.id}
            className={`absolute z-10 transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-110 ${
              isSelected ? 'scale-110 z-30' : ''
            }`}
            style={{ top: pos.top, left: pos.left }}
            onClick={() => onBusClick?.(bus)}
            data-testid={`bus-marker-${bus.id}`}
          >
            <div className={`relative ${isSelected ? 'ring-4 ring-primary/50 rounded-xl' : ''}`}>
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center shadow-lg ${
                availableSeats === 0 
                  ? 'bg-destructive' 
                  : availableSeats <= 3 
                    ? 'bg-yellow-500' 
                    : 'bg-primary'
              }`}>
                <Bus className="h-6 w-6 text-white" />
              </div>
              {/* Seats badge */}
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-white dark:bg-card rounded-full flex items-center justify-center shadow-md border border-border">
                <span className="text-xs font-bold">{availableSeats}</span>
              </div>
            </div>
          </div>
        );
      })}

      {/* Route waypoints */}
      {waypoints.map((waypoint, index) => (
        <div
          key={waypoint.id}
          className="absolute z-5 transform -translate-x-1/2 -translate-y-1/2"
          style={{ 
            top: `${30 + (index * 15) % 60}%`, 
            left: `${20 + (index * 20) % 70}%` 
          }}
        >
          <div className="w-4 h-4 bg-accent rounded-full border-2 border-primary" />
          {waypoint.name && (
            <span className="absolute top-5 left-1/2 -translate-x-1/2 text-xs bg-background px-1 rounded whitespace-nowrap">
              {waypoint.name}
            </span>
          )}
        </div>
      ))}

      {/* Empty state */}
      {visibleBuses.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
          <Bus className="h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">لا توجد باصات متاحة حالياً</p>
          <p className="text-sm text-muted-foreground">سيتم عرض الباصات عند توفرها</p>
        </div>
      )}

      {/* Map controls */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-2">
        <button 
          className="w-10 h-10 bg-card rounded-md shadow-md flex items-center justify-center hover-elevate"
          data-testid="button-zoom-in"
        >
          <span className="text-xl font-medium">+</span>
        </button>
        <button 
          className="w-10 h-10 bg-card rounded-md shadow-md flex items-center justify-center hover-elevate"
          data-testid="button-zoom-out"
        >
          <span className="text-xl font-medium">−</span>
        </button>
      </div>

      {/* Current location button */}
      {showUserLocation && (
        <button 
          className="absolute bottom-4 right-4 w-10 h-10 bg-card rounded-md shadow-md flex items-center justify-center hover-elevate"
          data-testid="button-my-location"
        >
          <Navigation className="h-5 w-5 text-primary" />
        </button>
      )}
    </div>
  );
}
