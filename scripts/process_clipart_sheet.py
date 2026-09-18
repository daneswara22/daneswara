#!/usr/bin/env python3
"""
Clip-Art Sheet Processor
------------------------
Segments ONE sheet image (many clip arts on a light background) into individual
transparent PNGs. Preserves the original artwork exactly (no recolour / rescale
distortion). Produces: full crops, thumbnails, and a metadata manifest.

Usage:
  python3 process_clipart_sheet.py <sheet_path> <out_dir> [--dilate N] [--minarea A]
                                   [--start-index K] [--append]
Outputs (in <out_dir>):
  clipart-XXX.png            tight transparent crop
  thumbs/clipart-XXX.png     thumbnail (<=THUMB px)
  _montage.png               contact sheet for visual verification
  assets.json                list of asset metadata (this run)
"""
import sys, os, json, argparse
import numpy as np
from PIL import Image
from scipy import ndimage

PAD = 10          # transparent padding around each crop (px)
THUMB = 200       # thumbnail max dimension


def build_foreground(rgba):
    """Return boolean foreground mask (True = artwork) via border flood fill."""
    arr = np.asarray(rgba)
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    near_white = (r >= 244) & (g >= 244) & (b >= 244)
    transparent = a < 16
    bg_candidate = near_white | transparent

    # label background candidate regions; any region touching the border == real background
    lbl, n = ndimage.label(bg_candidate)
    border_labels = set(np.unique(np.concatenate([
        lbl[0, :], lbl[-1, :], lbl[:, 0], lbl[:, -1]
    ])))
    border_labels.discard(0)
    background = np.isin(lbl, list(border_labels))
    fg = ~background
    # drop pixels that are actually transparent in source
    fg &= (a >= 16)
    # clean tiny speckles
    fg = ndimage.binary_opening(fg, structure=np.ones((2, 2)))
    return fg, arr


def group_components(fg, dilate, minarea):
    """Dilate to merge parts of the same artwork, label, return bboxes (row-major)."""
    struct = ndimage.generate_binary_structure(2, 2)
    grown = ndimage.binary_dilation(fg, structure=struct, iterations=dilate)
    lbl, n = ndimage.label(grown, structure=struct)
    boxes = []
    slices = ndimage.find_objects(lbl)
    for i, sl in enumerate(slices, start=1):
        if sl is None:
            continue
        ys, xs = sl
        # true area within this group using ORIGINAL fg
        region_fg = fg[ys, xs] & (lbl[ys, xs] == i)
        area = int(region_fg.sum())
        if area < minarea:
            continue
        boxes.append((ys.start, ys.stop, xs.start, xs.stop, i))
    return boxes, lbl


def row_major_sort(boxes):
    if not boxes:
        return boxes
    heights = [(y1 - y0) for y0, y1, x0, x1, _ in boxes]
    med_h = np.median(heights)
    row_gap = med_h * 0.6
    # sort by vertical center first
    boxes_c = sorted(boxes, key=lambda b: (b[0] + b[1]) / 2)
    rows, cur, last_cy = [], [], None
    for b in boxes_c:
        cy = (b[0] + b[1]) / 2
        if last_cy is None or abs(cy - last_cy) <= row_gap:
            cur.append(b)
        else:
            rows.append(cur); cur = [b]
        last_cy = cy if last_cy is None else (last_cy + cy) / 2
    if cur:
        rows.append(cur)
    ordered = []
    for row in rows:
        ordered.extend(sorted(row, key=lambda b: (b[2] + b[3]) / 2))
    return ordered


def crop_asset(arr, fg, lbl, box):
    y0, y1, x0, x1, comp = box
    sub = arr[y0:y1, x0:x1].copy()
    submask = fg[y0:y1, x0:x1] & (lbl[y0:y1, x0:x1] == comp)
    # apply alpha: transparent where not foreground of THIS component
    sub[..., 3] = np.where(submask, sub[..., 3], 0).astype(np.uint8)
    # tighten to actual content bbox
    ys, xs = np.where(submask)
    if len(ys) == 0:
        return None
    ty0, ty1 = ys.min(), ys.max() + 1
    tx0, tx1 = xs.min(), xs.max() + 1
    sub = sub[ty0:ty1, tx0:tx1]
    img = Image.fromarray(sub, "RGBA")
    # pad transparent
    w, h = img.size
    canvas = Image.new("RGBA", (w + 2 * PAD, h + 2 * PAD), (0, 0, 0, 0))
    canvas.paste(img, (PAD, PAD), img)
    return canvas


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sheet")
    ap.add_argument("out")
    ap.add_argument("--dilate", type=int, default=6)
    ap.add_argument("--minarea", type=int, default=700)
    ap.add_argument("--start-index", type=int, default=1)
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    os.makedirs(os.path.join(args.out, "thumbs"), exist_ok=True)

    rgba = Image.open(args.sheet).convert("RGBA")
    fg, arr = build_foreground(rgba)
    boxes, lbl = group_components(fg, args.dilate, args.minarea)
    boxes = row_major_sort(boxes)
    print(f"Detected {len(boxes)} assets (dilate={args.dilate}, minarea={args.minarea})")

    assets = []
    thumbs = []
    idx = args.start_index
    for box in boxes:
        img = crop_asset(arr, fg, lbl, box)
        if img is None:
            continue
        aid = f"clipart-{idx:03d}"
        fn = f"{aid}.png"
        img.save(os.path.join(args.out, fn))
        # thumbnail
        t = img.copy()
        t.thumbnail((THUMB, THUMB), Image.LANCZOS)
        t.save(os.path.join(args.out, "thumbs", fn))
        w, h = img.size
        assets.append({
            "id": aid,
            "filename": fn,
            "url": f"/cliparts/{fn}",
            "thumb": f"/cliparts/thumbs/{fn}",
            "width": w,
            "height": h,
            "aspectRatio": round(w / h, 3),
        })
        thumbs.append(t)
        idx += 1

    with open(os.path.join(args.out, "assets.json"), "w") as f:
        json.dump(assets, f, indent=2)

    # montage for verification
    if thumbs:
        cols = 10
        cell = THUMB + 12
        rows = (len(thumbs) + cols - 1) // cols
        mont = Image.new("RGBA", (cols * cell, rows * cell), (235, 235, 235, 255))
        from PIL import ImageDraw
        d = ImageDraw.Draw(mont)
        for i, t in enumerate(thumbs):
            cx = (i % cols) * cell + 6
            cy = (i // cols) * cell + 6
            mont.paste(t, (cx, cy), t)
            d.text((cx, cy), f"{i+args.start_index:03d}", fill=(200, 0, 0, 255))
        mont.convert("RGB").save(os.path.join(args.out, "_montage.png"))
    print("Wrote", len(assets), "assets to", args.out)


if __name__ == "__main__":
    main()
