import { useEffect, useState } from "react";
import api, { rupiah } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { AlertTriangle, Activity, PackageMinus, ClipboardList, UserPlus, Clock, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { user } = useAuth();
  const isKasir = user?.role === "Kasir";
  const [d, setD] = useState(null);
  const [tasks, setTasks] = useState(null);

  useEffect(() => {
    api.get("/dashboard").then((r) => setD(r.data));
    // Ringkasan Task To Do. Gagal memuat tidak boleh mengganggu dashboard.
    api.get("/tasks/summary").then((r) => setTasks(r.data)).catch(() => setTasks(null));
  }, []);

  if (!d) return <div className="text-muted-foreground">Memuat...</div>;

  const taskCards = [
    { key: "active", label: "Active", value: tasks?.active ?? 0, icon: ClipboardList, cls: "text-blue-600" },
    { key: "available", label: "Available", value: tasks?.available ?? 0, icon: UserPlus, cls: "text-slate-600" },
    { key: "mine", label: "My Tasks", value: tasks?.mine ?? 0, icon: Clock, cls: "text-amber-600" },
    { key: "completed", label: "Completed", value: tasks?.completed ?? 0, icon: CheckCircle2, cls: "text-emerald-600" },
    { key: "overdue", label: "Overdue", value: tasks?.overdue ?? 0, icon: AlertTriangle, cls: "text-red-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Ringkasan Bisnis</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Dashboard</h1>
      </div>

      {/* Highlight Task To Do — tampil untuk semua role, termasuk kasir. */}
      <section className="rounded-lg border border-border bg-card p-4" data-testid="dashboard-task-todo">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Produksi</p>
            <h2 className="font-display text-2xl font-bold tracking-tight">Task To Do</h2>
            <p className="mt-1 text-sm text-muted-foreground">Antrean pekerjaan dari pesanan pelanggan. Ambil tugas, kerjakan, lalu selesaikan.</p>
          </div>
          <Link
            to="/app/task-todo"
            className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            data-testid="dashboard-task-todo-link"
          >
            Buka Task To Do
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {taskCards.map((t) => (
            <Link
              key={t.key}
              to="/app/task-todo"
              className="rounded-lg border border-border bg-background p-3 transition-colors hover:border-primary/50"
              data-testid={`dashboard-task-${t.key}`}
            >
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <t.icon className={`h-3.5 w-3.5 ${t.cls}`} /> {t.label}
              </div>
              <div className="mt-1 font-display text-2xl font-bold">{t.value}</div>
            </Link>
          ))}
        </div>
      </section>

      {!isKasir && (d.minus_stock || []).length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-5" data-testid="minus-stock-card">
          <div className="flex items-center gap-2">
            <PackageMinus className="h-4 w-4 text-destructive" />
            <h3 className="font-display text-lg font-semibold text-destructive">Pengingat Stok Minus</h3>
            <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive" data-testid="minus-stock-count">{d.minus_stock.length}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Produk berikut stoknya minus — segera lakukan restock lewat menu Inventory / Pembelian.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(d.minus_stock || []).map((p) => (
              <div key={p.id} className="flex items-center gap-2 rounded-md border border-destructive/30 bg-card px-3 py-2 text-sm" data-testid={`minus-stock-${p.id}`}>
                <span className="font-medium">{p.name}</span>
                <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-bold text-destructive">{p.stock} {p.unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isKasir && (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
          <h3 className="font-display text-lg font-semibold">Penjualan 7 Hari Terakhir</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={d.sales_series}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--popover-foreground))" }}
                  formatter={(v) => rupiah(v)}
                />
                <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="font-display text-lg font-semibold">Produk Terlaris</h3>
          <div className="mt-4 h-64">
            {d.top_products.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada data penjualan.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.top_products} layout="vertical" margin={{ left: 10 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={90} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="qty" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
      )}

      <div className={`grid grid-cols-1 gap-4 ${isKasir ? "" : "lg:grid-cols-2"}`}>
        {!isKasir && (
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <h3 className="font-display text-lg font-semibold">Notifikasi Stok Menipis</h3>
          </div>
          <div className="mt-4 space-y-2">
            {d.low_stock.length === 0 ? (
              <p className="text-sm text-muted-foreground">Semua stok aman.</p>
            ) : (
              (d.low_stock || []).map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-md bg-secondary px-3 py-2 text-sm">
                  <span className="font-medium">{p.name}</span>
                  <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-xs font-semibold text-orange-600">
                    Sisa {p.stock} {p.unit}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
        )}

        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="font-display text-lg font-semibold">Aktivitas Terbaru</h3>
          </div>
          <div className="mt-4 space-y-3">
            {d.activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada aktivitas.</p>
            ) : (
              (d.activities || []).map((a) => (
                <div key={a.id} className="flex items-start gap-3 text-sm">
                  <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p className="font-medium">{a.action} <span className="font-normal text-muted-foreground">— {a.detail}</span></p>
                    <p className="text-xs text-muted-foreground">{a.user_name} · {new Date(a.created_at).toLocaleString("id-ID")}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
