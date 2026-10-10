
import axios from "axios";
import type { Airport, RouteResponse } from "../types/route";

const AI_BASE_URL =
  import.meta.env.VITE_AI_BASE_URL || "http://127.0.0.1:8000/api/planner";

const ai = axios.create({
  baseURL: AI_BASE_URL,
  timeout: 30000,
});

export const routeApi = {
  searchAirports: (q: string) =>
    ai
      .get<Airport[]>("/airports/search", { params: { q } })
      .then((response) => response.data),

  find: (body: {
    origin: string;
    destination: string;
    fuelPercent: number;
    safetyWeight: number;
    avoidCritical: boolean;
  }) =>
    ai
      .post<RouteResponse>("/route/find", body)
      .then((response) => response.data),
};
