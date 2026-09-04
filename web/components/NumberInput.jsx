import { forwardRef } from "react";
import { Input } from "@/components/ui/input";

const fmt = (v) => {
  if (v === "" || v === null || v === undefined) return "";
  const digits = String(v).replace(/\D/g, "");
  if (digits === "") return "";
  return Number(digits).toLocaleString("id-ID");
};

// Numeric input with Indonesian thousand separators (e.g. 1000000 -> 1.000.000).
// Emits the raw numeric value (or "" when empty) via onValueChange.
export const NumberInput = forwardRef(function NumberInput(
  { value, onValueChange, ...props },
  ref
) {
  const handle = (e) => {
    const raw = e.target.value.replace(/\D/g, "");
    onValueChange(raw === "" ? "" : Number(raw));
  };
  return (
    <Input
      ref={ref}
      inputMode="numeric"
      value={fmt(value)}
      onChange={handle}
      {...props}
    />
  );
});
