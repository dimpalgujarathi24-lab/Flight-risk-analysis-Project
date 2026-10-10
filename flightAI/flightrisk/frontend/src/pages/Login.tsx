import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, Link } from "react-router-dom";
import { Radar, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore } from "../store/authStore";
import { ApiError } from "../lib/api";
export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Signed in");
      navigate("/app");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(role: "pilot" | "ops") {
    setEmail(`${role}@flightrisk.demo`);
    setPassword("demo1234");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] panel-grid-bg px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm bg-[var(--color-panel)] border border-[var(--color-border)] rounded-2xl p-8"
      >
        <div className="flex items-center gap-2 mb-6">
          <Radar className="w-6 h-6 text-[var(--color-amber)]" />
          <span className="font-display font-semibold text-lg">FlightRisk</span>
        </div>

        <h1 className="font-display text-xl font-semibold mb-1">Sign in</h1>
        <p className="text-sm text-[var(--color-steel)] mb-6">Access your risk dashboard</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-mono text-[var(--color-steel)] uppercase tracking-wide">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[var(--color-amber)] transition-colors"
              placeholder="you@airline.com"
            />
          </div>
          <div>
            <label className="text-xs font-mono text-[var(--color-steel)] uppercase tracking-wide">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[var(--color-amber)] transition-colors"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-2 bg-[var(--color-amber)] text-[var(--color-bg)] font-semibold rounded-lg py-2.5 text-sm flex items-center justify-center gap-2 hover:brightness-110 transition-all disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Sign in
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-steel)] mb-2">Try a demo account</p>
          <div className="flex gap-2">
            <button
              onClick={() => fillDemo("pilot")}
              className="flex-1 text-xs font-mono border border-[var(--color-border)] rounded-lg py-2 hover:border-[var(--color-amber)] transition-colors"
            >
              Pilot
            </button>
            <button
              onClick={() => fillDemo("ops")}
              className="flex-1 text-xs font-mono border border-[var(--color-border)] rounded-lg py-2 hover:border-[var(--color-amber)] transition-colors"
            >
              Ops
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-[var(--color-steel)] mt-5">
          New here?{" "}
          <Link to="/register" className="text-[var(--color-amber)] hover:underline font-medium">
            Create an account
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
