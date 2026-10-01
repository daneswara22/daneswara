/**
 * Keranjang belanja publik (mobile) - disimpan di localStorage browser.
 * Sengaja tanpa tabel baru: saat checkout isinya dikirim ke endpoint pesanan
 * yang SUDAH ADA (sticker-orders / custom-tees/orders).
 */
const KEY = 'dp_shop_cart_v1';
const ORDERS_KEY = 'dp_shop_orders_v1';
export const CART_EVENT = 'dp-cart-change';

const read = (key) => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
};

const write = (key, items) => {
  if (typeof window === 'undefined') return items;
  try {
    window.localStorage.setItem(key, JSON.stringify(items));
  } catch {
    /* kuota penuh: biarkan, UI tetap jalan */
  }
  window.dispatchEvent(new Event(CART_EVENT));
  return items;
};

export const getCart = () => read(KEY);
export const setCart = (items) => write(KEY, items);
export const cartCount = () => getCart().reduce((a, i) => a + (Number(i.qty) || 0), 0);

export function addToCart(item) {
  const items = getCart();
  const sig = JSON.stringify({ slug: item.slug, options: item.options, design: !!item.design });
  const found = items.find((i) => JSON.stringify({ slug: i.slug, options: i.options, design: !!i.design }) === sig);
  if (found) found.qty = (Number(found.qty) || 0) + (Number(item.qty) || 1);
  else items.push({ ...item, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, selected: true });
  return setCart(items);
}

export const updateItem = (id, patch) =>
  setCart(getCart().map((i) => (i.id === id ? { ...i, ...patch } : i)));

export const removeItem = (id) => setCart(getCart().filter((i) => i.id !== id));

export const clearSelected = () => setCart(getCart().filter((i) => !i.selected));

export const selectAll = (on) => setCart(getCart().map((i) => ({ ...i, selected: !!on })));

/** Riwayat pesanan ringkas (kode order dari server) supaya tab Pesanan ada isinya. */
export const getOrders = () => read(ORDERS_KEY);
export const addOrders = (rows) => write(ORDERS_KEY, [...rows, ...getOrders()].slice(0, 50));
