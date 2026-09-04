import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

// Searchable product picker (type to filter by name or SKU). Drop-in replacement
// for the plain product <Select> dropdowns.
export function ProductCombobox({ products = [], value, onChange, placeholder = "Pilih produk", testId, renderLabel }) {
  const [open, setOpen] = useState(false);
  const selected = products.find((p) => p.id === value);
  const label = selected ? (renderLabel ? renderLabel(selected) : selected.name) : "";

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setTimeout(() => { document.body.style.pointerEvents = ""; }, 100); }}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal" data-testid={testId}>
          <span className={cn("truncate", !selected && "text-muted-foreground")}>{selected ? label : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Ketik nama / SKU produk..." data-testid={testId ? `${testId}-search` : undefined} />
          <CommandList>
            <CommandEmpty>Produk tidak ditemukan.</CommandEmpty>
            <CommandGroup>
              {products.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.name} ${p.sku || ""} ${p.id}`}
                  onSelect={() => { onChange(p.id); setOpen(false); }}
                  data-testid={testId ? `${testId}-option-${p.id}` : undefined}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === p.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{renderLabel ? renderLabel(p) : p.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
