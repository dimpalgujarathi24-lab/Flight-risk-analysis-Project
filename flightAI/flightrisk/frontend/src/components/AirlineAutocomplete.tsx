import { useEffect, useRef, useState } from "react";
import { Plane } from "lucide-react";
import { api } from "../lib/api";
import type { Airline } from "../types";

interface Props {
  label: string;
  value: string;
  onChange: (name: string) => void;
}

export default function AirlineAutocomplete({ label, value, onChange }: Props) {
  const [results, setResults] = useState<Airline[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleInput(v: string) {
    onChange(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const res = await api.searchAirlines(v.trim());
      setResults(res);
      setOpen(true);
    }, 250);
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="text-xs font-mono text-[var(--color-steel)] uppercase tracking-wide">{label}</label>
      <div className="relative mt-1.5">
        <Plane className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-steel)]" />
        <input
          value={value}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search airline..."
          className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-[var(--color-amber)] transition-colors"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-[var(--color-panel)] border border-[var(--color-border)] rounded-lg shadow-xl scrollbar-thin">
          {results.map((a) => (
            <button
              key={a.name}
              type="button"
              onClick={() => { onChange(a.name); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-[var(--color-panel-hover)] transition-colors border-b border-[var(--color-border)] last:border-0 flex items-center justify-between"
            >
              <span className="text-sm">{a.name}</span>
              {a.iata && <span className="font-mono text-xs text-[var(--color-amber)]">{a.iata}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
