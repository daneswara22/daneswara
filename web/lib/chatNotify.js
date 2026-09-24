/**
 * Notifikasi chat: bunyi "ting" dan notifikasi browser.
 * ---------------------------------------------------------------------------
 * Bunyinya dibuat lewat WebAudio (oscillator), jadi tidak perlu berkas audio
 * dan tidak menambah aset. Preferensinya disimpan di localStorage supaya admin
 * bisa mematikan suara tanpa mengubah kode.
 */

const SOUND_KEY = 'dnsw_chat_sound';

export const isChatSoundOn = () => {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(SOUND_KEY) !== 'off';
};

export const setChatSound = (on) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
};

/** Bunyi pendek dua nada, aman dipanggil berulang. */
export function playChatBeep() {
  if (typeof window === 'undefined' || !isChatSoundOn()) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const play = (freq, startAt, dur) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + startAt);
      gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startAt + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + startAt);
      osc.stop(ctx.currentTime + startAt + dur + 0.02);
    };
    play(880, 0, 0.12);
    play(1170, 0.13, 0.16);
    window.setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch { /* browser menolak audio tanpa interaksi: abaikan */ }
}

/** Status izin notifikasi browser: 'unsupported' | 'default' | 'granted' | 'denied'. */
export const browserNotifyState = () => {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
};

export async function askBrowserNotify() {
  if (browserNotifyState() === 'unsupported') return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

/** Tampilkan notifikasi browser kalau izinnya sudah diberikan. */
export function notifyBrowser(title, body) {
  if (browserNotifyState() !== 'granted') return;
  try {
    const n = new Notification(title, { body, icon: '/logo192.png', tag: 'dnsw-chat' });
    n.onclick = () => { window.focus(); n.close(); };
  } catch { /* abaikan */ }
}
