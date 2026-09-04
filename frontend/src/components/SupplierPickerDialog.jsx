import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Truck } from "lucide-react";

// Reusable dialog to pick a supplier (required) before creating an auto PO.
export function SupplierPickerDialog({ open, onOpenChange, onConfirm, title = "Pilih Supplier", description }) {
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setSupplierId("");
      api.get("/suppliers").then((r) => setSuppliers(r.data)).catch(() => {});
    }
  }, [open]);

  const confirm = async () => {
    if (!supplierId) return toast.error("Supplier wajib dipilih");
    setBusy(true);
    try {
      await onConfirm(supplierId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="supplier-picker-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display"><Truck className="h-5 w-5 text-primary" /> {title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
          {suppliers.length === 0 ? (
            <p className="rounded-md bg-secondary/50 p-3 text-sm text-muted-foreground">Belum ada data supplier. Tambahkan supplier dulu di menu <b>Supplier</b> sebelum membuat PO.</p>
          ) : (
            <div className="space-y-1">
              <Label>Supplier <span className="text-destructive">*</span></Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger data-testid="supplier-picker-select"><SelectValue placeholder="Pilih supplier..." /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} data-testid="supplier-picker-cancel">Batal</Button>
          <Button onClick={confirm} disabled={busy || suppliers.length === 0 || !supplierId} data-testid="supplier-picker-confirm">{busy ? "Membuat..." : "Buat PO"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
