export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export interface Airport {
  iata: string;
  name: string;
  city: string;
  country: string;
}

export interface NodeWeather {
  severity: number;
  visibilityKm: number;
  windKts: number;
  tempC: number;
  live: boolean;
}

export interface NodeInfo extends Airport {
  lat: number;
  lon: number;
  riskLevel: RiskLevel;
  riskScore: number;
  confidence: number;
  weather: NodeWeather;
  features: Record<string, number>;
  topFactors: { feature: string; impact: number }[];
}

export interface Leg {
  from: string;
  to: string;
  distanceKm: number;
  airlines: string[];
}

export interface RouteOption {
  label: string;
  path: string[];
  legs: Leg[];
  stops: number;
  distanceKm: number;
  avgRisk: number;
  worstLevel: RiskLevel;
  nodes: NodeInfo[];
}

export interface Alternate extends NodeInfo {
  distanceFromDestinationKm: number;
  path: string[];
  distanceKm: number;
}

export interface RouteResponse {
  origin: Airport & { lat: number; lon: number };
  destination: Airport & { lat: number; lon: number };
  directDistanceKm: number;
  liveWeather: boolean;
  summary: string;
  notes: string[];
  routes: { fewest: RouteOption; shortest: RouteOption; safest: RouteOption };
  alternates: Alternate[];
}