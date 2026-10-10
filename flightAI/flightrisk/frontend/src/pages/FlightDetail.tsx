import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Zap, Check, ShieldAlert, XCircle, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import type { Flight, Analysis } from "../types";
import RiskGauge from "../components/RiskGauge";
import RouteMap from "../components/RouteMap";
import RiskChat from "../components/RiskChat";
import SaferRoutePanel from "../components/SaferRoutePanel";

const RISK_COLOR: Record<string, string> = {
  LOW: "var(--color-safe)",
  MODERATE: "var(--color-amber)",
  HIGH: "var(--color-high)",
  CRITICAL: "var(--color-critical)",
};

const FEATURE_UNITS: Record<string, string> = {
  fuel_reserve_pct: "%",
  weather_severity: "/10",
  traffic_density: "/10",
  visibility_km: "km",
  crew_duty_hours: "h",
  aircraft_age_years: "yr",
  maintenance_score: "/100",
  runway_condition: "/10",
};

export default function FlightDetail() {
  const { id } = useParams();
  const [flight, setFlight] = useState<Flight | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [decidingWith, setDecidingWith] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.getFlight(Number(id)).then(setFlight);
    api.listAnalyses(Number(id)).then((a) => setAnalysis(a[0] ?? null));
  }, [id]);

  async function runAnalysis() {
    if (!id) return;
    setAnalyzing(true);
    try {
      const result = await api.analyzeFlight(Number(id));
      setAnalysis(result);
      toast.success(`Risk assessed: ${result.risk_level}`);
    } catch {
      toast.error("Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  async function decide(decision: string) {
    if (!analysis) return;
    setDecidingWith(decision);
    try {
      const updated = await api.recordDecision(analysis.id, decision);
      setAnalysis(updated);
      toast.success(`Decision recorded: ${decision}`);
    } catch {
      toast.error("Could not record decision");
    } finally {
      setDecidingWith(null);
    }
  }

  if (!flight) return null;

  return (
    <div>
      <Link to="/app/flights" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-steel)] hover:text-[var(--color-ink)] mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to flights
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold">{flight.flight_number}</h1>
          <p className="text-[var(--color-steel)] mt-1">
            {flight.origin} <span className="mx-1.5">→</span> {flight.destination} &middot; {flight.aircraft_type}
            {flight.airline_name && <> &middot; {flight.airline_name}</>}
            {flight.distance_km && <> &middot; {flight.distance_km.toLocaleString()} km</>}
          </p>
          <p className="font-mono text-xs text-[var(--color-steel)] mt-1">
            Departs {new Date(flight.departure_time).toLocaleString()}
          </p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={analyzing}
          className="inline-flex items-center gap-2 bg-[var(--color-amber)] text-[var(--color-bg)] font-semibold px-4 py-2.5 rounded-lg hover:brightness-110 transition-all disabled:opacity-60"
        >
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {analysis ? "Re-run analysis" : "Run risk analysis"}
        </button>
      </div>

      {/* Route map */}
      <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-2xl overflow-hidden mb-6" style={{ height: 280 }}>
        <RouteMap flightId={flight.id} riskLevel={analysis?.risk_level} />
      </div>

      {/* Flight parameters grid */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {([
          ["fuel_reserve_pct", "Fuel Reserve"],
          ["weather_severity", "Weather"],
          ["traffic_density", "Traffic"],
          ["visibility_km", "Visibility"],
          ["crew_duty_hours", "Duty Hours"],
          ["aircraft_age_years", "Aircraft Age"],
          ["maintenance_score", "Maintenance"],
          ["runway_condition", "Runway"],
        ] as [keyof Flight, string][]).map(([key, label]) => (
          <div key={key} className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-lg px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-[var(--color-steel)]">{label}</p>
            <p className="font-mono text-sm font-semibold mt-0.5">
              {flight[key]}{FEATURE_UNITS[key]}
            </p>
          </div>
        ))}
      </div>

      {analysis && (
        <SaferRoutePanel
          origin={flight.origin}
          destination={flight.destination}
          fuelPercent={flight.fuel_reserve_pct}
          riskLevel={analysis.risk_level}
        />
      )}

      <AnimatePresence mode="wait">
        {analysis && (
          <motion.div
            key={analysis.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="grid md:grid-cols-2 gap-6"
          >
            {/* Gauge panel */}
            <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-2xl p-6 flex flex-col items-center justify-center panel-grid-bg">
              <RiskGauge level={analysis.risk_level} confidence={analysis.confidence} size={280} />
              <div className="w-full mt-4 pt-4 border-t border-[var(--color-border)]">
                <p className="text-xs text-[var(--color-steel)] uppercase tracking-wide mb-2">Recommendation</p>
                <p className="text-sm leading-relaxed">{analysis.recommendation}</p>
              </div>
            </div>

            {/* Factors panel */}
            <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-2xl p-6">
              <p className="text-xs text-[var(--color-steel)] uppercase tracking-wide mb-4">Ranked contributing factors</p>
              <div className="flex flex-col gap-3">
                {analysis.factors.map((f, i) => (
                  <motion.div
                    key={f.feature}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.06 }}
                  >
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium">{f.label}</span>
                      <span className="font-mono text-xs text-[var(--color-steel)]">
                        {f.value}{FEATURE_UNITS[f.feature]} &middot; {f.impact_pct}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-[var(--color-bg)] rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: RISK_COLOR[analysis.risk_level] }}
                        initial={{ width: 0 }}
                        animate={{ width: `${f.impact_pct}%` }}
                        transition={{ delay: 0.15 + i * 0.06, duration: 0.5 }}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="mt-6 pt-5 border-t border-[var(--color-border)]">
                {analysis.decision ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-[var(--color-safe)]" />
                    <span>Decision: <strong>{analysis.decision}</strong></span>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-[var(--color-steel)] uppercase tracking-wide mb-3">Record decision</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => decide("ACCEPTED")}
                        disabled={!!decidingWith}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium border border-[var(--color-safe)] text-[var(--color-safe)] rounded-lg py-2 hover:bg-[var(--color-safe)]/10 transition-colors disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" /> Accept
                      </button>
                      <button
                        onClick={() => decide("MITIGATED")}
                        disabled={!!decidingWith}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium border border-[var(--color-amber)] text-[var(--color-amber)] rounded-lg py-2 hover:bg-[var(--color-amber)]/10 transition-colors disabled:opacity-50"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" /> Mitigate
                      </button>
                      <button
                        onClick={() => decide("REJECTED")}
                        disabled={!!decidingWith}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium border border-[var(--color-critical)] text-[var(--color-critical)] rounded-lg py-2 hover:bg-[var(--color-critical)]/10 transition-colors disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {analysis && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6"
        >
          <RiskChat analysisId={analysis.id} />
        </motion.div>
      )}

      {!analysis && !analyzing && (
        <div className="text-center py-16 border border-dashed border-[var(--color-border)] rounded-2xl">
          <p className="text-[var(--color-steel)] text-sm">No analysis yet. Run one to see the risk read.</p>
        </div>
      )}
    </div>
  );
}
