export type Role = "PILOT" | "OPS";
export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
export type Decision = "ACCEPTED" | "MITIGATED" | "REJECTED";

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: Role;
}

export interface Airport {
  iata: string;
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
}

export interface Airline {
  name: string;
  iata: string | null;
  icao: string | null;
  country: string;
}

export interface FlightRoute {
  origin: Airport | null;
  destination: Airport | null;
  distance_km: number | null;
}

export interface Flight {
  id: number;
  flight_number: string;
  origin: string;
  destination: string;
  departure_time: string;
  aircraft_type: string;
  airline_name: string | null;
  distance_km: number | null;
  fuel_reserve_pct: number;
  weather_severity: number;
  traffic_density: number;
  visibility_km: number;
  crew_duty_hours: number;
  aircraft_age_years: number;
  maintenance_score: number;
  runway_condition: number;
  created_at: string;
}

export interface RiskFactor {
  feature: string;
  label: string;
  value: number;
  contribution: number;
  impact_pct: number;
  direction: "increases_risk" | "decreases_risk";
}

export interface Analysis {
  id: number;
  flight_id: number;
  risk_level: RiskLevel;
  confidence: number;
  probabilities: Record<RiskLevel, number>;
  factors: RiskFactor[];
  recommendation: string;
  decision: Decision | null;
  decision_note: string | null;
  created_at: string;
}

export interface StatsOverview {
  total_flights: number;
  risk_counts: Record<string, number>;
  pending_decisions: number;
  total_analyses: number;
}

export interface LiveAircraft {
  icao24: string;
  callsign: string | null;
  latitude: number;
  longitude: number;
  altitude_m: number | null;
  velocity_ms: number | null;
  heading: number | null;
  origin_country: string | null;
}

export interface LiveTraffic {
  aircraft: LiveAircraft[];
  cached: boolean;
  source: string;
  error?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  source?: "rules_engine" | "claude";
}
