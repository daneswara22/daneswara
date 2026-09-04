import html2canvas from "html2canvas";

// Wait until every <img> inside the node is fully loaded/decoded (or times out),
// so html2canvas never captures a half-loaded logo. This is the main cause of
// the intermittent "Gagal membuat gambar" failures.
async function waitForImages(node, timeout = 5000) {
  const imgs = Array.from(node.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) {
        return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
      }
      return new Promise((resolve) => {
        const done = () => resolve();
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
        setTimeout(done, timeout);
      });
    })
  );
}

// Capture a DOM node to a PNG Blob reliably, with font/image preloading and retries.
export async function captureToBlob(node, { backgroundColor = "#15171c", scale = 2 } = {}) {
  if (!node) throw new Error("no node");
  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch (e) {}
  }
  await waitForImages(node);
  // Let layout settle for two frames before snapshotting.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const canvas = await html2canvas(node, {
        scale,
        useCORS: true,
        backgroundColor,
        logging: false,
        imageTimeout: 8000,
        allowTaint: false,
        removeContainer: true,
      });
      const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
      if (blob && blob.size > 0) return blob;
      // Fallback: toBlob can return null in some browsers — use dataURL instead.
      const dataUrl = canvas.toDataURL("image/png");
      const resp = await fetch(dataUrl);
      const fb = await resp.blob();
      if (fb && fb.size > 0) return fb;
      throw new Error("empty canvas");
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 350));
    }
  }
  throw lastErr || new Error("capture failed");
}

// Share (mobile) or download (desktop) a PNG blob. Returns the action taken.
export async function shareOrDownload(blob, filename, { title = "", text = "" } = {}) {
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text });
      return "shared";
    } catch (err) {
      if (err && err.name === "AbortError") return "cancelled";
      // fall through to download on share failure
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}
