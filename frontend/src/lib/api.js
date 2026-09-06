import axios from "axios";

// In production the frontend is served by nginx which proxies /api -> backend,
// so REACT_APP_BACKEND_URL may be empty (relative URLs). In dev/preview it is the full origin.
export const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "");
const API = `${BACKEND_URL}/api`;

const api = axios.create({ baseURL: API, withCredentials: true });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("pos_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const formatApiError = (detail) => {
  if (detail == null) return "Terjadi kesalahan. Coba lagi.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return (detail || []).map((e) => (e && e.msg ? e.msg : JSON.stringify(e))).join(" ");
  if (detail && detail.msg) return detail.msg;
  return String(detail);
};

export const rupiah = (n) =>
  "Rp" + Number(n || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });

/**
 * Upload an image file. The backend converts it to WebP and stores it on Cloudflare R2
 * (or local disk fallback). kind: gallery | product | category | logo | misc
 * Resolves to { url, key, width, height, bytes, backend }
 */
export const uploadImage = async (file, kind = "misc") => {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await api.post(`/upload?kind=${encodeURIComponent(kind)}`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export default api;
