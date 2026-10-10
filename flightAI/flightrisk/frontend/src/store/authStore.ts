import { create } from "zustand";
import type { User } from "../types";
import { api } from "../lib/api";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string, role: string, inviteCode?: string) => Promise<void>;
  logout: () => void;
  restoreSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  login: async (email, password) => {
    const res = await api.login(email, password);
    localStorage.setItem("flightrisk_token", res.access_token);
    set({ user: res.user });
  },

  register: async (email, password, fullName, role, inviteCode) => {
    const res = await api.register(email, password, fullName, role, inviteCode);
    localStorage.setItem("flightrisk_token", res.access_token);
    set({ user: res.user });
  },

  logout: () => {
    localStorage.removeItem("flightrisk_token");
    set({ user: null });
  },

  restoreSession: async () => {
    const token = localStorage.getItem("flightrisk_token");
    if (!token) {
      set({ isLoading: false });
      return;
    }
    try {
      const user = await api.me();
      set({ user, isLoading: false });
    } catch {
      localStorage.removeItem("flightrisk_token");
      set({ user: null, isLoading: false });
    }
  },
}));
