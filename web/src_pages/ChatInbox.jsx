/**
 * Chat Pelanggan (inbox admin) — /app/chat
 * ---------------------------------------------------------------------------
 * Dua panel: daftar percakapan di kiri, isi percakapan di kanan. Pesan baru
 * diambil dengan polling ringan (daftar 6 detik, percakapan aktif 3 detik),
 * plus bunyi "ting" dan notifikasi browser saat ada pesan masuk.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import {
  MessageCircle, Send, Search, Loader2, CheckCircle2, RotateCcw, Bell, BellOff,
  Volume2, VolumeX, Phone, Ticket, RefreshCw,
} from "lucide-react";
import {
  playChatBeep, isChatSoundOn, setChatSound, askBrowserNotify, browserNotifyState, notifyBrowser,
} from "@/lib/chatNotify";

const FILTERS = [
  { key: "open", label: "Aktif" },
  { key: "closed", label: "Ditutup" },
  { key: "all", label: "Semua" },
];

const timeLabel = (iso) => {
  try {
    const d = new Date(iso);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    return sameDay
      ? d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
  } catch {
    return "";
  }
};

const clockLabel = (iso) => {
  try {
    return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
};

const waLink = (contact) => {
  const digits = String(contact || "").replace(/[^0-9]/g, "");
  if (digits.length < 8) return "";
  const intl = digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
  return `https://wa.me/${intl}`;
};

export default function ChatInbox() {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("open");
  const [q, setQ] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [notifyState, setNotifyState] = useState("default");

  const listRef = useRef(null);
  const lastUnread = useRef(0);
  const firstLoad = useRef(true);

  useEffect(() => {
    setSoundOn(isChatSoundOn());
    setNotifyState(browserNotifyState());
  }, []);

  const loadThreads = useCallback(async () => {
    try {
      const { data } = await api.get("/chat/threads", { params: { status: filter, q: q.trim() || undefined } });
      const items = Array.isArray(data?.items) ? data.items : [];
      setThreads(items);

      // Bunyi + notifikasi hanya saat jumlah pesan belum dibaca bertambah.
      const totalUnread = items.reduce((s, t) => s + Number(t.unread_admin || 0), 0);
      if (!firstLoad.current && totalUnread > lastUnread.current) {
        const newest = items.find((t) => Number(t.unread_admin || 0) > 0);
        playChatBeep();
        notifyBrowser(
          `Pesan baru dari ${newest?.customer_name || "pelanggan"}`,
          newest?.last_message_preview || "Buka inbox chat untuk membalas",
        );
      }
      lastUnread.current = totalUnread;
      firstLoad.current = false;
    } catch (e) {
      if (loading) toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  }, [filter, q, loading]);

  const loadMessages = useCallback(async (id) => {
    if (!id) return;
    try {
      const { data } = await api.get(`/chat/threads/${id}`);
      setActive(data?.thread || null);
      setMessages(Array.isArray(data?.messages) ? data.messages : []);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  }, []);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  // Polling daftar percakapan.
  useEffect(() => {
    const id = window.setInterval(() => loadThreads(), 6000);
    return () => window.clearInterval(id);
  }, [loadThreads]);

  // Polling percakapan aktif.
  useEffect(() => {
    if (!activeId) return;
    loadMessages(activeId);
    const id = window.setInterval(() => loadMessages(activeId), 3000);
    return () => window.clearInterval(id);
  }, [activeId, loadMessages]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, activeId]);

  const totalUnread = useMemo(
    () => (threads || []).reduce((s, t) => s + Number(t.unread_admin || 0), 0),
    [threads],
  );

  const send = async () => {
    const body = draft.trim();
    if (!body || !activeId || sending) return;
    setSending(true);
    try {
      const { data } = await api.post(`/chat/threads/${activeId}/messages`, { body });
      setMessages((prev) => [...(prev || []), data.message]);
      setActive(data.thread);
      setDraft("");
      loadThreads();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setSending(false);
    }
  };

  const setStatus = async (status) => {
    if (!activeId) return;
    setStatusBusy(true);
    try {
      const { data } = await api.patch(`/chat/threads/${activeId}`, { status });
      setActive((prev) => ({ ...(prev || {}), ...data }));
      toast.success(status === "closed" ? "Percakapan ditutup" : "Percakapan dibuka lagi");
      loadThreads();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setStatusBusy(false);
    }
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSound(next);
  };

  const setSound = (next) => {
    setSoundOn(next);
    setChatSound(next);
    if (next) playChatBeep();
  };

  const enableNotify = async () => {
    const state = await askBrowserNotify();
    setNotifyState(state);
    if (state === "granted") {
      notifyBrowser("Notifikasi chat aktif", "Kamu akan diberi tahu saat ada pesan pelanggan baru.");
    } else if (state === "denied") {
      toast.error("Izin notifikasi ditolak browser. Aktifkan lewat ikon kunci di address bar.");
    }
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-4" data-testid="chat-inbox-page">
      {/* Kepala halaman */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight">
            <MessageCircle className="h-6 w-6" /> Chat Pelanggan
            {totalUnread > 0 && (
              <span data-testid="chat-total-unread" className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">
                {totalUnread} belum dibaca
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">Balas pertanyaan pelanggan dari website. Pesan baru masuk otomatis.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSound}
            data-testid="chat-sound-toggle"
            title={soundOn ? "Matikan bunyi notifikasi" : "Nyalakan bunyi notifikasi"}
            className="flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-secondary"
          >
            {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            {soundOn ? "Bunyi: On" : "Bunyi: Off"}
          </button>
          <button
            onClick={enableNotify}
            disabled={notifyState === "granted" || notifyState === "unsupported"}
            data-testid="chat-notify-button"
            className="flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-secondary disabled:opacity-60"
          >
            {notifyState === "granted" ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            {notifyState === "granted"
              ? "Notifikasi aktif"
              : notifyState === "unsupported"
                ? "Notifikasi tidak didukung"
                : "Aktifkan notifikasi"}
          </button>
          <button
            onClick={() => { loadThreads(); if (activeId) loadMessages(activeId); }}
            data-testid="chat-refresh-button"
            className="flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-secondary"
          >
            <RefreshCw className="h-4 w-4" /> Segarkan
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[320px_1fr]">
        {/* Daftar percakapan */}
        <div className="flex min-h-0 flex-col rounded-lg border border-border bg-card">
          <div className="space-y-2 border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari nama, kontak, kode tiket..."
                data-testid="chat-search-input"
                className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="flex gap-1 rounded-md bg-secondary p-1">
              {(FILTERS || []).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  data-testid={`chat-filter-${f.key}`}
                  className={`flex-1 rounded px-2 py-1.5 text-xs font-semibold transition ${
                    filter === f.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto" data-testid="chat-thread-list">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Memuat...
              </div>
            ) : threads.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground" data-testid="chat-thread-empty">
                Belum ada percakapan di filter ini.
              </p>
            ) : (
              (threads || []).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveId(t.id)}
                  data-testid={`chat-thread-${t.ticket_code}`}
                  className={`flex w-full flex-col gap-1 border-b border-border px-3 py-2.5 text-left transition hover:bg-secondary ${
                    activeId === t.id ? "bg-secondary" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">{t.customer_name}</span>
                    {Number(t.unread_admin || 0) > 0 && (
                      <span className="ml-auto shrink-0 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {t.unread_admin}
                      </span>
                    )}
                    <span className={`shrink-0 text-[10px] font-semibold ${Number(t.unread_admin || 0) > 0 ? "" : "ml-auto"} text-muted-foreground`}>
                      {timeLabel(t.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">{t.ticket_code}</span>
                    {t.status === "closed" && (
                      <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600">Ditutup</span>
                    )}
                  </div>
                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    {t.last_sender === "admin" ? "Kamu: " : ""}{t.last_message_preview}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Isi percakapan */}
        <div className="flex min-h-0 flex-col rounded-lg border border-border bg-card">
          {!activeId ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground" data-testid="chat-no-selection">
              <MessageCircle className="h-10 w-10 opacity-30" />
              Pilih satu percakapan di kiri untuk membalas.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{active?.customer_name || "—"}</div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Ticket className="h-3 w-3" /> {active?.ticket_code}</span>
                    {active?.customer_contact && (
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {active.customer_contact}</span>
                    )}
                  </div>
                </div>
                {waLink(active?.customer_contact) && (
                  <a
                    href={waLink(active?.customer_contact)}
                    target="_blank"
                    rel="noreferrer"
                    data-testid="chat-wa-link"
                    className="flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-secondary"
                  >
                    <Phone className="h-4 w-4" /> WhatsApp
                  </a>
                )}
                <button
                  onClick={() => setStatus(active?.status === "closed" ? "open" : "closed")}
                  disabled={statusBusy}
                  data-testid="chat-status-toggle"
                  className="flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-secondary disabled:opacity-60"
                >
                  {active?.status === "closed" ? <RotateCcw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  {active?.status === "closed" ? "Buka lagi" : "Tandai selesai"}
                </button>
              </div>

              <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-background/40 p-3" data-testid="chat-conversation">
                {(messages || []).map((m) => (
                  <div key={m.id} className={`flex ${m.sender === "admin" ? "justify-end" : "justify-start"}`}>
                    <div
                      data-testid={`chat-bubble-${m.sender}`}
                      className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm ${
                        m.sender === "admin"
                          ? "rounded-br-md bg-primary text-primary-foreground"
                          : "rounded-bl-md border border-border bg-card"
                      }`}
                    >
                      <div className={`mb-0.5 text-[10px] font-bold uppercase tracking-wide ${m.sender === "admin" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {m.sender === "admin" ? m.sender_name || "Admin" : m.sender_name || "Pelanggan"}
                      </div>
                      <div className="whitespace-pre-wrap break-words">{m.body}</div>
                      <div className={`mt-1 text-right text-[10px] ${m.sender === "admin" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                        {clockLabel(m.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-end gap-2 border-t border-border p-3">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  rows={2}
                  placeholder="Tulis balasan... (Enter kirim, Shift+Enter baris baru)"
                  data-testid="chat-reply-input"
                  className="max-h-32 flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <button
                  onClick={send}
                  disabled={sending || !draft.trim()}
                  data-testid="chat-reply-send"
                  className="flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Kirim
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
