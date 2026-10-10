import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  PlaneTakeoff,
  FileBarChart,
  LogOut,
  Radar,
} from "lucide-react";
import { useAuthStore } from "../store/authStore";
import Avatar from "../components/Avatar";

const navItems = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/flights", label: "Flights", icon: PlaneTakeoff },
  { to: "/app/reports", label: "Reports", icon: FileBarChart },
];

export default function AppLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex bg-[var(--color-bg)]">
      <aside className="w-60 shrink-0 border-r border-[var(--color-border)] flex flex-col py-6 px-4">
        <div className="flex items-center gap-2 px-2 mb-8">
          <Radar
            className="w-6 h-6 text-[var(--color-amber)]"
            strokeWidth={2}
          />
          <span className="font-display font-semibold text-lg tracking-tight">
            FlightRisk
          </span>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[var(--color-panel)] text-[var(--color-amber)]"
                    : "text-[var(--color-steel)] hover:text-[var(--color-ink)] hover:bg-[var(--color-panel)]"
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-[var(--color-border)] pt-4 mt-4">
          <div className="flex items-center gap-2.5 px-2 mb-3">
            <Avatar name={user?.full_name ?? "?"} size={34} />

            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--color-ink)] truncate">
                {user?.full_name ?? "User"}
              </p>
              <p className="text-xs font-mono text-[var(--color-steel)] mt-0.5">
                {user?.role ?? ""}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--color-steel)] hover:text-[var(--color-critical)] hover:bg-[var(--color-panel)] transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 panel-grid-bg bg-[image:none] overflow-y-auto">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="max-w-6xl mx-auto px-8 py-8"
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}