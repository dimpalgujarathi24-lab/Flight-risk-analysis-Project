import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { api } from "../lib/api";
import type { StatsOverview } from "../types";

const COLORS: Record<string, string> = {
  LOW: "#3DD68C",
  MODERATE: "#F5A623",
  HIGH: "#F5764A",
  CRITICAL: "#E5484D",
  UNANALYZED: "#3E4A63",
};

export default function Reports() {
  const [stats, setStats] = useState<StatsOverview | null>(null);

  useEffect(() => {
    api.statsOverview().then(setStats);
  }, []);

  if (!stats) return null;

  const data = Object.entries(stats.risk_counts)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  return (
    <div>
      <h1 className="font-display text-3xl font-bold mb-8">Reports</h1>

      <div className="grid md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-2xl p-6"
        >
          <p className="text-xs text-[var(--color-steel)] uppercase tracking-wide mb-4">Risk distribution</p>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={3}>
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={COLORS[entry.name]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#121826", border: "1px solid #232C3F", borderRadius: 8, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {data.map((d) => (
              <div key={d.name} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[d.name] }} />
                <span className="text-[var(--color-steel)]">{d.name}</span>
                <span className="font-mono ml-auto">{d.value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-2xl p-6"
        >
          <p className="text-xs text-[var(--color-steel)] uppercase tracking-wide mb-4">Summary</p>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-steel)]">Total flights tracked</span>
              <span className="font-mono text-lg font-semibold">{stats.total_flights}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-steel)]">Analyses run</span>
              <span className="font-mono text-lg font-semibold">{stats.total_analyses}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-steel)]">Awaiting decision (high/critical)</span>
              <span className="font-mono text-lg font-semibold text-[var(--color-high)]">{stats.pending_decisions}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
