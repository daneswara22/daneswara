import { useState } from "react";
import { LayoutGrid, Grid3x3, List as ListIcon } from "lucide-react";

// Persisted list view mode: "besar" | "kecil" | "list"
export const useViewMode = (key, def = "besar") => {
  const [mode, setMode] = useState(() => localStorage.getItem(key) || def);
  const set = (m) => { setMode(m); localStorage.setItem(key, m); };
  return [mode, set];
};

const OPTIONS = [
  { k: "besar", icon: LayoutGrid, label: "Kartu Besar" },
  { k: "kecil", icon: Grid3x3, label: "Kartu Kecil" },
  { k: "list", icon: ListIcon, label: "List" },
];

export const ViewToggle = ({ mode, onChange }) => (
  <div className="flex shrink-0 items-center rounded-md border border-border p-0.5" data-testid="view-toggle">
    {OPTIONS.map(({ k, icon: Icon, label }) => (
      <button
        key={k}
        onClick={() => onChange(k)}
        title={label}
        data-testid={`view-${k}`}
        className={`flex h-9 w-9 items-center justify-center rounded transition-colors ${mode === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}
      >
        <Icon className="h-4 w-4" />
      </button>
    ))}
  </div>
);
