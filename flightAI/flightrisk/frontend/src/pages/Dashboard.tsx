import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { AlertTriangle, PlaneTakeoff, TrendingUp, Clock } from "lucide-react";
import { api } from "../lib/api";
import type { StatsOverview, Flight } from "../types";
import { useAuthStore } from "../store/authStore";

function StatCard({ icon: Icon, label, value, color, delay }: { icon: any; label: string; value: string | number; color: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-xl p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <p className="font-mono text-3xl font-semibold">{value}</p>
      <p className="text-sm text-[var(--color-steel)] mt-1">{label}</p>
    </motion.div>
  );
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);

  useEffect(() => {
    api.statsOverview().then(setStats);
    api.listFlights().then((f) => setFlights(f.slice(0, 5)));
  }, []);

  return (
    <div>
      <div className="mb-8">
        <p className="font-mono text-xs text-[var(--color-amber)] uppercase tracking-widest">
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h1 className="font-display text-3xl font-bold mt-1">
          Welcome back, {user?.full_name}
        </h1>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard icon={PlaneTakeoff} label="Total flights" value={stats.total_flights} color="var(--color-amber)" delay={0} />
          <StatCard icon={AlertTriangle} label="Critical risk" value={stats.risk_counts.CRITICAL ?? 0} color="var(--color-critical)" delay={0.05} />
          <StatCard icon={Clock} label="Pending decisions" value={stats.pending_decisions} color="var(--color-high)" delay={0.1} />
          <StatCard icon={TrendingUp} label="Analyses run" value={stats.total_analyses} color="var(--color-safe)" delay={0.15} />
        </div>
      )}

      <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <h2 className="font-display font-semibold">Upcoming flights</h2>
          <Link to="/app/flights" className="text-xs font-mono text-[var(--color-amber)] hover:underline">
            View all
          </Link>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {flights.map((f, i) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 + i * 0.05 }}
            >
              <Link
                to={`/app/flights/${f.id}`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-[var(--color-panel-hover)] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="font-mono text-sm font-semibold text-[var(--color-amber)]">{f.flight_number}</span>
                  <span className="text-sm text-[var(--color-steel)]">{f.origin} → {f.destination}</span>
                </div>
                <span className="text-xs font-mono text-[var(--color-steel)]">
                  {new Date(f.departure_time).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </Link>
            </motion.div>
          ))}
          {flights.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-[var(--color-steel)]">No flights yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
