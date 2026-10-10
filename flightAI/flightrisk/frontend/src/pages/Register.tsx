import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, Link } from "react-router-dom";
import { Radar, Loader2, PlaneTakeoff, ShieldCheck, KeyRound } from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore } from "../store/authStore";
import { ApiError } from "../lib/api";

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"PILOT" | "OPS">("PILOT");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await register(email, password, fullName, role, role === "OPS" ? inviteCode : undefined);
      toast.success("Account created");
      navigate("/app");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] panel-grid-bg px-6 py-10">
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

        <h1 className="font-display text-xl font-semibold mb-1">Create account</h1>
        <p className="text-sm text-[var(--color-steel)] mb-6">Join as a pilot or ops crew member</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-mono text-[var(--color-steel)] uppercase tracking-wide">Full name</label>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1.5 w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[var(--color-amber)] transition-colors"
              placeholder="Capt. Jordan Blake"
            />
          </div>
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
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[var(--color-amber)] transition-colors"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label className="text-xs font-mono text-[var(--color-steel)] uppercase tracking-wide mb-1.5 block">Role</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole("PILOT")}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                  role === "PILOT"
                    ? "border-[var(--color-amber)] text-[var(--color-amber)] bg-[var(--color-amber)]/10"
                    : "border-[var(--color-border)] text-[var(--color-steel)] hover:text-[var(--color-ink)]"
                }`}
              >
                <PlaneTakeoff className="w-4 h-4" /> Pilot
              </button>
              <button
                type="button"
                onClick={() => setRole("OPS")}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                  role === "OPS"
                    ? "border-[var(--color-amber)] text-[var(--color-amber)] bg-[var(--color-amber)]/10"
                    : "border-[var(--color-border)] text-[var(--color-steel)] hover:text-[var(--color-ink)]"
                }`}
              >
                <ShieldCheck className="w-4 h-4" /> Ops
              </button>
            </div>
          </div>

          <AnimatePresence>
            {role === "OPS" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <label className="text-xs font-mono text-[var(--color-steel)] uppercase tracking-wide">Ops invite code</label>
                <div className="relative mt-1.5">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-steel)]" />
                  <input
                    required={role === "OPS"}
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-[var(--color-amber)] transition-colors"
                    placeholder="Provided by your ops manager"
                  />
                </div>
                <p className="text-[11px] text-[var(--color-steel)] mt-1.5">
                  Ops accounts see the entire fleet, so signup requires an invite code from your organization.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 bg-[var(--color-amber)] text-[var(--color-bg)] font-semibold rounded-lg py-2.5 text-sm flex items-center justify-center gap-2 hover:brightness-110 transition-all disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Create account
          </button>
        </form>

        <p className="text-center text-xs text-[var(--color-steel)] mt-5">
          Already have an account?{" "}
          <Link to="/login" className="text-[var(--color-amber)] hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
