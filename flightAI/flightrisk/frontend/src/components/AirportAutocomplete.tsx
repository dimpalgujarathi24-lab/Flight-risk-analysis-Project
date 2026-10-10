import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { api } from "../lib/api";
import type { Airport } from "../types";

interface Props {
  label: string;
  value: Airport | null;
  onChange: (airport: Airport | null) => void;
  placeholder?: string;
}

export default function AirportAutocomplete({ label, value, onChange, placeholder }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Airport[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleInput(v: string) {
    setQuery(v);
    onChange(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.searchAirports(v.trim());
        setResults(res);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 250);
  }

  function select(airport: Airport) {
    onChange(airport);
    setQuery(`${airport.iata} — ${airport.city}`);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="text-xs font-mono text-[var(--color-steel)] uppercase tracking-wide">{label}</label>
      <div className="relative mt-1.5">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-steel)]" />
        <input
          value={value ? `${value.iata} — ${value.city}` : query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder ?? "Search city or airport code..."}
          className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg pl-9 pr-8 py-2.5 text-sm outline-none focus:border-[var(--color-amber)] transition-colors"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-steel)] animate-spin" />}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-[var(--color-panel)] border border-[var(--color-border)] rounded-lg shadow-xl scrollbar-thin">
          {results.map((a) => (
            <button
              key={a.iata}
              type="button"
              onClick={() => select(a)}
              className="w-full text-left px-3 py-2.5 hover:bg-[var(--color-panel-hover)] transition-colors border-b border-[var(--color-border)] last:border-0"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{a.city}, {a.country}</span>
                <span className="font-mono text-xs text-[var(--color-amber)]">{a.iata}</span>
              </div>
              <p className="text-xs text-[var(--color-steel)] mt-0.5 truncate">{a.name}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
