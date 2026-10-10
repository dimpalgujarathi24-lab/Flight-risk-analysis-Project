import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Search, PlaneTakeoff, Plus } from "lucide-react";
import { api } from "../lib/api";
import type { Flight } from "../types";

export default function Flights() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    api.listFlights().then(setFlights);
  }, []);

  const filtered = flights.filter(
    (f) =>
      f.flight_number.toLowerCase().includes(query.toLowerCase()) ||
      f.origin.toLowerCase().includes(query.toLowerCase()) ||
      f.destination.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl font-bold">Flights</h1>
        <Link
          to="/app/flights/new"
          className="inline-flex items-center gap-2 bg-[var(--color-amber)] text-[var(--color-bg)] font-semibold px-4 py-2.5 rounded-lg hover:brightness-110 transition-all text-sm"
        >
          <Plus className="w-4 h-4" /> New flight
        </Link>
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-steel)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by flight number or route..."
          className="w-full bg-[var(--color-panel)] border border-[var(--color-border)] rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[var(--color-amber)] transition-colors"
        />
      </div>

      <div className="grid gap-3">
        {filtered.map((f, i) => (
          <motion.div
            key={f.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.3 }}
          >
            <Link
              to={`/app/flights/${f.id}`}
              className="flex items-center justify-between bg-[var(--color-panel)] border border-[var(--color-border)] rounded-xl px-5 py-4 hover:border-[var(--color-amber)] transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-[var(--color-bg)] flex items-center justify-center border border-[var(--color-border)]">
                  <PlaneTakeoff className="w-4 h-4 text-[var(--color-amber)]" />
                </div>
                <div>
                  <p className="font-mono text-sm font-semibold">{f.flight_number}</p>
                  <p className="text-xs text-[var(--color-steel)] mt-0.5">{f.aircraft_type}</p>
                </div>
              </div>
              <div className="text-sm text-[var(--color-steel)]">
                {f.origin} <span className="text-[var(--color-border)] mx-1">→</span> {f.destination}
              </div>
              <span className="text-xs font-mono text-[var(--color-steel)]">
                {new Date(f.departure_time).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            </Link>
          </motion.div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-[var(--color-steel)] py-12">No flights match your search.</p>
        )}
      </div>
    </div>
  );
}
