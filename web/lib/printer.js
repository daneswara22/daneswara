// Thermal (Bluetooth BLE / ESC-POS) + Desktop (HTML iframe) printing utilities.

let btDevice = null;
let btChar = null;
let btName = "";
let btKeepStay = false;     // maintain connection until user explicitly disconnects
let btWatchdog = null;      // interval: watchdog + keep-alive
let btReconnecting = false;
let btWriteBusy = false;    // simple mutex so keep-alive & print never overlap
let btStatusCb = null;      // UI callback: 'connected' | 'reconnecting' | 'lost' | 'disconnected'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function notifyBt(status) { try { btStatusCb && btStatusCb(status, btName); } catch (e) {} }
export function setPrinterStatusCallback(cb) { btStatusCb = cb; }
export const isPrinterReconnecting = () => btReconnecting;

export const rp = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });

// ---- Per-DEVICE printer config (localStorage) ----
// Printer setup (list, active printer, mode, paper width) is stored on THIS
// device only, so two devices never overwrite each other's printer settings.
const DEVICE_CFG_KEY = "pos_printer_config_v1";
export function getDevicePrinterConfig() {
  try {
    const raw = localStorage.getItem(DEVICE_CFG_KEY);
    if (!raw) return {};
    const c = JSON.parse(raw);
    return c && typeof c === "object" ? c : {};
  } catch { return {}; }
}
export function setDevicePrinterConfig(cfg = {}) {
  try {
    const cur = getDevicePrinterConfig();
    const next = { ...cur, ...cfg };
    localStorage.setItem(DEVICE_CFG_KEY, JSON.stringify({
      print_mode: next.print_mode || "desktop",
      paper_width: next.paper_width || "58",
      printers: next.printers || [],
      active_printer: next.active_printer || "",
      last_device_id: next.last_device_id || "",
      last_device_name: next.last_device_name || "",
    }));
  } catch (e) { /* ignore */ }
  return true;
}

// Payment status label for a receipt/order: "DEPOSIT" (pending order) or "LUNAS VIA <method>".
export function paymentStatus(r) {
  if (r && (r.__draft === true || r.status === "Draft")) return "BELUM DIBAYAR";
  const pendingOrder = r && r.deposit_amount != null && r.status && r.status !== "Selesai";
  if (pendingOrder) return "DEPOSIT";
  return "LUNAS VIA " + (r?.payment_method || "-");
}

export function normalizePhone(p) {
  let d = (p || "").replace(/[^0-9]/g, "");
  if (!d) return "";
  if (d.startsWith("0")) d = "62" + d.slice(1);
  else if (d.startsWith("8")) d = "62" + d;
  return d;
}

// Plain-text receipt for WhatsApp / clipboard.
export function buildReceiptText(r, settings = {}) {
  const L = [];
  L.push(`*${settings.business_name || "Daneswara POS"}*`);
  if (settings.address) L.push(settings.address);
  if (settings.phone) L.push(`Telp: ${settings.phone}`);
  L.push("--------------------------------");
  L.push(`No   : ${r.invoice || r.order_number || "-"}`);
  L.push(`Tgl  : ${new Date(r.created_at).toLocaleString("id-ID")}`);
  if (r.customer_name) L.push(`Nama : ${r.customer_name}`);
  if (r.cashier) L.push(`Kasir: ${r.cashier}`);
  L.push("--------------------------------");
  (r.items || []).forEach((i) => {
    L.push(`${i.qty} x ${i.name}`);
    L.push(`     ${i.qty} x ${rp(i.price)}  =  ${rp(i.price * i.qty)}`);
    if (i.note) L.push(`     * ${i.note}`);
  });
  L.push("--------------------------------");
  L.push(`Subtotal : ${rp(r.subtotal)}`);
  if (r.discount) L.push(`Diskon   : -${rp(r.discount)}`);
  if (r.tax) L.push(`Pajak    : ${rp(r.tax)}`);
  L.push(`*TOTAL   : ${rp(r.total)}*`);
  const pendingOrder = r.deposit_amount != null && r.status && r.status !== "Selesai";
  if (r.deposit_amount != null) {
    L.push(`Deposit  : ${rp(r.deposit_amount)}`);
    L.push(`${pendingOrder ? "Sisa" : "Pelunasan"} : ${rp(pendingOrder ? r.remaining : (r.settle_paid ?? r.remaining ?? 0))}`);
  } else {
    L.push(`Bayar (${r.payment_method}) : ${rp(r.paid_amount)}`);
    if (r.change) L.push(`Kembali  : ${rp(r.change)}`);
  }
  L.push(`*STATUS  : ${paymentStatus(r)}*`);
  L.push("--------------------------------");
  L.push(settings.receipt_footer || "Terima kasih telah berbelanja!");
  return L.join("\n");
}

export function sendReceiptWhatsApp(r, settings, phone) {
  const text = buildReceiptText(r, settings);
  const d = normalizePhone(phone);
  const url = d ? `https://wa.me/${d}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank");
  return !!d;
}

export async function copyReceiptText(r, settings) {
  const text = buildReceiptText(r, settings);
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
  return true;
}

// Reusable hidden iframe for desktop printing (avoids re-creating the DOM node each print).
let _printFrame = null;
function getPrintFrame() {
  if (_printFrame && document.body.contains(_printFrame)) return _printFrame;
  _printFrame = document.createElement("iframe");
  _printFrame.setAttribute("aria-hidden", "true");
  _printFrame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(_printFrame);
  return _printFrame;
}

// Warm the browser image cache for the default logo so first print is fast.
if (typeof window !== "undefined") {
  const pre = new Image();
  pre.src = "/logo.png";
}

export const bluetoothSupported = () => typeof navigator !== "undefined" && !!navigator.bluetooth;
export const isPrinterConnected = () => !!btChar;
export const getPrinterName = () => btName;

const KNOWN_SERVICES = [
  0x18f0, 0xffe0, 0xff00, 0xfff0, 0xe0ff,
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000fff0-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
];

// Find the first writable characteristic across the printer's GATT services.
async function locateWritable(server) {
  const services = await server.getPrimaryServices();
  for (const s of services) {
    const chars = await s.getCharacteristics();
    for (const c of chars) {
      if (c.properties.write || c.properties.writeWithoutResponse) return c;
    }
  }
  return null;
}

// Attach the disconnect listener + start the keep-alive/watchdog loop that keeps
// the link alive and silently reconnects if the printer drops unexpectedly.
function armConnection(device) {
  try { device.removeEventListener("gattserverdisconnected", onGattDisconnected); } catch (e) {}
  device.addEventListener("gattserverdisconnected", onGattDisconnected);
  startWatchdog();
}

function onGattDisconnected() {
  btChar = null;
  if (btKeepStay) { notifyBt("reconnecting"); reconnectPrinter(); }
  else notifyBt("disconnected");
}

// Reconnect to the SAME already-permitted device (no user gesture needed) with backoff.
async function reconnectPrinter(maxAttempts = 10) {
  if (btReconnecting || !btDevice || !btKeepStay) return false;
  btReconnecting = true;
  notifyBt("reconnecting");
  let delay = 600;
  for (let a = 0; a < maxAttempts && btKeepStay; a++) {
    try {
      if (!btDevice.gatt.connected) await btDevice.gatt.connect();
      const w = await locateWritable(btDevice.gatt);
      if (w) { btChar = w; btReconnecting = false; notifyBt("connected"); return true; }
    } catch (e) { /* retry */ }
    await sleep(delay);
    delay = Math.min(Math.round(delay * 1.6), 5000);
  }
  btReconnecting = false;
  if (btKeepStay) notifyBt("lost");
  return false;
}

function startWatchdog() {
  stopWatchdog();
  btWatchdog = setInterval(async () => {
    if (!btKeepStay || !btDevice) return;
    if (!btDevice.gatt.connected) { btChar = null; reconnectPrinter(); return; }
    if (!btChar || btReconnecting) return;
    // Keep-alive: NUL byte is ignored by ESC/POS printers but keeps the BLE link
    // active, preventing the idle timeout that causes sudden disconnects.
    try {
      await safeWrite(async (ch) => {
        if (ch.properties.writeWithoutResponse) await ch.writeValueWithoutResponse(new Uint8Array([0x00]));
        else await ch.writeValue(new Uint8Array([0x00]));
      });
    } catch (e) { btChar = null; reconnectPrinter(); }
  }, 8000);
}
function stopWatchdog() { if (btWatchdog) { clearInterval(btWatchdog); btWatchdog = null; } }

// Serialize all writes (print + keep-alive) so BLE never gets "operation in progress".
async function safeWrite(fn) {
  let waited = 0;
  while (btWriteBusy && waited < 5000) { await sleep(25); waited += 25; }
  btWriteBusy = true;
  try {
    if (!btChar) throw new Error("Printer tidak terhubung");
    return await fn(btChar);
  } finally { btWriteBusy = false; }
}

// Connect to a BLE thermal printer and keep it alive across the session.
export async function connectBluetoothPrinter() {
  if (!bluetoothSupported()) {
    throw new Error("Browser ini tidak mendukung Web Bluetooth. Gunakan Chrome di Android/Windows.");
  }
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: KNOWN_SERVICES,
  });
  const server = await device.gatt.connect().catch(async (err) => {
    // BLE printers accept only ONE active connection. Retry once, then explain.
    await sleep(700);
    return device.gatt.connect().catch(() => {
      throw new Error("Gagal terhubung ke printer. Printer thermal Bluetooth hanya bisa terhubung ke SATU perangkat dalam satu waktu — pastikan printer sudah diputuskan (disconnect) dari perangkat lain, dekat & menyala, lalu coba lagi. Untuk dipakai banyak perangkat sekaligus, gunakan mode USB/Desktop.");
    });
  });
  const writable = await locateWritable(server);
  if (!writable) throw new Error("Karakteristik tulis printer tidak ditemukan. Pastikan printer mendukung BLE.");
  btDevice = device;
  btChar = writable;
  btName = device.name || "Printer Thermal";
  btKeepStay = true;
  try { setDevicePrinterConfig({ last_device_id: device.id, last_device_name: btName }); } catch (e) {}
  armConnection(device);
  notifyBt("connected");
  return btName;
}

// Silently restore a previously-permitted printer after a page reload/navigation
// (Chrome only). No user gesture required for devices already granted permission.
export async function restorePrinterConnection() {
  if (btChar) return btName;               // already connected
  if (!bluetoothSupported() || !navigator.bluetooth.getDevices) return "";
  const cfg = getDevicePrinterConfig();
  if (!cfg.last_device_id) return "";
  try {
    const devices = await navigator.bluetooth.getDevices();
    const dev = devices.find((d) => d.id === cfg.last_device_id) || devices.find((d) => d.name === cfg.last_device_name);
    if (!dev) return "";
    btDevice = dev;
    btName = dev.name || cfg.last_device_name || "Printer Thermal";
    btKeepStay = true;
    armConnection(dev);
    const ok = await reconnectPrinter(4);
    return ok ? btName : "";
  } catch (e) { return ""; }
}

export function disconnectPrinter() {
  btKeepStay = false;
  stopWatchdog();
  try { if (btDevice?.gatt?.connected) btDevice.gatt.disconnect(); } catch (e) {}
  btChar = null; btDevice = null; btName = "";
  notifyBt("disconnected");
}

async function writeBytes(bytes) {
  const CHUNK = 180;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const chunk = bytes.slice(i, i + CHUNK);
    await safeWrite(async (ch) => {
      if (ch.properties.writeWithoutResponse) await ch.writeValueWithoutResponse(chunk);
      else await ch.writeValue(chunk);
    });
    await sleep(20);
  }
}

// Convert an image to a centered, size-limited ESC/POS raster command (GS v 0).
// Logo is capped small-medium and centered within the full printable width.
async function imageToRaster(src, { maxW = 220, maxH = 150, fullW = 384 } = {}) {
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i); i.onerror = rej; i.src = src;
  });
  // Target logo dimensions (keep aspect ratio, cap width AND height).
  let lw = img.width || maxW, lh = img.height || maxH;
  if (lw > maxW) { lh = Math.round((lh * maxW) / lw); lw = maxW; }
  if (maxH && lh > maxH) { lw = Math.round((lw * maxH) / lh); lh = maxH; }
  // Canvas padded to full printable width (byte-aligned) so the logo is centered.
  const W = Math.ceil(fullW / 8) * 8;
  const H = Math.max(1, lh);
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
  const ox = Math.max(0, Math.round((W - lw) / 2));
  ctx.drawImage(img, ox, 0, lw, lh);
  const data = ctx.getImageData(0, 0, W, H).data;
  const bytesPerRow = W / 8;
  const raster = new Uint8Array(bytesPerRow * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      const rr = data[idx], gg = data[idx + 1], bb = data[idx + 2], aa = data[idx + 3];
      const nearWhite = rr > 230 && gg > 230 && bb > 230;
      if (aa > 128 && !nearWhite) raster[y * bytesPerRow + (x >> 3)] |= (0x80 >> (x % 8));
    }
  }
  const header = [0x1d, 0x76, 0x30, 0x00, bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff, H & 0xff, (H >> 8) & 0xff];
  return new Uint8Array([...header, ...raster]);
}

// Build ESC/POS byte stream from a structured receipt.
async function buildEscPos(r, settings) {
  const enc = new TextEncoder();
  const out = [];
  const push = (arr) => out.push(...arr);
  const text = (str) => push(Array.from(enc.encode(str)));
  const ESC = 0x1b, GS = 0x1d;
  const paper = String(settings.paper_width || "58");
  const WIDTH = paper === "80" ? 48 : 32; // chars per line (Font A): 58mm~32, 80mm~48
  const RASTER_W = paper === "80" ? 576 : 384; // printable dots

  const row = (l, rr) => {
    const left = String(l), right = String(rr);
    const space = Math.max(1, WIDTH - left.length - right.length);
    return left + " ".repeat(space) + right + "\n";
  };
  const divider = "-".repeat(WIDTH) + "\n";

  push([ESC, 0x40]); // init
  push([ESC, 0x61, 0x01]); // center
  // logo raster — capped small-medium (~1/3 width) & centered so it never eats the whole roll.
  const logoSrc = settings.logo || `${window.location.origin}/logo.png`;
  try {
    const logoW = Math.round(RASTER_W * 0.42); // ~1/3–1/2 of paper width
    const raster = await imageToRaster(logoSrc, { maxW: logoW, maxH: 160, fullW: RASTER_W });
    push(Array.from(raster));
    push([0x0a]);
  } catch (e) { /* skip logo if it fails */ }
  push([ESC, 0x21, 0x30]); // double height+width
  text((settings.business_name || "Daneswara POS") + "\n");
  push([ESC, 0x21, 0x00]); // normal
  if (settings.address) text(settings.address + "\n");
  if (settings.phone) text(settings.phone + "\n");
  push([ESC, 0x61, 0x00]); // left
  text(divider);
  text(r.invoice ? `${r.invoice}\n` : `${r.order_number || ""}\n`);
  text(`${new Date(r.created_at).toLocaleString("id-ID")}\n`);
  if (r.customer_name) text(`Nama: ${r.customer_name}\n`);
  if (r.cashier) text(`Kasir: ${r.cashier}\n`);
  text(divider);
  (r.items || []).forEach((i) => {
    text(`${i.qty}x ${i.name}\n`);
    text(`  ${rp(i.price)} x ${i.qty}\n`);
    text(row("", rp(i.price * i.qty)));
    if (i.note) text(`  * ${i.note}\n`);
  });
  text(divider);
  text(row("Subtotal", rp(r.subtotal)));
  if (r.discount) text(row("Diskon", "-" + rp(r.discount)));
  if (r.tax) text(row(`Pajak(${r.tax_rate}%)`, rp(r.tax)));
  push([ESC, 0x21, 0x08]); // bold
  text(row("TOTAL", rp(r.total)));
  push([ESC, 0x21, 0x00]);
  if (r.__draft === true || r.status === "Draft") {
    // draft/quotation: no payment lines
  } else if (r.deposit_amount != null && (r.deposit_amount || r.remaining != null)) {
    text(row("Deposit (DP)", rp(r.deposit_amount)));
    text(row(r.status === "Selesai" ? "Lunas" : "Sisa", rp(r.remaining)));
  } else {
    text(row(r.payment_method || "Bayar", rp(r.paid_amount)));
    if (r.change) text(row("Kembalian", rp(r.change)));
  }
  push([ESC, 0x61, 0x01]); // center
  push([ESC, 0x21, 0x08]); // bold
  text("* " + paymentStatus(r) + " *\n");
  push([ESC, 0x21, 0x00]);
  push([ESC, 0x61, 0x00]); // left
  text(divider);
  push([ESC, 0x61, 0x01]); // center
  text((settings.receipt_footer || "Terima kasih telah berbelanja!") + "\n");
  push([0x0a, 0x0a, 0x0a]); // feed
  push([GS, 0x56, 0x42, 0x00]); // partial cut (ignored if unsupported)
  return new Uint8Array(out);
}

// Desktop / HTML print via hidden iframe (works on all devices).
export function printDesktop(r, settings) {
  const logo = settings.logo || `${window.location.origin}/logo.png`;
  const line = (l, rr) => `<div class="row"><span>${l}</span><span>${rr}</span></div>`;
  const items = (r.items || [])
    .map((i) => line(`${i.qty}x ${i.name}`, rp(i.price * i.qty)) + `<div class="note">${rp(i.price)} x ${i.qty}</div>` + (i.note ? `<div class="note">* ${i.note}</div>` : ""))
    .join("");
  const isDraft = r.__draft === true || r.status === "Draft";
  const isOrder = r.deposit_amount != null && r.remaining != null && !r.paid_amount;
  const payRows = isDraft
    ? ""
    : isOrder
    ? line("Deposit (DP)", rp(r.deposit_amount)) + line(r.status === "Selesai" ? "Lunas" : "Sisa", rp(r.remaining))
    : line(r.payment_method || "Bayar", rp(r.paid_amount)) + line("Kembalian", rp(r.change || 0));
  const pageW = String(settings.paper_width || "58") === "80" ? "80mm" : "58mm";
  const html = `<html><head><title>${r.invoice || r.order_number || "Struk"}</title>
<style>
  @page { size: ${pageW} auto; margin: 3mm; }
  * { font-family: 'Courier New', monospace; font-size: 12px; box-sizing: border-box; }
  body { margin: 0; color: #000; }
  h2 { text-align: center; font-size: 14px; margin: 4px 0; }
  p.sub { text-align: center; margin: 0; font-size: 11px; }
  img.logo { display:block; margin: 0 auto 4px; max-width: 40%; max-height: 70px; object-fit: contain; }
  .divider { border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; margin: 2px 0; }
  .note { font-size: 11px; font-style: italic; margin: 0 0 2px 8px; }
  .bold { font-weight: bold; }
  .center { text-align: center; }
</style></head><body>
  <img class="logo" src="${logo}" onerror="this.style.display='none'"/>
  <h2>${settings.business_name || "Daneswara POS"}</h2>
  ${settings.address ? `<p class="sub">${settings.address}</p>` : ""}
  ${settings.phone ? `<p class="sub">${settings.phone}</p>` : ""}
  <div class="divider"></div>
  <div class="row"><span>${r.invoice || r.order_number || ""}</span></div>
  <div class="row"><span>${new Date(r.created_at).toLocaleString("id-ID")}</span></div>
  ${r.customer_name ? `<div class="row"><span>Nama: ${r.customer_name}</span></div>` : ""}
  ${r.cashier ? `<div class="row"><span>Kasir: ${r.cashier}</span></div>` : ""}
  <div class="divider"></div>
  ${items}
  <div class="divider"></div>
  ${line("Subtotal", rp(r.subtotal))}
  ${r.discount ? line("Diskon", "-" + rp(r.discount)) : ""}
  ${r.tax ? line(`Pajak (${r.tax_rate}%)`, rp(r.tax)) : ""}
  <div class="row bold"><span>TOTAL</span><span>${rp(r.total)}</span></div>
  ${payRows}
  <div class="center bold" style="margin-top:4px;border:1px solid #000;padding:2px;">${paymentStatus(r)}</div>
  <div class="divider"></div>
  ${r.note ? `<p class="sub">Catatan: ${r.note}</p>` : ""}
  <p class="center">${settings.receipt_footer || "Terima kasih telah berbelanja!"}</p>
</body></html>`;
  const iframe = getPrintFrame();
  const doc = iframe.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  const fire = () => { try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) {} };
  // Print as soon as content is ready; don't block on slow image loads.
  let fired = false;
  const once = () => { if (fired) return; fired = true; fire(); };
  iframe.onload = once;
  const logoImg = doc.querySelector("img.logo");
  if (!logoImg || logoImg.complete) once();
  else { logoImg.onload = once; logoImg.onerror = once; setTimeout(once, 400); }
}

// Main entry: prints according to selected mode. Falls back to desktop on error.
export async function printReceiptSmart(r, settings) {
  // Per-device printer config always wins over server/account settings.
  const dev = getDevicePrinterConfig();
  const merged = { ...settings };
  if (dev.print_mode) merged.print_mode = dev.print_mode;
  if (dev.paper_width) merged.paper_width = dev.paper_width;
  const mode = merged.print_mode || "desktop";
  if (mode === "bluetooth") {
    // If the link dropped momentarily, try to restore it before giving up.
    if (!isPrinterConnected() && btDevice && btKeepStay) {
      await reconnectPrinter(6);
    }
    if (!isPrinterConnected()) throw new Error("Printer Bluetooth belum terhubung di perangkat ini. Hubungkan dulu lewat menu Pengaturan, atau gunakan mode USB/Desktop agar bisa dipakai banyak perangkat.");
    const payload = await buildEscPos(r, merged);
    try {
      await writeBytes(payload);
    } catch (e) {
      // The link may have died silently (idle GATT death) without a disconnect
      // event yet. Reconnect and retry the full receipt once before failing.
      btChar = null;
      const ok = await reconnectPrinter(6);
      if (!ok) throw new Error("Printer Bluetooth terputus. Pastikan printer menyala & berada dekat, lalu coba cetak lagi.");
      try {
        await writeBytes(payload);
      } catch (e2) {
        throw new Error("Gagal mengirim ke printer Bluetooth. Pastikan printer menyala & dekat, lalu coba cetak lagi.");
      }
    }
    return "bluetooth";
  }
  printDesktop(r, merged);
  return "desktop";
}
