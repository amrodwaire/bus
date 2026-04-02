export interface RouteResult {
  coordinates: [number, number][];
  distanceKm: number;
  durationMin: number;
}

export async function getRouteOnRoad(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): Promise<RouteResult | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (data.code !== "Ok" || !data.routes?.[0]) return null;

    const route = data.routes[0];
    const coords: [number, number][] = route.geometry.coordinates.map(
      (c: [number, number]) => [c[1], c[0]]
    );

    return {
      coordinates: coords,
      distanceKm: Math.round((route.distance / 1000) * 10) / 10,
      durationMin: Math.round(route.duration / 60),
    };
  } catch {
    return null;
  }
}

export async function getMultiSegmentRoute(
  points: { lat: number; lng: number }[]
): Promise<RouteResult | null> {
  if (points.length < 2) return null;
  try {
    const coords = points.map(p => `${p.lng},${p.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (data.code !== "Ok" || !data.routes?.[0]) return null;

    const route = data.routes[0];
    const coordinates: [number, number][] = route.geometry.coordinates.map(
      (c: [number, number]) => [c[1], c[0]]
    );

    return {
      coordinates,
      distanceKm: Math.round((route.distance / 1000) * 10) / 10,
      durationMin: Math.round(route.duration / 60),
    };
  } catch {
    return null;
  }
}

export function getDistanceMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getProjectionOnRoute(
  point: { lat: number; lng: number },
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const dx = to.lng - from.lng;
  const dy = to.lat - from.lat;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return 0;
  const px = point.lng - from.lng;
  const py = point.lat - from.lat;
  return (px * dx + py * dy) / lenSq;
}

export function isNearRoute(
  point: { lat: number; lng: number },
  routeCoords: [number, number][],
  thresholdMeters: number = 2000
): boolean {
  for (let i = 0; i < routeCoords.length; i += 5) {
    const [lat, lng] = routeCoords[i];
    const dist = getDistanceMeters(point.lat, point.lng, lat, lng);
    if (dist <= thresholdMeters) return true;
  }
  return false;
}

export function hasBusPassed(
  busPos: { lat: number; lng: number },
  userPos: { lat: number; lng: number },
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): boolean {
  const busProj = getProjectionOnRoute(busPos, from, to);
  const userProj = getProjectionOnRoute(userPos, from, to);
  return busProj > userProj;
}
