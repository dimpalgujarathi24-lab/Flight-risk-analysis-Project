import type { User, Flight, Analysis, StatsOverview, Airport, Airline, FlightRoute, LiveTraffic } from "../types";

const BASE_URL = "http://localhost:8000/api";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getToken(): string | null {
  return localStorage.getItem("flightrisk_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* noop */
    }
    throw new ApiError(detail, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    request<{ access_token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string, full_name: string, role: string, invite_code?: string) =>
    request<{ access_token: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, full_name, role, invite_code }),
    }),

  me: () => request<User>("/auth/me"),

  listFlights: () => request<Flight[]>("/flights"),

  getFlight: (id: number) => request<Flight>(`/flights/${id}`),

  createFlight: (payload: Partial<Flight>) =>
    request<Flight>("/flights", { method: "POST", body: JSON.stringify(payload) }),

  listAnalyses: (flightId: number) => request<Analysis[]>(`/flights/${flightId}/analyses`),

  analyzeFlight: (flightId: number) =>
    request<Analysis>(`/flights/${flightId}/analyze`, { method: "POST" }),

  recordDecision: (analysisId: number, decision: string, note?: string) =>
    request<Analysis>(`/flights/analyses/${analysisId}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision, note }),
    }),

  statsOverview: () => request<StatsOverview>("/stats/overview"),

  searchAirports: (q: string) => request<Airport[]>(`/airports/search?q=${encodeURIComponent(q)}`),

  searchAirlines: (q: string) => request<Airline[]>(`/airlines/search?q=${encodeURIComponent(q)}`),

  getFlightRoute: (flightId: number) => request<FlightRoute>(`/flights/${flightId}/route`),

  getLiveTraffic: (flightId: number) => request<LiveTraffic>(`/flights/${flightId}/live-traffic`),

  askAboutAnalysis: (analysisId: number, question: string) =>
    request<{ answer: string; source: string }>(`/flights/analyses/${analysisId}/ask`, {
      method: "POST",
      body: JSON.stringify({ question }),
    }),
};

export { ApiError };
