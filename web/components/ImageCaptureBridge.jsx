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
 *   2. Menampilkan pemilih sumber: "Pilih File / Galeri" atau "Ambil Foto / Kamera".
 *   3. Pilih File  -> membuka dialog file bawaan seperti biasa.
 *      Ambil Foto   -> membuka kamera perangkat (getUserMedia): preview langsung,
 *      tombol Ambil Foto, lalu layar tinjau dengan Ulangi / Gunakan Foto. Foto
 *      disuntikkan kembali ke input yang sama (DataTransfer + event change) sehingga
 *      validasi, preview, kompresi (sharp->WebP di server) & penyimpanan tetap jalan.
 *   4. Bila kamera tak tersedia / izin ditolak / bukan HTTPS, tampilkan pesan jelas
 *      dan sediakan fallback Pilih File/Galeri.
 *
 * CATATAN PERBAIKAN: stream kamera dimulai di useEffect (SETELAH elemen <video>
 * ter-mount), bukan segera setelah setState, agar srcObject benar-benar terpasang
 * dan preview muncul. Sebelumnya videoRef masih null saat start -> "tidak terjadi apa-apa".
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Image as ImageIcon, X, RefreshCw, Loader2, RotateCcw, Check } from 'lucide-react';

const Z = 2147483000;

function isImageFileInput(el) {
  if (!el || el.tagName !== 'INPUT' || el.type !== 'file') return false;
  const accept = (el.getAttribute('accept') || '').toLowerCase();
  return accept.includes('image');
}

function mapCameraError(err) {
  const name = err && (err.name || err.code);
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return 'Izin kamera ditolak. Aktifkan izin kamera di peramban, atau gunakan Pilih File / Galeri.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
    return 'Kamera tidak ditemukan di perangkat ini. Silakan gunakan Pilih File / Galeri.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
    return 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.';
  }
  return 'Tidak dapat mengakses kamera. Silakan gunakan Pilih File / Galeri.';
}

export default function ImageCaptureBridge() {
  const pendingRef = useRef(null); // input yang menunggu sumber gambar
  const allowNativeRef = useRef(null); // input yang diizinkan buka dialog file (sekali pakai)

  const [chooserOpen, setChooserOpen] = useState(false);
  const [camOpen, setCamOpen] = useState(false);
  const [mode, setMode] = useState('live'); // 'live' | 'review'
  const [loading, setLoading] = useState(false);
  const [camError, setCamError] = useState(null);
  const [facing, setFacing] = useState('environment');
  const [canSwitch, setCanSwitch] = useState(false);
  const [capturedUrl, setCapturedUrl] = useState(null);
  const [attempt, setAttempt] = useState(0);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const capturedFileRef = useRef(null);

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
    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
      } catch {
        /* abaikan */
      }
    }
  }, []);

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
      if (allowNativeRef.current === el) {
        allowNativeRef.current = null; // klik yang memang kita izinkan
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

  // --- Mulai stream kamera SETELAH <video> ter-mount --------------------------
  useEffect(() => {
    if (!camOpen || mode !== 'live') return undefined;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setCamError(null);
      stopStream();

      if (typeof window !== 'undefined' && window.isSecureContext === false) {
        setCamError('Kamera hanya bisa diakses lewat koneksi aman (HTTPS). Silakan gunakan Pilih File / Galeri.');
        setLoading(false);
        return;
      }
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setCamError('Peramban/perangkat ini tidak mendukung kamera. Silakan gunakan Pilih File / Galeri.');
        setLoading(false);
        return;
      }

      try {
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: facing } },
            audio: false,
          });
        } catch (err) {
          // Fallback: lepas constraint facingMode (mis. OverconstrainedError di PC)
          if (err && (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError')) {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          } else {
            throw err;
          }
        }

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
        }
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          setCanSwitch(devices.filter((d) => d.kind === 'videoinput').length > 1);
        } catch {
          setCanSwitch(false);
        }
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setCamError(mapCameraError(err));
          setLoading(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [camOpen, facing, mode, attempt, stopStream]);

  // Bersihkan stream saat komponen unmount.
  useEffect(() => () => stopStream(), [stopStream]);

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
      /* jika DataTransfer tak tersedia, pengguna masih bisa pakai Pilih File */
    }
  }, []);

  const closeAll = useCallback(() => {
    stopStream();
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl(null);
    capturedFileRef.current = null;
    setCamError(null);
    setMode('live');
    setLoading(false);
    setCamOpen(false);
  }, [stopStream, capturedUrl]);

  const handleChooseFile = useCallback(() => {
    setChooserOpen(false);
    openNativeFile();
  }, [openNativeFile]);

  const handleChooseCamera = useCallback(() => {
    setChooserOpen(false);
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl(null);
    capturedFileRef.current = null;
    setCamError(null);
    setMode('live');
    setCamOpen(true); // stream dimulai oleh useEffect setelah <video> mount
  }, [capturedUrl]);

  const takePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        capturedFileRef.current = new File([blob], `kamera-${Date.now()}.jpg`, { type: 'image/jpeg' });
        if (capturedUrl) URL.revokeObjectURL(capturedUrl);
        setCapturedUrl(URL.createObjectURL(blob));
        stopStream(); // bekukan: hentikan live saat meninjau
        setMode('review');
      },
      'image/jpeg',
      0.92,
    );
  }, [capturedUrl, stopStream]);

  const retake = useCallback(() => {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl(null);
    capturedFileRef.current = null;
    setMode('live'); // useEffect menyalakan ulang stream
  }, [capturedUrl]);

  const usePhoto = useCallback(() => {
    injectFile(capturedFileRef.current);
    closeAll();
  }, [injectFile, closeAll]);

  const switchCamera = useCallback(() => {
    setFacing((f) => (f === 'environment' ? 'user' : 'environment'));
  }, []);

  const retry = useCallback(() => {
    setCamError(null);
    setAttempt((a) => a + 1);
  }, []);

  const fallbackToFile = useCallback(() => {
    closeAll();
    openNativeFile();
  }, [closeAll, openNativeFile]);

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
  const pill = {
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
  };
  const sourceBtn = {
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
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}
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
              <button type="button" onClick={handleChooseFile} data-testid="imgsrc-file" style={sourceBtn}>
                <ImageIcon size={20} color="#ea580c" />
                Pilih File / Galeri
              </button>
              <button type="button" onClick={handleChooseCamera} data-testid="imgsrc-camera" style={sourceBtn}>
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
            {/* Preview langsung / foto hasil tinjauan / pesan error */}
            {camError ? (
              <div
                style={{
                  minHeight: 240,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 14,
                  padding: 24,
                  textAlign: 'center',
                  color: '#fff',
                }}
                data-testid="camera-error"
              >
                <Camera size={34} color="#f59e0b" />
                <div style={{ fontSize: 13, lineHeight: 1.5, maxWidth: 360 }}>{camError}</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={fallbackToFile}
                    data-testid="camera-error-file"
                    style={{
                      background: '#ea580c',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 10,
                      padding: '10px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Pilih File / Galeri
                  </button>
                  <button
                    type="button"
                    onClick={retry}
                    data-testid="camera-error-retry"
                    style={{
                      background: 'rgba(255,255,255,0.15)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.4)',
                      borderRadius: 10,
                      padding: '10px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Coba Lagi
                  </button>
                </div>
              </div>
            ) : mode === 'review' && capturedUrl ? (
              <img
                src={capturedUrl}
                alt="Pratinjau foto"
                style={{ display: 'block', width: '100%', maxHeight: '70vh', objectFit: 'contain', background: '#000' }}
                data-testid="camera-preview-image"
              />
            ) : (
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                style={{ display: 'block', width: '100%', maxHeight: '70vh', background: '#000' }}
                data-testid="camera-video"
              />
            )}

            {loading && !camError && (
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
                  pointerEvents: 'none',
                }}
              >
                <Loader2 size={18} className="animate-spin" /> Menyiapkan kamera...
              </div>
            )}

            <button
              type="button"
              aria-label="Tutup kamera"
              onClick={closeAll}
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

          {/* Kontrol */}
          {!camError && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 18 }}>
              {mode === 'live' ? (
                <>
                  {canSwitch && (
                    <button type="button" onClick={switchCamera} data-testid="camera-switch" style={pill} aria-label="Ganti kamera">
                      <RefreshCw size={20} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={takePhoto}
                    disabled={loading}
                    data-testid="camera-capture"
                    style={{
                      background: '#ea580c',
                      color: '#fff',
                      border: '4px solid #fff',
                      borderRadius: 999,
                      width: 72,
                      height: 72,
                      cursor: loading ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: loading ? 0.6 : 1,
                    }}
                    aria-label="Ambil foto"
                  >
                    <Camera size={28} />
                  </button>
                  <button type="button" onClick={fallbackToFile} data-testid="camera-usefile" style={pill} aria-label="Pakai file">
                    <ImageIcon size={20} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={retake}
                    data-testid="camera-retake"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: 'rgba(255,255,255,0.15)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.4)',
                      borderRadius: 12,
                      padding: '12px 18px',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <RotateCcw size={18} /> Ulangi
                  </button>
                  <button
                    type="button"
                    onClick={usePhoto}
                    data-testid="camera-usephoto"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: '#ea580c',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 12,
                      padding: '12px 20px',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <Check size={18} /> Gunakan Foto
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
