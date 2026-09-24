'use client';
/**
 * Bubble chat pelanggan (muncul di semua halaman publik).
 * ---------------------------------------------------------------------------
 * Pelanggan tidak perlu login. Sekali mengisi nama + kontak, sistem memberi
 * KODE TIKET (mis. DNS-7KQ4M2) yang bisa dipakai melanjutkan percakapan dari
 * perangkat lain. Kode terakhir juga diingat di localStorage perangkat ini.
 *
 * Pesan baru diambil dengan polling ringan: 3 detik saat panel terbuka,
 * 25 detik saat tertutup (cuma untuk titik "ada balasan baru").
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MessageCircle, X, Send, Copy, Check, Loader2, Ticket, ArrowLeft, Smile, RefreshCw,
} from 'lucide-react';

const STORE_KEY = 'dnsw_chat_ticket';
const EMOJIS = ['\u{1F604}', '\u{1F44D}', '\u{1F64F}', '\u2764\uFE0F', '\u{1F525}', '\u{1F440}', '\u{1F389}', '\u{1F914}'];

const jsonFetch = async (url, opts = {}) => {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail || 'Gagal menghubungi server');
  return data;
};

const timeLabel = (iso) => {
  try {
    return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

const dayLabel = (iso) => {
  try {
    return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
};

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [mode, setMode] = useState('start'); // start | resume | chat
  const [form, setForm] = useState({ name: '', contact: '', message: '' });
  const [resumeCode, setResumeCode] = useState('');
  const [messages, setMessages] = useState([]);
  const [thread, setThread] = useState(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unread, setUnread] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);

  const listRef = useRef(null);
  const seenCount = useRef(0);

  // Ingat kode tiket di perangkat ini.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem(STORE_KEY);
    if (saved) { setCode(saved); setMode('chat'); }
  }, []);

  const persistCode = (value) => {
    setCode(value);
    if (typeof window !== 'undefined') {
      if (value) window.localStorage.setItem(STORE_KEY, value);
      else window.localStorage.removeItem(STORE_KEY);
    }
  };

  const pull = useCallback(async (silent = true) => {
    if (!code) return;
    try {
      const data = await jsonFetch(`/api/public/chat/threads/${encodeURIComponent(code)}`);
      setThread(data.thread);
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setError('');
    } catch (e) {
      if (!silent) setError(e.message);
      // kode tidak ditemukan (mis. data dihapus) -> mulai ulang
      if (/tidak ditemukan/i.test(e.message)) { persistCode(''); setMode('start'); }
    }
  }, [code]);

  // Polling: cepat saat panel terbuka, lambat saat tertutup.
  useEffect(() => {
    if (!code) return;
    pull();
    const every = open ? 3000 : 25000;
    const id = window.setInterval(() => pull(), every);
    return () => window.clearInterval(id);
  }, [code, open, pull]);

  // Hitung balasan admin yang belum dilihat saat panel tertutup.
  useEffect(() => {
    const adminCount = (messages || []).filter((m) => m.sender === 'admin').length;
    if (open) {
      seenCount.current = adminCount;
      setUnread(0);
    } else {
      setUnread(Math.max(0, adminCount - seenCount.current));
    }
  }, [messages, open]);

  // Selalu gulir ke pesan terbaru.
  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open, mode]);

  const startChat = async () => {
    setError('');
    if (form.name.trim().length < 2) return setError('Nama minimal 2 karakter');
    if (form.contact.trim().length < 5) return setError('Isi nomor WhatsApp atau email yang bisa dihubungi');
    if (!form.message.trim()) return setError('Tulis dulu pesannya ya');
    setBusy(true);
    try {
      const data = await jsonFetch('/api/public/chat/threads', {
        method: 'POST',
        body: JSON.stringify({ name: form.name, contact: form.contact, message: form.message }),
      });
      persistCode(data.thread.ticket_code);
      setThread(data.thread);
      setMessages(data.messages || []);
      setForm({ name: '', contact: '', message: '' });
      setMode('chat');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const resumeChat = async () => {
    setError('');
    setBusy(true);
    try {
      const clean = resumeCode.trim();
      const data = await jsonFetch(`/api/public/chat/threads/${encodeURIComponent(clean)}`);
      persistCode(data.thread.ticket_code);
      setThread(data.thread);
      setMessages(data.messages || []);
      setResumeCode('');
      setMode('chat');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    setError('');
    // tampilkan optimis supaya terasa cepat
    const temp = { id: `temp-${Date.now()}`, sender: 'customer', sender_name: 'Kamu', body, created_at: new Date().toISOString(), pending: true };
    setMessages((prev) => [...prev, temp]);
    setDraft('');
    try {
      const data = await jsonFetch(`/api/public/chat/threads/${encodeURIComponent(code)}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
      setMessages((prev) => [...(prev || []).filter((m) => m.id !== temp.id), data.message]);
      setThread(data.thread);
    } catch (e) {
      setMessages((prev) => (prev || []).filter((m) => m.id !== temp.id));
      setDraft(body);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch { /* abaikan */ }
  };

  const grouped = useMemo(() => {
    const out = [];
    let lastDay = '';
    (messages || []).forEach((m) => {
      const d = dayLabel(m.created_at);
      if (d !== lastDay) { out.push({ divider: d, id: `d-${d}-${m.id}` }); lastDay = d; }
      out.push(m);
    });
    return out;
  }, [messages]);

  return (
    <>
      {/* Tombol bubble */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid="chat-widget-button"
        aria-label="Chat dengan admin Daneswara"
        className="fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-white shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition hover:scale-105 hover:bg-zinc-800"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!open && unread > 0 && (
          <span
            data-testid="chat-widget-unread"
            className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[11px] font-bold text-white"
          >
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div
          data-testid="chat-widget-panel"
          className="fixed bottom-24 right-4 z-[60] flex h-[540px] w-[min(94vw,380px)] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white text-zinc-900 shadow-[0_24px_60px_rgba(0,0,0,0.25)]"
        >
          {/* Kepala panel */}
          <div className="flex items-center gap-3 bg-zinc-900 px-4 py-3 text-white">
            {mode === 'resume' && (
              <button type="button" onClick={() => { setMode(code ? 'chat' : 'start'); setError(''); }} data-testid="chat-back-button" className="rounded-md p-1 hover:bg-white/10">
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">Chat Daneswara</div>
              <div className="truncate text-[11px] text-white/70">
                {mode === 'chat' && thread
                  ? `Tiket ${thread.ticket_code} \u00b7 ${thread.status === 'closed' ? 'Ditutup admin' : 'Aktif'}`
                  : 'Tanya harga, desain, atau status pesanan'}
              </div>
            </div>
            {mode === 'chat' && code && (
              <button type="button" onClick={copyCode} data-testid="chat-copy-code" title="Salin kode tiket" className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold hover:bg-white/20">
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {code}
              </button>
            )}
            <button type="button" onClick={() => setOpen(false)} data-testid="chat-close-button" className="rounded-md p-1 hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Isi panel */}
          {mode === 'start' && (
            <div className="flex-1 overflow-y-auto p-4" data-testid="chat-start-form">
              <p className="text-[13px] leading-relaxed text-zinc-600">
                Halo! Isi data singkat ini, nanti kamu dapat <b>kode tiket</b> supaya percakapan bisa
                dilanjutkan dari HP atau komputer lain.
              </p>
              <label className="mt-3 block text-[12px] font-semibold text-zinc-600">Nama</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nama kamu"
                data-testid="chat-name-input"
                className="mt-1 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-900"
              />
              <label className="mt-3 block text-[12px] font-semibold text-zinc-600">WhatsApp atau Email</label>
              <input
                value={form.contact}
                onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                placeholder="08xxxxxxxxxx / nama@email.com"
                data-testid="chat-contact-input"
                className="mt-1 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-900"
              />
              <label className="mt-3 block text-[12px] font-semibold text-zinc-600">Pesan</label>
              <textarea
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                rows={3}
                placeholder="Mau tanya apa?"
                data-testid="chat-first-message-input"
                className="mt-1 w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
              />
              {error && <p className="mt-2 text-[12px] font-medium text-red-600" data-testid="chat-error">{error}</p>}
              <button
                type="button"
                onClick={startChat}
                disabled={busy}
                data-testid="chat-start-button"
                className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Mulai Chat
              </button>
              <button
                type="button"
                onClick={() => { setMode('resume'); setError(''); }}
                data-testid="chat-resume-link"
                className="mt-3 flex w-full items-center justify-center gap-1.5 text-[12px] font-semibold text-zinc-500 hover:text-zinc-900"
              >
                <Ticket className="h-3.5 w-3.5" /> Sudah punya kode tiket? Lanjutkan di sini
              </button>
            </div>
          )}

          {mode === 'resume' && (
            <div className="flex-1 overflow-y-auto p-4" data-testid="chat-resume-form">
              <p className="text-[13px] leading-relaxed text-zinc-600">
                Masukkan kode tiket yang kamu terima sebelumnya, contoh <b>DNS-7KQ4M2</b>.
              </p>
              <input
                value={resumeCode}
                onChange={(e) => setResumeCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === 'Enter') resumeChat(); }}
                placeholder="DNS-XXXXXX"
                data-testid="chat-resume-input"
                className="mt-3 h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-center text-base font-bold tracking-widest text-zinc-900 outline-none focus:border-zinc-900"
              />
              {error && <p className="mt-2 text-[12px] font-medium text-red-600" data-testid="chat-error">{error}</p>}
              <button
                type="button"
                onClick={resumeChat}
                disabled={busy}
                data-testid="chat-resume-button"
                className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Lanjutkan Chat
              </button>
            </div>
          )}

          {mode === 'chat' && (
            <>
              <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto bg-zinc-50 px-3 py-3" data-testid="chat-message-list">
                {(grouped || []).length === 0 && (
                  <p className="py-8 text-center text-[12px] text-zinc-500">Memuat percakapan...</p>
                )}
                {(grouped || []).map((m) =>
                  m.divider ? (
                    <div key={m.id} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{m.divider}</div>
                  ) : (
                    <div key={m.id} className={`flex ${m.sender === 'customer' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        data-testid={`chat-message-${m.sender}`}
                        className={`max-w-[80%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed shadow-sm ${
                          m.sender === 'customer'
                            ? 'rounded-br-md bg-zinc-900 text-white'
                            : 'rounded-bl-md border border-zinc-200 bg-white text-zinc-800'
                        }`}
                      >
                        {m.sender === 'admin' && (
                          <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-600">{m.sender_name || 'Admin'}</div>
                        )}
                        <div className="whitespace-pre-wrap break-words">{m.body}</div>
                        <div className={`mt-1 text-right text-[10px] ${m.sender === 'customer' ? 'text-white/60' : 'text-zinc-400'}`}>
                          {m.pending ? 'mengirim...' : timeLabel(m.created_at)}
                        </div>
                      </div>
                    </div>
                  ),
                )}
              </div>

              {error && <p className="px-3 pt-2 text-[12px] font-medium text-red-600" data-testid="chat-error">{error}</p>}

              {showEmoji && (
                <div className="flex flex-wrap gap-1 border-t border-zinc-100 bg-white px-3 py-2" data-testid="chat-emoji-bar">
                  {(EMOJIS || []).map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setDraft((d) => d + e)}
                      data-testid={`chat-emoji-${e}`}
                      className="rounded-md px-1.5 py-1 text-lg hover:bg-zinc-100"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-2 border-t border-zinc-200 bg-white p-2.5">
                <button
                  type="button"
                  onClick={() => setShowEmoji((v) => !v)}
                  data-testid="chat-emoji-toggle"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                >
                  <Smile className="h-5 w-5" />
                </button>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  rows={1}
                  placeholder="Tulis pesan..."
                  data-testid="chat-message-input"
                  className="max-h-24 min-h-9 flex-1 resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[13px] text-zinc-900 outline-none focus:border-zinc-900"
                />
                <button
                  type="button"
                  onClick={send}
                  disabled={busy || !draft.trim()}
                  data-testid="chat-send-button"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-40"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => { setMode('resume'); setError(''); }}
                data-testid="chat-switch-ticket"
                className="border-t border-zinc-100 bg-zinc-50 py-2 text-[11px] font-semibold text-zinc-500 hover:text-zinc-900"
              >
                Pakai kode tiket lain
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
