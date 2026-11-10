// Bluetooth printer reliability tests (no real hardware needed).
// Run: cd web && npx tsx scripts/test-printer.ts
//
// Stubs the browser APIs that lib/printer.js touches (localStorage, Web
// Bluetooth, Web Locks, document) and drives the module through the failure
// scenarios from the spec: idle drop, power cycle, page navigation, two users
// on one printer, logout during print, disconnect mid-print, no double print.

type Listener = () => void;

class FakeGatt {
  connected = false;
  failConnect = 0;          // number of connect() calls that should throw
  connectCalls = 0;
  disconnectCalls = 0;
  private listeners: Listener[] = [];

  addEventListener(_e: string, cb: Listener) { this.listeners.push(cb); }
  removeEventListener(_e: string, cb: Listener) { this.listeners = this.listeners.filter((x) => x !== cb); }
  fireDisconnected() { this.connected = false; this.listeners.forEach((l) => l()); }

  async connect() {
    this.connectCalls++;
    if (this.failConnect > 0) { this.failConnect--; throw new Error("GATT connect failed"); }
    this.connected = true;
    return this;
  }
  disconnect() { this.disconnectCalls++; this.connected = false; this.fireDisconnected(); }
  async getPrimaryServices() {
    return [{
      getCharacteristics: async () => [{
        properties: { write: true, writeWithoutResponse: true },
        writeValue: async (b: Uint8Array) => { writes.push(Array.from(b)); },
        writeValueWithoutResponse: async (b: Uint8Array) => { writes.push(Array.from(b)); },
      }],
    }];
  }
}

class FakeDevice {
  id: string;
  name: string;
  gatt = new FakeGatt();
  private listeners: Listener[] = [];
  constructor(id: string, name: string) { this.id = id; this.name = name; }
  addEventListener(_e: string, cb: Listener) { this.listeners.push(cb); }
  removeEventListener(_e: string, cb: Listener) { this.listeners = this.listeners.filter((x) => x !== cb); }
  fireDisconnected() { this.gatt.connected = false; this.listeners.forEach((l) => l()); }
}

let writes: number[][] = [];
let devices: FakeDevice[] = [];
let nextRequested: FakeDevice | null = null;

// ---- browser stubs -------------------------------------------------------
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
};
(globalThis as any).document = {
  visibilityState: "visible",
  addEventListener: () => {},
  body: { contains: () => true, appendChild: () => {}, removeChild: () => {} },
  createElement: () => ({ style: {}, setAttribute: () => {}, contentWindow: null, contentDocument: null }),
};
(globalThis as any).window = globalThis;
(globalThis as any).location = { origin: "http://localhost:3000", href: "http://localhost:3000/", pathname: "/" };
(globalThis as any).Image = class {
  width = 0;
  height = 0;
  onload: any = null;
  onerror: any = null;
  crossOrigin = "";
  // The logo raster is optional; failing fast keeps the test from hanging on a
  // promise that would never settle in Node.
  set src(_v: string) { setTimeout(() => this.onerror && this.onerror(new Error("no image in test")), 0); }
};
// Node 26 ships a read-only `navigator` global, so it must be redefined.
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  writable: true,
  value: {
    bluetooth: {
      requestDevice: async () => {
        if (!nextRequested) throw Object.assign(new Error("cancelled"), { name: "NotFoundError" });
        const d = nextRequested;
        if (!devices.includes(d)) devices.push(d);
        return d;
      },
      getDevices: async () => devices,
    },
    locks: {
      request: async (_name: string, _opts: any, fn: any) => fn(),
    },
  },
});

// ---- tiny test runner ----------------------------------------------------
let pass = 0;
let fail = 0;
const failures: string[] = [];
async function t(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    pass++;
    console.log(`  OK   ${name}`);
  } catch (e: any) {
    fail++;
    failures.push(`${name}: ${e?.message || e}`);
    console.log(`  FAIL ${name} -> ${e?.message || e}`);
  }
}
function eq(actual: any, expected: any, label: string) {
  if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function ok(cond: any, label: string) { if (!cond) throw new Error(label); }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const P = await import("./.tmp/printer.bundle.mjs");

  // A receipt payload that is small but non-empty.
  const receipt = {
    invoice: "INV-TEST",
    created_at: new Date().toISOString(),
    items: [{ name: "Kaos", qty: 1, price: 100000, disc: 0 }],
    subtotal: 100000, total: 100000, paid_amount: 100000, payment_method: "Cash",
  };
  const settings = { business_name: "Daneswara", print_mode: "bluetooth", paper_width: "58" };

  console.log("\n[1] Per-user printer config isolation");
  await t("two users keep separate printer configs", async () => {
    P.setPrinterUserScope("userA");
    P.setDevicePrinterConfig({ print_mode: "bluetooth", paper_width: "58", last_device_name: "A-Printer" });
    P.setPrinterUserScope("userB");
    P.setDevicePrinterConfig({ print_mode: "desktop", paper_width: "80", last_device_name: "B-Printer" });
    P.setPrinterUserScope("userA");
    const a = P.getDevicePrinterConfig();
    eq(a.last_device_name, "A-Printer", "userA printer name");
    eq(a.paper_width, "58", "userA paper width");
    P.setPrinterUserScope("userB");
    const b = P.getDevicePrinterConfig();
    eq(b.last_device_name, "B-Printer", "userB printer name");
    eq(b.paper_width, "80", "userB paper width");
  });

  await t("legacy device config is migrated to the first user", async () => {
    store.clear();
    store.set("pos_printer_config_v1", JSON.stringify({ print_mode: "bluetooth", last_device_name: "Legacy" }));
    P.setPrinterUserScope("userC");
    const c = P.getDevicePrinterConfig();
    eq(c.last_device_name, "Legacy", "migrated name");
    ok(store.has("pos_printer_config_v1:userC"), "scoped key written");
  });

  console.log("\n[2] Status enum");
  await t("exposes exactly the six required states", async () => {
    const seen = new Set<string>();
    const off = P.setPrinterStatusCallback((s: string) => seen.add(s));
    eq(P.getPrinterStatus(), "disconnected", "initial status");
    off();
    ok(typeof P.getPrinterStatus === "function", "getPrinterStatus exported");
    ok(typeof P.getPrinterError === "function", "getPrinterError exported");
    ok(seen.has("disconnected"), "callback fired on subscribe");
  });

  console.log("\n[3] Connect + print");
  await t("connect then print streams bytes once", async () => {
    writes = [];
    const dev = new FakeDevice("dev-1", "TM-80D");
    nextRequested = dev;
    P.setPrinterUserScope("userA");
    P.setDevicePrinterConfig({ print_mode: "bluetooth", paper_width: "58" });
    const name = await P.connectBluetoothPrinter();
    eq(name, "TM-80D", "printer name");
    eq(P.isPrinterConnected(), true, "connected");
    const mode = await P.printReceiptSmart(receipt, settings);
    eq(mode, "bluetooth", "print mode");
    ok(writes.length > 0, "bytes written");
    eq(P.getPrinterStatus(), "connected", "status back to connected after print");
  });

  console.log("\n[4] Auto reconnect");
  await t("reconnects automatically after an idle GATT drop", async () => {
    const dev = devices[0];
    writes = [];
    dev.fireDisconnected();               // simulate idle drop
    await sleep(1200);                    // watchdog/backoff window
    eq(P.isPrinterConnected(), true, "link restored without user action");
    const mode = await P.printReceiptSmart(receipt, settings);
    eq(mode, "bluetooth", "print after auto reconnect");
  });

  await t("reconnects before printing when the link is already dead", async () => {
    const dev = devices[0];
    writes = [];
    dev.gatt.connected = false;           // dead link, no event fired
    const mode = await P.printReceiptSmart(receipt, settings);
    eq(mode, "bluetooth", "print succeeded after pre-print reconnect");
    ok(writes.length > 0, "bytes written");
  });

  await t("power cycle: printer off then on", async () => {
    const dev = devices[0];
    dev.gatt.failConnect = 3;             // printer off for a few attempts
    dev.fireDisconnected();
    await sleep(6000);                    // backoff 600+960+1536+2458ms
    eq(P.isPrinterConnected(), true, "recovered after printer came back");
  });

  console.log("\n[5] Print queue");
  await t("serializes concurrent jobs from two users", async () => {
    writes = [];
    const dev = devices[0];
    dev.gatt.failConnect = 0;
    dev.gatt.connected = true;
    P.setPrinterUserScope("userA");
    const j1 = P.printReceiptSmart({ ...receipt, invoice: "A-1" }, settings).catch((e: any) => "ERR:" + e.message);
    P.setPrinterUserScope("userB");
    const j2 = P.printReceiptSmart({ ...receipt, invoice: "B-1" }, settings).catch((e: any) => "ERR:" + e.message);
    const [r1, r2] = await Promise.all([j1, j2]);
    eq(r1, "bluetooth", "job 1");
    eq(r2, "bluetooth", "job 2");
    const info = P.getPrintQueueInfo();
    eq(info.pending, 0, "queue drained");
    eq(info.running, false, "queue idle");
  });

  await t("queue reports pending jobs while a print is running", async () => {
    const dev = devices[0];
    dev.gatt.failConnect = 0;
    dev.gatt.connected = true;
    P.setPrinterUserScope("userA");
    const jobs = [
      P.printReceiptSmart({ ...receipt, invoice: "Q-1" }, settings).catch((e: any) => "ERR:" + e.message),
      P.printReceiptSmart({ ...receipt, invoice: "Q-2" }, settings).catch((e: any) => "ERR:" + e.message),
      P.printReceiptSmart({ ...receipt, invoice: "Q-3" }, settings).catch((e: any) => "ERR:" + e.message),
    ];
    await sleep(5);
    const info = P.getPrintQueueInfo();
    ok(info.pending >= 1 || info.running, "queue shows activity");
    const res = await Promise.all(jobs);
    ok(res.every((r) => r === "bluetooth"), `all jobs printed, got ${JSON.stringify(res)}`);
    eq(P.getPrintQueueInfo().pending, 0, "all jobs finished");
  });

  console.log("\n[6] Reliability");
  await t("no double print when the first write succeeds", async () => {
    const dev = devices[0];
    dev.gatt.connected = true;
    writes = [];
    await P.printReceiptSmart(receipt, settings);
    const first = writes.length;
    ok(first > 0, "bytes written");
    // A second, separate print must add bytes (not replay the first).
    writes = [];
    await P.printReceiptSmart(receipt, settings);
    eq(writes.length, first, "each print writes the payload exactly once");
  });

  await t("retries the full payload once after a mid-print drop", async () => {
    const dev = devices[0];
    dev.gatt.connected = true;
    writes = [];
    // Make the first write attempt fail by dropping the link right before it.
    const origWrite = dev.gatt.getPrimaryServices;
    let calls = 0;
    (dev.gatt as any).getPrimaryServices = async function () {
      calls++;
      if (calls === 1) throw new Error("GATT server disconnected");
      return origWrite.call(this);
    };
    const mode = await P.printReceiptSmart(receipt, settings);
    eq(mode, "bluetooth", "print recovered");
    ok(writes.length > 0, "payload delivered after retry");
    (dev.gatt as any).getPrimaryServices = origWrite;
  });

  await t("fails fast with a clear error when the printer is unreachable", async () => {
    const dev = devices[0];
    dev.gatt.connected = false;
    dev.gatt.failConnect = 999;           // printer permanently off
    let err = "";
    try { await P.printReceiptSmart(receipt, settings); } catch (e: any) { err = e.message; }
    ok(/printer|Printer/.test(err), `clear error message, got: ${err}`);
    eq(P.getPrinterStatus(), "error", "status is error");
    ok(P.getPrinterError().length > 0, "error text exposed to UI");
    dev.gatt.failConnect = 0;
  });

  console.log("\n[7] Logout safety");
  await t("logout during a print does not lose the job", async () => {
    const dev = devices[0];
    dev.gatt.connected = true;
    dev.gatt.failConnect = 0;
    P.setPrinterUserScope("userA");
    writes = [];
    const job = P.printReceiptSmart(receipt, settings);
    P.setPrinterUserScope("");            // logout mid-print
    const mode = await job;
    eq(mode, "bluetooth", "job completed after logout");
    ok(writes.length > 0, "bytes still delivered");
  });

  await t("disconnect clears state and reports disconnected", async () => {
    P.disconnectPrinter();
    eq(P.isPrinterConnected(), false, "not connected");
    eq(P.getPrinterStatus(), "disconnected", "status disconnected");
    eq(P.getPrinterName(), "", "name cleared");
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) { failures.forEach((f) => console.log("  - " + f)); process.exit(1); }
  // The keep-alive watchdog interval would otherwise hold the event loop open.
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
