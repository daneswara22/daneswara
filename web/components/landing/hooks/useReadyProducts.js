import { useEffect, useState } from "react";
import { BACKEND_URL } from "@/lib/api";

let cache = null;

/**
 * Produk siap jual yang dikelola dari menu Produk di dashboard.
 * Tanpa data contoh: kalau API gagal atau kosong, daftar dibiarkan kosong
 * supaya tidak ada produk palsu yang tampil.
 */
export const useReadyProducts = () => {
  const [items, setItems] = useState(cache || []);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) return;
    let alive = true;
    fetch(`${BACKEND_URL}/api/public/products`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        if (!alive) return;
        cache = Array.isArray(data) ? data : [];
        setItems(cache);
      })
      .catch(() => alive && setItems([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return { items, loading };
};
