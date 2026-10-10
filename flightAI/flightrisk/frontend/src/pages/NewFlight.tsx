import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, PlaneTakeoff, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import type { Airport } from "../types";
import AirportAutocomplete from "../components/AirportAutocomplete";
import AirlineAutocomplete from "../components/AirlineAutocomplete";

const SLIDER_FIELDS: { key: string; label: string; min: number; max: number; step: number; unit: string }[] = [
  { key: "fuel_reserve_pct", label: "Fuel Reserve", min: 0, max: 100, step: 1, unit: "%" },
  { key: "weather_severity", label: "Weather Severity", min: 0, max: 10, step: 0.1, unit: "/10" },
  { key: "traffic_density", label: "Traffic Density", min: 0, max: 10, step: 0.1, unit: "/10" },
  { key: "visibility_km", label: "Visibility", min: 0.2, max: 15, step: 0.1, unit: "km" },
  { key: "crew_duty_hours", label: "Crew Duty Hours", min: 0, max: 16, step: 0.5, unit: "h" },
  { key: "aircraft_age_years", label: "Aircraft Age", min: 0, max: 35, step: 1, unit: "yr" },
  { key: "maintenance_score", label: "Maintenance Score", min: 20, max: 100, step: 1, unit: "/100" },
  { key: "runway_condition", label: "Runway Condition", min: 0, max: 10, step: 0.1, unit: "/10" },
];

export default function NewFlight() {
  const navigate = useNavigate();
  const [flightNumber, setFlightNumber] = useState("");
  const [origin, setOrigin] = useState<Airport | null>(null);
  const [destination, setDestination] = useState<Airport | null>(null);
  const [airline, setAirline] = useState("");
  const [aircraftType, setAircraftType] = useState("A320neo");
  const [departureTime, setDepartureTime] = useState("");
  const [params, setParams] = useState<Record<string, number>>({
    fuel_reserve_pct: 50, weather_severity: 2, traffic_density: 3, visibility_km: 10,
    crew_duty_hours: 3, aircraft_age_years: 6, maintenance_score: 90, runway_condition: 1,
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!origin || !destination) {
      toast.error("Pick both origin and destination airports");
      return;
    }
    if (origin.iata === destination.iata) {
      toast.error("Origin and destination can't be the same airport");
      return;
    }
    setSubmitting(true);
    try {
      const flight = await api.createFlight({
        flight_number: flightNumber || `${airline.slice(0, 2).toUpperCase() || "XX"}-${Math.floor(1000 + Math.random() * 8999)}`,
        origin: origin.iata,
        destination: destination.iata,
        departure_time: new Date(departureTime || Date.now() + 3600_000).toISOString(),
        aircraft_type: aircraftType,
        airline_name: airline || undefined,
        ...params,
      } as any);
      toast.success("Flight created");
      navigate(`/app/flights/${flight.id}`);
    } catch {
      toast.error("Could not create flight");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm text-[var(--color-steel)] hover:text-[var(--color-ink)] mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <h1 className="font-display text-3xl font-bold mb-1">New Flight</h1>
      <p className="text-sm text-[var(--color-steel)] mb-8">
        Search real airports — distance is computed automatically from great-circle coordinates.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4">
          <AirportAutocomplete label="Origin" value={origin} onChange={setOrigin} placeholder="e.g. Mumbai or BOM" />
          <AirportAutocomplete label="Destination" value={destination} onChange={setDestination} placeholder="e.g. Delhi or DEL" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <AirlineAutocomplete label="Airline" value={airline} onChange={setAirline} />
          <div>
            <label className="text-xs font-mono text-[var(--color-steel)] uppercase tracking-wide">Aircraft type</label>
            <input
              value={aircraftType}
              onChange={(e) => setAircraftType(e.target.value)}
              className="mt-1.5 w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[var(--color-amber)] transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-mono text-[var(--color-steel)] uppercase tracking-wide">Flight number</label>
            <input
              value={flightNumber}
              onChange={(e) => setFlightNumber(e.target.value)}
              placeholder="auto-generated if blank"
              className="mt-1.5 w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[var(--color-amber)] transition-colors"
            />
          </div>
          <div>
            <label className="text-xs font-mono text-[var(--color-steel)] uppercase tracking-wide">Departure</label>
            <input
              type="datetime-local"
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value)}
              className="mt-1.5 w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[var(--color-amber)] transition-colors"
            />
          </div>
        </div>

        <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-2xl p-6">
          <p className="text-xs text-[var(--color-steel)] uppercase tracking-wide mb-5">Risk input parameters</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-5">
            {SLIDER_FIELDS.map((f) => (
              <div key={f.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm">{f.label}</label>
                  <span className="font-mono text-xs text-[var(--color-amber)]">{params[f.key]}{f.unit}</span>
                </div>
                <input
                  type="range"
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  value={params[f.key]}
                  onChange={(e) => setParams((p) => ({ ...p, [f.key]: Number(e.target.value) }))}
                  className="w-full accent-[var(--color-amber)]"
                />
              </div>
            ))}
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center gap-2 bg-[var(--color-amber)] text-[var(--color-bg)] font-semibold px-5 py-3 rounded-lg hover:brightness-110 transition-all disabled:opacity-60"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlaneTakeoff className="w-4 h-4" />}
          Create flight
        </motion.button>
      </form>
    </div>
  );
}
