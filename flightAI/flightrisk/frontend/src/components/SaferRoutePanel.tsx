import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { AlertTriangle, Loader2, Navigation, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import { routeApi } from "../lib/routeApi";
import type { RiskLevel, RouteResponse } from "../types/route";

const RISK_COLOR: Record<RiskLevel, string> = {
  LOW: "#35D399",
  MODERATE: "#33C9DC",
  HIGH: "#F2A93C",
  CRITICAL: "#E5484D",
};

function FitRouteBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points, { padding: [24, 24] });
  }, [map, points]);
  return null;
}

type Props = {
  origin: string;
  destination: string;
  fuelPercent: number;
  riskLevel: string;
};

export default function SaferRoutePanel({ origin, destination, fuelPercent, riskLevel }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RouteResponse | null>(null);

  async function findSaferRoute() {
    if (!/^[A-Z0-9]{3}$/i.test(origin) || !/^[A-Z0-9]{3}$/i.test(destination)) {
      toast.error("Origin and destination must be valid 3-character airport codes.");
      return;
    }
    if (origin.toUpperCase() === destination.toUpperCase()) {
      toast.error("Origin and destination must be different.");
      return;
    }
    setLoading(true);
    try {
      const response = await routeApi.find({
        origin: origin.toUpperCase(),
        destination: destination.toUpperCase(),
        fuelPercent: Math.max(0, Math.min(100, Number(fuelPercent) || 0)),
        safetyWeight: 2.5,
        avoidCritical: true,
      });
      setResult(response);
    } catch (error: any) {
      const detail = error?.response?.data?.detail || error?.response?.data?.error;
      toast.error(typeof detail === "string" ? detail : "Route search failed. Check that the backend is running on port 8000.");
    } finally {
      setLoading(false);
    }
  }

  const routePositions = useMemo(
    () => result?.routes.safest.nodes.map((n) => [n.lat, n.lon] as [number, number]) ?? [],
    [result],
  );

  return (
    <section className="mt-8 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-2xl p-5 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[var(--color-safe)]" />
            Safer route suggestions
          </h2>
          <p className="text-sm text-[var(--color-steel)] mt-1">
            Check alternate routes and lower-risk airports for {origin} → {destination}.
          </p>
        </div>
        <button
          type="button"
          onClick={findSaferRoute}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 bg-[var(--color-amber)] text-[var(--color-bg)] font-semibold px-4 py-2.5 rounded-lg hover:brightness-110 disabled:opacity-60"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
          {loading ? "Checking routes…" : result ? "Refresh route suggestions" : "Find safer route"}
        </button>
      </div>

      <p className="text-xs text-[var(--color-steel)] mb-4">
        Current flight-analysis rating: <strong>{riskLevel}</strong>. Route planning uses a separate eight-feature model and live-weather data when available, so its risk ratings may differ.
      </p>

      {result && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--color-border)] p-4">
            <p className="text-sm leading-relaxed">{result.summary}</p>
            {result.notes.map((note) => (
              <p key={note} className="mt-2 text-xs text-[var(--color-amber)] flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {note}
              </p>
            ))}
            <p className="mt-2 text-xs text-[var(--color-steel)]">
              {result.liveWeather ? "Live weather was retrieved for all assessed airports." : "Weather service was unavailable for one or more airports; neutral fallback values were used. These are not live observations."}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            {(["safest", "shortest", "fewest"] as const).map((key) => {
              const route = result.routes[key];
              const color = RISK_COLOR[route.worstLevel];
              return (
                <div key={key} className="rounded-xl border border-[var(--color-border)] p-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--color-steel)]">{route.label}</p>
                  <p className="font-mono text-sm mt-2 break-words">{route.path.join(" → ")}</p>
                  <div className="flex items-center justify-between gap-2 mt-3 text-xs">
                    <span>{route.distanceKm.toLocaleString()} km · {route.stops} stop(s)</span>
                    <span className="font-mono" style={{ color }}>{route.worstLevel}</span>
                  </div>
                  <p className="text-xs text-[var(--color-steel)] mt-1">Average risk score: {route.avgRisk.toFixed(2)}</p>
                </div>
              );
            })}
          </div>

          <div className="h-72 rounded-xl overflow-hidden border border-[var(--color-border)]">
            <MapContainer center={[20, 78]} zoom={4} className="h-full w-full" scrollWheelZoom={false}>
              
<TileLayer
  attribution='&copy; OpenStreetMap contributors'
  url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
/>

              <FitRouteBounds points={routePositions} />
              {routePositions.length > 1 && (
                <Polyline positions={routePositions} pathOptions={{ color: "#168DAB", weight: 4 }} />
              )}
              {result.routes.safest.nodes.map((node) => (
                <CircleMarker key={node.iata} center={[node.lat, node.lon]} radius={6}
                  pathOptions={{ color: "#fff", weight: 1, fillColor: RISK_COLOR[node.riskLevel], fillOpacity: 1 }}>
                  <Tooltip>{node.iata} · {node.city} · {node.riskLevel}</Tooltip>
                </CircleMarker>
              ))}
              {result.alternates.map((alternate) => (
                <CircleMarker key={alternate.iata} center={[alternate.lat, alternate.lon]} radius={7}
                  pathOptions={{ color: "#fff", weight: 2, fillColor: "#A78BFA", fillOpacity: 1 }}>
                  <Tooltip>Alternate: {alternate.iata} · {alternate.city} · {alternate.riskLevel}</Tooltip>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>

          <div>
            <h3 className="font-medium text-sm mb-2">Lower-risk alternate airports</h3>
            {result.alternates.length ? (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                {result.alternates.map((alternate) => (
                  <div key={alternate.iata} className="rounded-xl border border-[var(--color-border)] p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-mono font-semibold">{alternate.iata}</p>
                        <p className="text-sm">{alternate.city || alternate.name}</p>
                        <p className="text-xs text-[var(--color-steel)]">{alternate.country}</p>
                      </div>
                      <span className="text-xs font-mono" style={{ color: RISK_COLOR[alternate.riskLevel] }}>{alternate.riskLevel}</span>
                    </div>
                    <p className="text-xs text-[var(--color-steel)] mt-3">
                      {alternate.distanceFromDestinationKm} km from destination · route {alternate.path.join(" → ")}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-steel)]">No lower-risk alternate airport with a viable route was found within 600 km of the destination.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
