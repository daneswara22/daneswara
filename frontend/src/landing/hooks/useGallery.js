import { useEffect, useState } from "react";
import { BACKEND_URL } from "@/lib/api";

export const GALLERY_FALLBACKS = [
  { id: "f1", src: "https://images.unsplash.com/photo-1759941279446-dea2722bca33?crop=entropy&cs=srgb&fm=jpg&w=900&q=80", label: "Heritage Tour Tee", tag: "Screen Print", span: "lg:row-span-2 lg:col-span-2" },
  { id: "f2", src: "https://images.unsplash.com/photo-1773169652570-79ed784aee61?crop=entropy&cs=srgb&fm=jpg&w=900&q=80", label: "Sunset Rider", tag: "DTF", span: "" },
  { id: "f3", src: "https://images.pexels.com/photos/14870714/pexels-photo-14870714.jpeg?auto=compress&cs=tinysrgb&w=900", label: "Workshop Series", tag: "Bulk", span: "" },
  { id: "f4", src: "https://images.pexels.com/photos/34117503/pexels-photo-34117503.jpeg?auto=compress&cs=tinysrgb&w=900", label: "Press Day 04", tag: "Store", span: "lg:col-span-2" },
  { id: "f5", src: "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=900&q=80", label: "Band Merch Drop", tag: "Screen Print", span: "" },
  { id: "f6", src: "https://images.unsplash.com/photo-1554568218-0f1715e72254?w=900&q=80", label: "Cafe Co-Op", tag: "DTF", span: "" },
];

let cache = null;

// Loads the public gallery managed from the DanesPOS dashboard (Galeri Website menu).
// Returns [] while loading (no flash of placeholder content); falls back to stock photos only if the API fails.
export const useGallery = () => {
  const [items, setItems] = useState(cache || []);

  useEffect(() => {
    if (cache) return;
    let alive = true;
    fetch(`${BACKEND_URL}/api/public/gallery`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        if (!alive) return;
        if (Array.isArray(data) && data.length > 0) {
          cache = data;
          setItems(data);
        } else {
          setItems(GALLERY_FALLBACKS);
        }
      })
      .catch(() => alive && setItems(GALLERY_FALLBACKS));
    return () => { alive = false; };
  }, []);

  return items;
};
