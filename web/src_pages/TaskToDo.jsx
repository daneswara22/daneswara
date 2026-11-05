import { useEffect, useMemo, useState } from 'react';
import api, { rupiah, formatApiError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  ClipboardList, Search, ChevronLeft, ChevronRight, ArrowUpDown, AlertTriangle,
  Clock, CheckCircle2, UserPlus, UserMinus, RefreshCw, Loader2, Plus, Trash2,
} from 'lucide-react';

const TABS = [
  { key: 'all', label: 'All Tasks' },
  { key: 'available', label: 'Available Tasks' },
  { key: 'mine', label: 'My Tasks' },
  { key: 'completed', label: 'Completed' },
];

const STATUSES = ['AVAILABLE', 'CLAIMED', 'IN PROGRESS', 'COMPLETED', 'ON HOLD'];
const PRIORITIES = ['Normal', 'High', 'Urgent'];

const STATUS_STYLE = {
  AVAILABLE: 'bg-slate-500/15 text-slate-600',
  CLAIMED: 'bg-blue-500/15 text-blue-600',
  'IN PROGRESS': 'bg-amber-500/15 text-amber-600',
  COMPLETED: 'bg-emerald-500/15 text-emerald-600',
  'ON HOLD': 'bg-orange-500/15 text-orange-600',
};

const PRIORITY_STYLE = {
  Normal: 'bg-slate-500/15 text-slate-600',
  High: 'bg-orange-500/15 text-orange-600',
  Urgent: 'bg-red-500/15 text-red-600',
};

const fmtDate = (d) => (d ? new Date(d).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const fmtDay = (d) => (d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');

function DeadlineCell({ task }) {
  if (!task.deadline) return <span className="text-muted-foreground">—</span>;
  const state = task.deadline_state;
  if (state === 'overdue') {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-red-600" data-testid={`deadline-overdue-${task.id}`}>
        <AlertTriangle className="h-3.5 w-3.5" /> {fmtDay(task.deadline)}
      </span>
    );
  }
  if (state === 'soon') {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-amber-600" data-testid={`deadline-soon-${task.id}`}>
        <Clock className="h-3.5 w-3.5" /> {fmtDay(task.deadline)}
      </span>
    );
  }
  return <span>{fmtDay(task.deadline)}</span>;
}

export default function TaskToDo() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Owner' || user?.role === 'Manager';

  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('all');
  const [pic, setPic] = useState('all');
  const [deadline, setDeadline] = useState('all');
  const [sort, setSort] = useState('created_at');
  const [dir, setDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const [data, setData] = useState({ items: [], total: 0, pages: 1 });
  const [summary, setSummary] = useState({ active: 0, available: 0, mine: 0, completed: 0, overdue: 0 });
  const [pics, setPics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [releaseFor, setReleaseFor] = useState(null);
  const [releaseReason, setReleaseReason] = useState('');
  const [assignFor, setAssignFor] = useState(null);
  const [assignTo, setAssignTo] = useState('');
  const [deadlineDraft, setDeadlineDraft] = useState('');
  const [projectDraft, setProjectDraft] = useState('');
  const [descDraft, setDescDraft] = useState('');
  const [itemDraft, setItemDraft] = useState([]);

  // Form task manual
  const [createOpen, setCreateOpen] = useState(false);
  const [newProject, setNewProject] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState('Normal');
  const [newDeadline, setNewDeadline] = useState('');
  const [newItems, setNewItems] = useState([{ name: '', qty: 1, price: 0, note: '' }]);

  const load = async () => {
    setLoading(true);
    try {
      const params = { tab, q, status, priority, pic, deadline, sort, dir, page, per_page: perPage };
      const [list, sum] = await Promise.all([
        api.get('/tasks', { params }),
        api.get('/tasks/summary'),
      ]);
      setData(list.data || { items: [], total: 0, pages: 1 });
      setSummary(sum.data || {});
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab, status, priority, pic, deadline, sort, dir, page, perPage]);
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(); }, 350);
    return () => clearTimeout(t);
    /* eslint-disable-next-line */
  }, [q]);
  useEffect(() => {
    api.get('/tasks/pics').then((r) => setPics(r.data || [])).catch(() => {});
  }, []);

  const picName = useMemo(() => {
    const m = {};
    for (const p of pics) m[p.id] = p.name || p.username;
    return m;
  }, [pics]);

  const act = async (task, action, extra = {}) => {
    setBusy(true);
    try {
      await api.patch(`/tasks/${task.id}`, { action, ...extra });
      toast.success('Task diperbarui');
      await load();
      if (detail?.id === task.id) await openDetail(task.id);
      return true;
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const openDetail = async (id) => {
    setDetailLoading(true);
    try {
      const { data: d } = await api.get(`/tasks/${id}`);
      setDetail(d);
      // Isi draft editor dari nilai tersimpan (format YYYY-MM-DD untuk input date).
      setDeadlineDraft(d.deadline ? new Date(d.deadline).toISOString().slice(0, 10) : '');
      setProjectDraft(d.project_name || '');
      setDescDraft(d.description || '');
      setItemDraft((d.items || []).map((i) => ({ name: i.name || '', qty: i.qty || 0, price: i.price || 0, note: i.note || '' })));
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setDetailLoading(false);
    }
  };

  const toggleSort = (key) => {
    if (sort === key) setDir(dir === 'asc' ? 'desc' : 'asc');
    else { setSort(key); setDir('asc'); }
  };

  const SortHead = ({ label, k }) => (
    <th className="px-3 py-2 text-left">
      <button type="button" onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 font-semibold hover:text-foreground" data-testid={`sort-${k}`}>
        {label} <ArrowUpDown className={`h-3 w-3 ${sort === k ? 'text-primary' : 'opacity-40'}`} />
      </button>
    </th>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Produksi</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Task To Do</h1>
          <p className="mt-1 text-sm text-muted-foreground">Antrean pekerjaan dari pesanan pelanggan. Ambil tugas, kerjakan, lalu selesaikan.</p>
        </div>
        <Button className="gap-1" onClick={() => { setCreateOpen(true); setNewProject(''); setNewDesc(''); setNewPriority('Normal'); setNewDeadline(''); setNewItems([{ name: '', qty: 1, price: 0, note: '' }]); }} data-testid="task-create-button">
          <Plus className="h-4 w-4" /> Tambah Task
        </Button>
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" data-testid="task-summary">
        {[
          { label: 'Active', value: summary.active, icon: ClipboardList, cls: 'text-blue-600' },
          { label: 'Available', value: summary.available, icon: UserPlus, cls: 'text-slate-600' },
          { label: 'My Tasks', value: summary.mine, icon: Clock, cls: 'text-amber-600' },
          { label: 'Completed', value: summary.completed, icon: CheckCircle2, cls: 'text-emerald-600' },
          { label: 'Overdue', value: summary.overdue, icon: AlertTriangle, cls: 'text-red-600' },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-3" data-testid={`summary-${s.label.toLowerCase().replace(/\s+/g, '-')}`}>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <s.icon className={`h-3.5 w-3.5 ${s.cls}`} /> {s.label}
            </div>
            <div className="mt-1 font-display text-2xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tab */}
      <div className="flex flex-wrap gap-1 border-b border-border" data-testid="task-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setPage(1); }}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors duration-200 ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            data-testid={`task-tab-${t.key}`}
          >
            {t.label}
          </button>
        ))}
        <Button variant="ghost" size="sm" className="ml-auto gap-1" onClick={load} disabled={loading} data-testid="task-refresh">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Muat ulang
        </Button>
      </div>

      {/* Filter */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6" data-testid="task-filters">
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari task, proyek, order, pelanggan..." className="pl-10" data-testid="task-search" />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger data-testid="task-filter-status"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={(v) => { setPriority(v); setPage(1); }}>
          <SelectTrigger data-testid="task-filter-priority"><SelectValue placeholder="Prioritas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua prioritas</SelectItem>
            {PRIORITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={pic} onValueChange={(v) => { setPic(v); setPage(1); }}>
          <SelectTrigger data-testid="task-filter-pic"><SelectValue placeholder="PIC" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua PIC</SelectItem>
            <SelectItem value="me">Saya</SelectItem>
            <SelectItem value="unassigned">Belum ada PIC</SelectItem>
            {pics.map((p) => <SelectItem key={p.id} value={p.id}>{p.name || p.username}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={deadline} onValueChange={(v) => { setDeadline(v); setPage(1); }}>
          <SelectTrigger data-testid="task-filter-deadline"><SelectValue placeholder="Deadline" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua deadline</SelectItem>
            <SelectItem value="overdue">Terlambat</SelectItem>
            <SelectItem value="soon">Mendekat (≤2 hari)</SelectItem>
            <SelectItem value="none">Tanpa deadline</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabel */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[1100px] text-sm" data-testid="task-table">
          <thead className="bg-secondary text-xs uppercase text-muted-foreground">
            <tr>
              <SortHead label="Task ID" k="task_number" />
              <th className="px-3 py-2 text-left">Order Date</th>
              <th className="px-3 py-2 text-left">Project Name</th>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <SortHead label="Deadline" k="deadline" />
              <SortHead label="Priority" k="priority" />
              <th className="px-3 py-2 text-left">PIC</th>
              <SortHead label="Status" k="status" />
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={11} className="px-3 py-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
            )}
            {!loading && data.items.length === 0 && (
              <tr><td colSpan={11} className="px-3 py-10 text-center text-muted-foreground" data-testid="task-empty">Belum ada task di filter ini.</td></tr>
            )}
            {!loading && data.items.map((t) => (
              <tr key={t.id} className="border-t border-border align-top" data-testid={`task-row-${t.id}`}>
                <td className="px-3 py-2 font-mono text-xs font-semibold">{t.task_number}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDate(t.order?.order_date)}</td>
                <td className="px-3 py-2">
                  <button type="button" onClick={() => openDetail(t.id)} className="text-left font-medium hover:text-primary hover:underline" data-testid={`task-open-${t.id}`}>
                    {t.project_name || t.order?.order_number || '—'}
                  </button>
                  <div className="text-[11px] text-muted-foreground">{t.order?.order_number}</div>
                </td>
                <td className="px-3 py-2">{t.order?.customer_name || '—'}</td>
                <td className="px-3 py-2 text-xs">
                  {t.product_summary || '—'}
                  {t.product_extra > 0 && <span className="text-muted-foreground"> +{t.product_extra}</span>}
                </td>
                <td className="px-3 py-2 text-right font-semibold">{t.quantity}</td>
                <td className="px-3 py-2 text-xs"><DeadlineCell task={t} /></td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${PRIORITY_STYLE[t.priority] || ''}`}>{t.priority}</span>
                </td>
                <td className="px-3 py-2 text-xs">{t.assigned_user_id ? (picName[t.assigned_user_id] || '—') : <span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLE[t.status] || ''}`} data-testid={`task-status-${t.id}`}>{t.status}</span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap justify-end gap-1">
                    {t.status === 'AVAILABLE' && (
                      <Button size="sm" className="h-7 gap-1 px-2 text-xs" disabled={busy} onClick={() => act(t, 'claim')} data-testid={`task-claim-${t.id}`}>
                        <UserPlus className="h-3.5 w-3.5" /> Ambil
                      </Button>
                    )}
                    {t.assigned_user_id === user?.id && t.status !== 'COMPLETED' && (
                      <>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={busy} onClick={() => act(t, 'status', { status: 'IN PROGRESS' })} data-testid={`task-progress-${t.id}`}>Kerjakan</Button>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={busy} onClick={() => act(t, 'status', { status: 'COMPLETED' })} data-testid={`task-complete-${t.id}`}>Selesai</Button>
                        <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs text-destructive" disabled={busy} onClick={() => { setReleaseFor(t); setReleaseReason(''); }} data-testid={`task-release-${t.id}`}>
                          <UserMinus className="h-3.5 w-3.5" /> Lepas
                        </Button>
                      </>
                    )}
                    {isAdmin && (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={busy} onClick={() => { setAssignFor(t); setAssignTo(t.assigned_user_id || ''); }} data-testid={`task-assign-${t.id}`}>PIC</Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={busy} onClick={() => openDetail(t.id)} data-testid={`task-deadline-${t.id}`}>Deadline</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm" data-testid="task-pagination">
        <div className="text-muted-foreground">
          {data.total} task · halaman {data.page} dari {data.pages}
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); setPage(1); }}>
            <SelectTrigger className="h-8 w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[10, 20, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n} / halaman</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)} data-testid="task-prev"><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" disabled={page >= data.pages || loading} onClick={() => setPage(page + 1)} data-testid="task-next"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Detail */}
      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" data-testid="task-detail-dialog">
          <DialogHeader><DialogTitle className="font-display">Detail Task {detail?.task_number}</DialogTitle></DialogHeader>
          {detailLoading && <p className="text-sm text-muted-foreground">Memuat…</p>}
          {detail && !detailLoading && (
            <div className="space-y-4 text-sm">
              <section>
                <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Project</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Project Name</span>
                    <div className="mt-1 flex gap-1">
                      <Input
                        value={projectDraft}
                        onChange={(e) => setProjectDraft(e.target.value)}
                        placeholder="Nama proyek"
                        className="h-8 text-xs"
                        data-testid="task-detail-project-input"
                      />
                      <Button
                        size="sm"
                        className="h-8 px-2 text-xs"
                        disabled={busy || projectDraft === (detail.project_name || '')}
                        onClick={() => act(detail, 'project', { project_name: projectDraft })}
                        data-testid="task-detail-project-save"
                      >Simpan</Button>
                    </div>
                  </div>
                  <div><span className="text-muted-foreground">Order ID</span><p className="font-mono text-xs">{detail.order?.order_number || '—'}</p></div>
                  <div><span className="text-muted-foreground">Order Date</span><p>{fmtDate(detail.order?.order_date)}</p></div>
                  <div>
                    <span className="text-muted-foreground">Deadline</span>
                    <div className="mt-1 flex gap-1">
                      <Input
                        type="date"
                        value={deadlineDraft}
                        onChange={(e) => setDeadlineDraft(e.target.value)}
                        className="h-8 text-xs"
                        data-testid="task-detail-deadline-input"
                      />
                      <Button
                        size="sm"
                        className="h-8 px-2 text-xs"
                        disabled={busy}
                        onClick={() => act(detail, 'deadline', { deadline: deadlineDraft || null })}
                        data-testid="task-detail-deadline-save"
                      >Set</Button>
                    </div>
                    <p className="mt-1"><DeadlineCell task={detail} /></p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Priority</span>
                    <Select
                      value={detail.priority}
                      onValueChange={(v) => act(detail, 'priority', { priority: v })}
                    >
                      <SelectTrigger className="mt-1 h-8 text-xs" data-testid="task-detail-priority-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><span className="text-muted-foreground">PIC</span><p>{detail.assigned_user_id ? (picName[detail.assigned_user_id] || '—') : '—'}</p></div>
                  <div>
                    <span className="text-muted-foreground">Status</span>
                    <Select
                      value={detail.status}
                      onValueChange={(v) => act(detail, 'status', { status: v })}
                    >
                      <SelectTrigger className="mt-1 h-8 text-xs" data-testid="task-detail-status-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Customer</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Nama</span><p className="font-medium">{detail.customer?.name || '—'}</p></div>
                  <div><span className="text-muted-foreground">WhatsApp</span><p>{detail.customer?.phone || '—'}</p></div>
                  <div className="col-span-2"><span className="text-muted-foreground">Alamat</span><p>{detail.customer?.address || '—'}</p></div>
                </div>
              </section>

              <section>
                <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Keterangan</h3>
                <textarea
                  value={descDraft}
                  onChange={(e) => setDescDraft(e.target.value)}
                  rows={4}
                  placeholder="Catatan tambahan untuk task ini (tidak tampil di tabel). Tekan Enter untuk baris baru."
                  className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-xs leading-relaxed"
                  data-testid="task-detail-description"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">Tekan <kbd className="rounded border px-1">Enter</kbd> untuk pindah ke baris baru.</p>
                <div className="mt-1 flex justify-end">
                  <Button
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={busy || descDraft === (detail.description || '')}
                    onClick={() => act(detail, 'description', { description: descDraft })}
                    data-testid="task-detail-description-save"
                  >Simpan Keterangan</Button>
                </div>
              </section>

              <section>
                <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Produk</h3>
                <div className="overflow-x-auto rounded border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary text-muted-foreground">
                      <tr>
                        <th className="px-2 py-1 text-left">Produk</th>
                        <th className="px-2 py-1 text-left">Warna</th>
                        <th className="px-2 py-1 text-left">Ukuran</th>
                        <th className="px-2 py-1 text-right">Qty</th>
                        <th className="px-2 py-1 text-right">Harga (Rp)</th>
                        <th className="px-2 py-1 text-left">Catatan</th>
                        {detail.is_manual && <th className="px-2 py-1"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {detail.is_manual
                        ? itemDraft.map((i, idx) => (
                            <tr key={idx} className="border-t border-border">
                              <td className="px-2 py-1">
                                <Input value={i.name} onChange={(e) => setItemDraft(itemDraft.map((x, k) => k === idx ? { ...x, name: e.target.value } : x))} placeholder="Nama produk" className="h-7 text-xs" data-testid={`task-item-name-${idx}`} />
                              </td>
                              <td className="px-2 py-1 text-muted-foreground">—</td>
                              <td className="px-2 py-1 text-muted-foreground">—</td>
                              <td className="px-2 py-1">
                                <div className="flex items-center justify-end gap-1">
                                  <Input value={i.qty} inputMode="numeric" onChange={(e) => setItemDraft(itemDraft.map((x, k) => k === idx ? { ...x, qty: e.target.value.replace(/[^0-9]/g, '') } : x))} className="h-7 w-14 text-right text-xs" data-testid={`task-item-qty-${idx}`} />
                                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setItemDraft([...itemDraft, { name: '', qty: 1, price: 0, note: '' }])} title="Tambah baris" data-testid={`task-item-add-${idx}`}>
                                    <Plus className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </td>
                              <td className="px-2 py-1">
                                <Input value={i.price} inputMode="numeric" onChange={(e) => setItemDraft(itemDraft.map((x, k) => k === idx ? { ...x, price: e.target.value.replace(/[^0-9]/g, '') } : x))} className="h-7 w-24 text-right text-xs" data-testid={`task-item-price-${idx}`} />
                              </td>
                              <td className="px-2 py-1">
                                <Input value={i.note} onChange={(e) => setItemDraft(itemDraft.map((x, k) => k === idx ? { ...x, note: e.target.value } : x))} placeholder="Catatan" className="h-7 text-xs" data-testid={`task-item-note-${idx}`} />
                              </td>
                              <td className="px-2 py-1">
                                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setItemDraft(itemDraft.filter((_, k) => k !== idx))} disabled={itemDraft.length <= 1} data-testid={`task-item-remove-${idx}`}>
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </td>
                            </tr>
                          ))
                        : (detail.items || []).map((i, idx) => (
                            <tr key={idx} className="border-t border-border">
                              <td className="px-2 py-1">{i.name}{i.note ? <div className="text-muted-foreground">{i.note}</div> : null}</td>
                              <td className="px-2 py-1">{i.color || '—'}</td>
                              <td className="px-2 py-1">{i.size || '—'}</td>
                              <td className="px-2 py-1 text-right font-semibold">{i.qty}</td>
                              <td className="px-2 py-1 text-right">{rupiah(i.price)}</td>
                              <td className="px-2 py-1 text-muted-foreground">—</td>
                            </tr>
                          ))}
                      {!detail.is_manual && (detail.items || []).length === 0 && <tr><td colSpan={6} className="px-2 py-3 text-center text-muted-foreground">Tidak ada item.</td></tr>}
                    </tbody>
                  </table>
                </div>
                {detail.is_manual && (
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Total: <span className="font-semibold text-foreground">{rupiah(itemDraft.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.price) || 0), 0))}</span>
                    </span>
                    <Button
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={busy}
                      onClick={() => act(detail, 'items', { items: itemDraft })}
                      data-testid="task-detail-items-save"
                    >Simpan Produk</Button>
                  </div>
                )}
              </section>

              <section>
                <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Pembayaran</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Total</span><p className="font-semibold">{rupiah(detail.order?.total)}</p></div>
                  <div><span className="text-muted-foreground">Deposit</span><p>{rupiah(detail.order?.deposit_amount)}</p></div>
                  <div><span className="text-muted-foreground">Sisa</span><p className={detail.order?.remaining > 0 ? 'font-semibold text-orange-600' : ''}>{rupiah(detail.order?.remaining)}</p></div>
                  <div><span className="text-muted-foreground">Status</span><p>{detail.order?.payment_status || '—'}</p></div>
                </div>
              </section>

              <section>
                <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Pengiriman</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Metode</span><p>{detail.order?.shipping_carrier || '—'}</p></div>
                  <div><span className="text-muted-foreground">Resi</span><p>{detail.order?.tracking_number || '—'}</p></div>
                  <div className="col-span-2"><span className="text-muted-foreground">Alamat</span><p>{detail.order?.shipping_address || '—'}</p></div>
                </div>
              </section>

              <section>
                <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Aktivitas</h3>
                <ul className="space-y-1 text-xs">
                  {(detail.activities || []).map((a) => (
                    <li key={a.id} className="flex justify-between gap-2 border-b border-border/60 pb-1">
                      <span><span className="font-semibold">{a.action}</span>{a.detail ? ` — ${a.detail}` : ''}</span>
                      <span className="shrink-0 text-muted-foreground">{a.user_name || '—'} · {fmtDate(a.created_at)}</span>
                    </li>
                  ))}
                  {(detail.activities || []).length === 0 && <li className="text-muted-foreground">Belum ada aktivitas.</li>}
                </ul>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Tambah Task manual */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) setCreateOpen(false); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" data-testid="task-create-dialog">
          <DialogHeader><DialogTitle className="font-display">Tambah Task Manual</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2 space-y-1">
                <Label>Nama Proyek *</Label>
                <Input value={newProject} onChange={(e) => setNewProject(e.target.value)} placeholder="cth: Kaos Gathering PT ABC" data-testid="task-create-project" />
              </div>
              <div className="space-y-1">
                <Label>Prioritas</Label>
                <Select value={newPriority} onValueChange={setNewPriority}>
                  <SelectTrigger data-testid="task-create-priority"><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Deadline</Label>
                <Input type="date" value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)} data-testid="task-create-deadline" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Keterangan</Label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter menambah baris baru (default textarea), Esc menutup form.
                    if (e.key === 'Escape') { e.preventDefault(); setCreateOpen(false); }
                  }}
                  rows={3}
                  placeholder="Catatan tambahan (opsional). Tekan Enter untuk baris baru."
                  className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-xs leading-relaxed"
                  data-testid="task-create-description"
                />
                <p className="text-[11px] text-muted-foreground">Tekan <kbd className="rounded border px-1">Enter</kbd> untuk pindah ke baris baru.</p>
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <Label>Produk *</Label>
                <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => setNewItems([...newItems, { name: '', qty: 1, price: 0, note: '' }])} data-testid="task-create-add-item">
                  <Plus className="h-3.5 w-3.5" /> Tambah Baris
                </Button>
              </div>
              {/* Label kolom: supaya jelas angka mana qty dan mana harga. */}
              <div className="grid grid-cols-[1fr_60px_100px_1fr_32px] items-center gap-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" data-testid="task-create-item-headers">
                <span>Nama Produk</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Harga (Rp)</span>
                <span>Catatan</span>
                <span></span>
              </div>
              <div className="space-y-1">
                {newItems.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_60px_100px_1fr_32px] items-center gap-1">
                    <Input value={it.name} onChange={(e) => setNewItems(newItems.map((x, k) => k === idx ? { ...x, name: e.target.value } : x))} placeholder="Nama produk" className="h-8 text-xs" data-testid={`task-create-item-name-${idx}`} />
                    <Input value={it.qty} inputMode="numeric" onChange={(e) => setNewItems(newItems.map((x, k) => k === idx ? { ...x, qty: e.target.value.replace(/[^0-9]/g, '') } : x))} placeholder="0" className="h-8 text-right text-xs" data-testid={`task-create-item-qty-${idx}`} />
                    <Input value={it.price} inputMode="numeric" onChange={(e) => setNewItems(newItems.map((x, k) => k === idx ? { ...x, price: e.target.value.replace(/[^0-9]/g, '') } : x))} placeholder="0" className="h-8 text-right text-xs" data-testid={`task-create-item-price-${idx}`} />
                    <Input value={it.note} onChange={(e) => setNewItems(newItems.map((x, k) => k === idx ? { ...x, note: e.target.value } : x))} placeholder="Catatan" className="h-8 text-xs" data-testid={`task-create-item-note-${idx}`} />
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => setNewItems(newItems.filter((_, k) => k !== idx))} disabled={newItems.length <= 1} data-testid={`task-create-item-remove-${idx}`}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="mt-1 text-right text-xs text-muted-foreground">
                Total: <span className="font-semibold text-foreground">{rupiah(newItems.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.price) || 0), 0))}</span>
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Batal</Button>
              <Button
                disabled={busy || !newProject.trim() || newItems.every((i) => !i.name.trim())}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api.post('/tasks', {
                      project_name: newProject.trim(),
                      description: newDesc.trim() || null,
                      priority: newPriority,
                      deadline: newDeadline || null,
                      items: newItems.filter((i) => i.name.trim()),
                    });
                    toast.success('Task manual dibuat');
                    setCreateOpen(false);
                    await load();
                  } catch (e) {
                    toast.error(formatApiError(e.response?.data?.detail));
                  } finally {
                    setBusy(false);
                  }
                }}
                data-testid="task-create-submit"
              >Simpan Task</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Release */}
      <Dialog open={!!releaseFor} onOpenChange={(o) => { if (!o) setReleaseFor(null); }}>
        <DialogContent data-testid="task-release-dialog">
          <DialogHeader><DialogTitle className="font-display">Lepas Task {releaseFor?.task_number}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Task akan kembali ke Available Tasks dan bisa diambil user lain.</p>
            <div className="space-y-1">
              <Label>Alasan</Label>
              <Input value={releaseReason} onChange={(e) => setReleaseReason(e.target.value)} placeholder="cth: shift selesai" data-testid="task-release-reason" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReleaseFor(null)}>Batal</Button>
              <Button
                disabled={busy || !releaseReason.trim()}
                onClick={async () => {
                  const ok = await act(releaseFor, 'release', { reason: releaseReason.trim() });
                  if (ok) setReleaseFor(null);
                }}
                data-testid="task-release-confirm"
              >Lepas</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign PIC */}
      <Dialog open={!!assignFor} onOpenChange={(o) => { if (!o) setAssignFor(null); }}>
        <DialogContent data-testid="task-assign-dialog">
          <DialogHeader><DialogTitle className="font-display">Alihkan PIC {assignFor?.task_number}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>PIC</Label>
              <Select value={assignTo || 'none'} onValueChange={(v) => setAssignTo(v === 'none' ? '' : v)}>
                <SelectTrigger data-testid="task-assign-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— kosongkan —</SelectItem>
                  {pics.map((p) => <SelectItem key={p.id} value={p.id}>{p.name || p.username}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAssignFor(null)}>Batal</Button>
              <Button
                disabled={busy}
                onClick={async () => {
                  const ok = await act(assignFor, 'assign', { user_id: assignTo || null });
                  if (ok) setAssignFor(null);
                }}
                data-testid="task-assign-confirm"
              >Simpan</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
