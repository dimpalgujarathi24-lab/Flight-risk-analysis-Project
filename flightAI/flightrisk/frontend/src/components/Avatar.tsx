const PALETTE = [
  "#F5A623", "#3DD68C", "#F5764A", "#5B9BD5", "#B37FEB", "#E5484D", "#4FC1E9", "#E0C36E",
];

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface Props {
  name: string;
  size?: number;
  className?: string;
}

export default function Avatar({ name, size = 36, className = "" }: Props) {
  const color = PALETTE[hashString(name) % PALETTE.length];
  return (
    <div
      className={`flex items-center justify-center rounded-full font-display font-semibold shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: `${color}26`,
        color,
        border: `1.5px solid ${color}55`,
        fontSize: size * 0.38,
      }}
    >
      {initials(name)}
    </div>
  );
}
