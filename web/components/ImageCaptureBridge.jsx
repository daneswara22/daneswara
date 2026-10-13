'use client';
/**
 * ImageCaptureBridge — satu komponen global yang menambahkan opsi
 * "Ambil Foto / Kamera" ke SEMUA field upload gambar di seluruh aplikasi
 * (admin, produk, logo, desain, galeri, shop, dll) tanpa mengubah markup atau
 * handler upload yang sudah ada.
 *
 * Cara kerja (minim perubahan, universal):
 *   1. Mencegat klik pada <input type="file"> yang accept-nya mengandung
 *      "image" (termasuk klik programatik lewat ref.current.click()).
 *   2. Menampilkan pemilih kecil: "Pilih File / Galeri" atau "Ambil Foto / Kamera".
 *   3. Pilih File  -> membuka dialog file bawaan seperti biasa (di HP tetap
 *      menampilkan galeri/kamera bawaan sistem).
 *      Ambil Foto   -> membuka kamera perangkat (getUserMedia). Di HP memakai
 *      kamera belakang (environment) dan bisa ganti ke depan; di PC memakai
 *      kamera yang tersedia & diizinkan pengguna. Foto hasil jepretan
 *      disuntikkan kembali ke input yang sama (DataTransfer + event change),
 *      sehingga validasi, preview, kompresi (sharp->WebP di server), dan
 *      penyimpanan yang sudah ada tetap berjalan apa adanya.
 *   4. Bila kamera tidak tersedia / izin ditolak, otomatis jatuh ke dialog file
 *      biasa agar pengguna tetap bisa memilih gambar.
 *
 * Tidak mengubah layout maupun logika bisnis lain: hanya menambah lapisan
 * pemilih sumber gambar di atas input yang sudah ada.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Image as ImageIcon, X, RefreshCw, Loader2 } from 'lucide-react';

const Z = 2147483000;

function isImageFileInput(el) {
  if (!el || el.tagName !== 'INPUT' || el.type !== 'file') return false;
  const accept = (el.getAttribute('accept') || '').toLowerCase();
  return accept.includes('image');
}

export default function ImageCaptureBridge() {
  // Input yang sedang menunggu sumber gambar dipilih.
  const pendingRef = useRef(null);
  // Input yang sengaja diizinkan membuka dialog file bawaan (sekali pakai).
  const allowNativeRef = useRef(null);

  const [chooserOpen, setChooserOpen] = useState(false);
  const [camOpen, setCamOpen] = useState(false);
  const [camLoading, setCamLoading] = useState(false);
  const [facing, setFacing] = useState('environment');
  const [canSwitch, setCanSwitch] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const stopStream = useCallback(() => {
    const s = streamRef.current;
    if (s) {
      try {
        s.getTracks().forEach((t) => t.stop());
      } catch {
        /* abaikan */
      }
      streamRef.current = null;
    }
  }, []);

  // Buka dialog file bawaan untuk input yang tertunda.
  const openNativeFile = useCallback(() => {
    const input = pendingRef.current;
    if (!input) return;
    allowNativeRef.current = input;
    input.click();
  }, []);

  // --- Pencegat klik global untuk semua input gambar --------------------------
  useEffect(() => {
    const onClick = (e) => {
      const el = e.target;
      if (!isImageFileInput(el)) return;
      // Klik yang memang kita izinkan untuk membuka dialog bawaan.
      if (allowNativeRef.current === el) {
        allowNativeRef.current = null;
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      pendingRef.current = el;
      setChooserOpen(true);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // --- Mulai kamera -----------------------------------------------------------
  const startCamera = useCallback(
    async (mode) => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        return false;
      }
      setCamLoading(true);
      stopStream();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: mode } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        // Deteksi apakah ada lebih dari satu kamera untuk tombol "Ganti".
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          setCanSwitch(devices.filter((d) => d.kind === 'videoinput').length > 1);
        } catch {
          setCanSwitch(false);
        }
        setCamLoading(false);
        return true;
      } catch {
        setCamLoading(false);
        return false;
      }
    },
    [stopStream],
  );

  const handleChooseCamera = useCallback(async () => {
    setChooserOpen(false);
    setCamOpen(true);
    const ok = await startCamera(facing);
    if (!ok) {
      // Kamera tidak tersedia / ditolak -> tetap bisa pilih file.
      setCamOpen(false);
      openNativeFile();
    }
  }, [startCamera, facing, openNativeFile]);

  const handleChooseFile = useCallback(() => {
    setChooserOpen(false);
    openNativeFile();
  }, [openNativeFile]);

  const switchCamera = useCallback(async () => {
    const next = facing === 'environment' ? 'user' : 'environment';
    setFacing(next);
    await startCamera(next);
  }, [facing, startCamera]);

  const closeCamera = useCallback(() => {
    stopStream();
    setCamOpen(false);
  }, [stopStream]);

  // Suntikkan file hasil jepretan ke input yang tertunda, lalu picu change.
  const injectFile = useCallback((file) => {
    const input = pendingRef.current;
    if (!input || !file) return;
    try {
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } catch {
      /* fallback: tidak ada DataTransfer -> biarkan pengguna pilih file */
    }
  }, []);

  const takePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `kamera-${Date.now()}.jpg`, { type: 'image/jpeg' });
          injectFile(file);
        }
        closeCamera();
      },
      'image/jpeg',
      0.92,
    );
  }, [injectFile, closeCamera]);

  useEffect(() => () => stopStream(), [stopStream]);

  if (!chooserOpen && !camOpen) return null;

  const backdrop = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: Z,
    padding: 16,
  };

  return (
    <>
      {chooserOpen && (
        <div
          style={backdrop}
          onClick={() => {
            setChooserOpen(false);
            pendingRef.current = null;
          }}
          data-testid="imgsrc-backdrop"
        >
          <div
            style={{
              width: '100%',
              maxWidth: 340,
              background: '#fff',
              color: '#111',
              borderRadius: 16,
              padding: 18,
              boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}
            >
              <strong style={{ fontSize: 15 }}>Pilih sumber gambar</strong>
              <button
                type="button"
                aria-label="Tutup"
                onClick={() => {
                  setChooserOpen(false);
                  pendingRef.current = null;
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555' }}
                data-testid="imgsrc-close"
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <button
                type="button"
                onClick={handleChooseFile}
                data-testid="imgsrc-file"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1px solid #e5e7eb',
                  background: '#f9fafb',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#111',
                }}
              >
                <ImageIcon size={20} color="#ea580c" />
                Pilih File / Galeri
              </button>
              <button
                type="button"
                onClick={handleChooseCamera}
                data-testid="imgsrc-camera"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1px solid #e5e7eb',
                  background: '#f9fafb',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#111',
                }}
              >
                <Camera size={20} color="#ea580c" />
                Ambil Foto / Kamera
              </button>
            </div>
          </div>
        </div>
      )}

      {camOpen && (
        <div style={{ ...backdrop, flexDirection: 'column' }} data-testid="camera-overlay">
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 520,
              background: '#000',
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
            }}
          >
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              style={{ display: 'block', width: '100%', maxHeight: '70vh', background: '#000' }}
              data-testid="camera-video"
            />
            {camLoading && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  gap: 8,
                  fontSize: 13,
                }}
              >
                <Loader2 size={18} className="animate-spin" /> Menyiapkan kamera...
              </div>
            )}
            <button
              type="button"
              aria-label="Tutup kamera"
              onClick={closeCamera}
              data-testid="camera-close"
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                background: 'rgba(0,0,0,0.5)',
                color: '#fff',
                border: 'none',
                borderRadius: 999,
                width: 36,
                height: 36,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} />
            </button>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              marginTop: 18,
            }}
          >
            {canSwitch && (
              <button
                type="button"
                onClick={switchCamera}
                data-testid="camera-switch"
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.4)',
                  borderRadius: 999,
                  width: 52,
                  height: 52,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-label="Ganti kamera"
              >
                <RefreshCw size={20} />
              </button>
            )}
            <button
              type="button"
              onClick={takePhoto}
              disabled={camLoading}
              data-testid="camera-capture"
              style={{
                background: '#ea580c',
                color: '#fff',
                border: '4px solid #fff',
                borderRadius: 999,
                width: 72,
                height: 72,
                cursor: camLoading ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: camLoading ? 0.6 : 1,
              }}
              aria-label="Ambil foto"
            >
              <Camera size={28} />
            </button>
            <button
              type="button"
              onClick={() => {
                closeCamera();
                openNativeFile();
              }}
              data-testid="camera-usefile"
              style={{
                background: 'rgba(255,255,255,0.15)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.4)',
                borderRadius: 999,
                width: 52,
                height: 52,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Pakai file"
            >
              <ImageIcon size={20} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
