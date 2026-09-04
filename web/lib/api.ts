'use client';
import axios from 'axios';

// Same-origin: Next.js API routes at /api/*
const API = '/api';
const api = axios.create({ baseURL: API, withCredentials: true });

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('pos_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const formatApiError = (detail: any): string => {
  if (detail == null) return 'Terjadi kesalahan. Coba lagi.';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((e) => (e && e.msg ? e.msg : JSON.stringify(e))).join(' ');
  if (detail && detail.msg) return detail.msg;
  return String(detail);
};

export const rupiah = (n: any) => 'Rp' + Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 });

export const uploadImage = async (file: File, kind = 'misc') => {
  const fd = new FormData();
  fd.append('file', file);
  const { data } = await api.post(`/upload?kind=${encodeURIComponent(kind)}`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const BACKEND_URL = '';
export default api;
