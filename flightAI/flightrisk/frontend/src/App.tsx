import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useAuthStore } from "./store/authStore";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Flights from "./pages/Flights";
import FlightDetail from "./pages/FlightDetail";
import NewFlight from "./pages/NewFlight";
import Reports from "./pages/Reports";
import AppLayout from "./layouts/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  const restoreSession = useAuthStore((s) => s.restoreSession);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#121826",
            color: "#EDF1F7",
            border: "1px solid #232C3F",
            fontSize: "13px",
          },
        }}
      />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="flights" element={<Flights />} />
            <Route path="flights/new" element={<NewFlight />} />
            <Route path="flights/:id" element={<FlightDetail />} />
            <Route path="reports" element={<Reports />} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}
