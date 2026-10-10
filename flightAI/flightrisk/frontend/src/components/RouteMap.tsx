import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Marker, Polyline, Tooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { api } from "../lib/api";
import type { FlightRoute, LiveAircraft } from "../types";

const RISK_COLOR: Record<string, string> = {
  LOW: "#3DD68C",
  MODERATE: "#F5A623",
  HIGH: "#F5764A",
  CRITICAL: "#E5484D",
};

const LIVE_POLL_MS = 20000;

function planeIcon(heading: number | null) {
  const rotation = heading ?? 0;
  return L.divIcon({
    className: "",
    html: `<div style="transform: rotate(${rotation}deg); width: 16px; height: 16px; display:flex; align-items:center; justify-content:center;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#4FC1E9"><path d="M22 16.21v-1.895L13.75 9V4a1.75 1.75 0 0 0-3.5 0v5L2 14.315v1.895l8.25-2.573v5.29l-2.4 1.665v1.44L12 21l4.15.031v-1.44l-2.4-1.664v-5.29L22 16.21z"/></svg>
    </div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

interface Props {
  flightId: number;
  riskLevel?: string;
}

export default function RouteMap({ flightId, riskLevel }: Props) {
  const [route, setRoute] = useState<FlightRoute | null>(null);
  const [liveAircraft, setLiveAircraft] = useState<LiveAircraft[]>([]);
  const [liveStatus, setLiveStatus] = useState<"loading" | "ok" | "unavailable">("loading");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.getFlightRoute(flightId).then(setRoute);
  }, [flightId]);

  useEffect(() => {
    async function poll() {
      try {
        const res = await api.getLiveTraffic(flightId);
        setLiveAircraft(res.aircraft);
        setLiveStatus(res.error ? "unavailable" : "ok");
      } catch {
        setLiveStatus("unavailable");
      }
    }
    poll();
    pollRef.current = setInterval(poll, LIVE_POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [flightId]);

  if (!route || !route.origin || !route.destination) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-[var(--color-steel)]">
        Route data unavailable
      </div>
    );
  }

  const { origin, destination, distance_km } = route;
  const lineColor = riskLevel ? RISK_COLOR[riskLevel] ?? "#F5A623" : "#F5A623";
  const midLat = (origin.latitude + destination.latitude) / 2;
  const midLon = (origin.longitude + destination.longitude) / 2;

  // simple curved great-circle-ish path via a midpoint bow
  const bowOffset = 0.15;
  const dx = destination.longitude - origin.longitude;
  const dy = destination.latitude - origin.latitude;
  const curvedMid: [number, number] = [midLat + dx * bowOffset, midLon - dy * bowOffset];

  return (
    <div className="h-full w-full rounded-xl overflow-hidden relative">
      <MapContainer
        center={[midLat, midLon]}
        zoom={3}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%", background: "#0A0E1A" }}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <Polyline
          positions={[[origin.latitude, origin.longitude], curvedMid, [destination.latitude, destination.longitude]]}
          pathOptions={{ color: lineColor, weight: 2.5, opacity: 0.85, dashArray: "6 4" }}
        />
        <CircleMarker
          center={[origin.latitude, origin.longitude]}
          radius={6}
          pathOptions={{ color: "#F5A623", fillColor: "#F5A623", fillOpacity: 1, weight: 2 }}
        >
          <Tooltip permanent direction="top" offset={[0, -8]} className="!bg-transparent !border-0 !shadow-none !text-[10px]">
            <span className="font-mono text-[var(--color-ink)]">{origin.iata}</span>
          </Tooltip>
        </CircleMarker>
        <CircleMarker
          center={[destination.latitude, destination.longitude]}
          radius={6}
          pathOptions={{ color: lineColor, fillColor: lineColor, fillOpacity: 1, weight: 2 }}
        >
          <Tooltip permanent direction="top" offset={[0, -8]} className="!bg-transparent !border-0 !shadow-none !text-[10px]">
            <span className="font-mono text-[var(--color-ink)]">{destination.iata}</span>
          </Tooltip>
        </CircleMarker>

        {liveAircraft.map((ac) => (
          <Marker key={ac.icao24} position={[ac.latitude, ac.longitude]} icon={planeIcon(ac.heading)}>
            <Tooltip direction="top" offset={[0, -6]}>
              <div className="font-mono text-[11px]">
                <div className="font-semibold">{ac.callsign || ac.icao24}</div>
                {ac.altitude_m != null && <div>{Math.round(ac.altitude_m)}m alt</div>}
                {ac.velocity_ms != null && <div>{Math.round(ac.velocity_ms * 3.6)} km/h</div>}
                {ac.origin_country && <div className="text-[var(--color-steel)]">{ac.origin_country}</div>}
              </div>
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>

      {distance_km && (
        <div className="absolute bottom-2 right-2 bg-[var(--color-panel)]/90 border border-[var(--color-border)] rounded-lg px-3 py-1.5 z-[1000]">
          <span className="font-mono text-xs text-[var(--color-steel)]">
            {distance_km.toLocaleString()} km &middot; {origin.city} → {destination.city}
          </span>
        </div>
      )}

      <div className="absolute top-2 left-2 z-[1000] bg-[var(--color-panel)]/90 border border-[var(--color-border)] rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
        <span
          className={`w-1.5 h-1.5 rounded-full ${liveStatus === "ok" ? "bg-[var(--color-safe)] animate-pulse" : "bg-[var(--color-steel)]"}`}
        />
        <span className="font-mono text-[10px] text-[var(--color-steel)]">
          {liveStatus === "loading" && "connecting to live ADS-B..."}
          {liveStatus === "ok" && `${liveAircraft.length} live aircraft in corridor`}
          {liveStatus === "unavailable" && "live traffic unavailable"}
        </span>
      </div>
    </div>
  );
}
