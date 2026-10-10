import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Radar, ArrowRight, Gauge, Brain, ShieldCheck } from "lucide-react";
import RiskGauge from "../components/RiskGauge";

export default function Landing() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-ink)] overflow-x-hidden">
      <header className="flex items-center justify-between max-w-6xl mx-auto px-8 py-6">
        <div className="flex items-center gap-2">
          <Radar className="w-6 h-6 text-[var(--color-amber)]" />
          <span className="font-display font-semibold text-lg">FlightRisk</span>
        </div>
        <Link
          to="/login"
          className="text-sm font-medium px-4 py-2 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-amber)] hover:text-[var(--color-amber)] transition-colors"
        >
          Sign in
        </Link>
      </header>

      <section className="max-w-6xl mx-auto px-8 pt-12 pb-24 grid md:grid-cols-2 gap-12 items-center">
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="font-mono text-xs text-[var(--color-amber)] tracking-widest uppercase">
            Pre-flight risk intelligence
          </span>
          <h1 className="font-display text-5xl font-bold mt-4 leading-[1.05] tracking-tight">
            Know the risk<br />before you dispatch.
          </h1>
          <p className="text-[var(--color-steel)] text-lg mt-5 leading-relaxed max-w-md">
            A trained model reads fuel reserves, weather, traffic, and crew fatigue —
            then shows exactly which factor is driving the call, ranked and explained.
          </p>
          <div className="flex items-center gap-4 mt-8">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 bg-[var(--color-amber)] text-[var(--color-bg)] font-semibold px-5 py-3 rounded-lg hover:brightness-110 transition-all"
            >
              Open dashboard <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-6 mt-14 pt-8 border-t border-[var(--color-border)]">
            <div>
              <Brain className="w-5 h-5 text-[var(--color-amber)] mb-2" />
              <p className="text-sm font-medium">Explainable ML</p>
              <p className="text-xs text-[var(--color-steel)] mt-1">Ranked SHAP factors, not a black box</p>
            </div>
            <div>
              <Gauge className="w-5 h-5 text-[var(--color-amber)] mb-2" />
              <p className="text-sm font-medium">Live risk read</p>
              <p className="text-xs text-[var(--color-steel)] mt-1">Four-tier classification per flight</p>
            </div>
            <div>
              <ShieldCheck className="w-5 h-5 text-[var(--color-amber)] mb-2" />
              <p className="text-sm font-medium">Decision trail</p>
              <p className="text-xs text-[var(--color-steel)] mt-1">Every accept/mitigate call logged</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="relative flex items-center justify-center"
        >
          <div className="absolute inset-0 bg-[var(--color-critical)] blur-[120px] opacity-10 rounded-full" />
          <div className="relative bg-[var(--color-panel)] border border-[var(--color-border)] rounded-2xl p-10 panel-grid-bg">
            <p className="font-mono text-xs text-[var(--color-steel)] mb-4">AI-441 · DEL → BLR</p>
            <RiskGauge level="CRITICAL" confidence={0.98} size={320} />
            <p className="text-xs text-[var(--color-steel)] mt-2 max-w-[280px]">
              Weather severity is the top driver — 39% of this call.
            </p>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
