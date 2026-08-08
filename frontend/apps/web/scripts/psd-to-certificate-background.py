#!/usr/bin/env python3
"""
Turn a layered certificate PSD into a Certificate Studio background + starter stub.

What it does:
  1. Hides the placeholder text/logo layer groups.
  2. Flattens the rest to an optimized JPG in public/certificates/backgrounds/.
  3. Prints the detected text-layer positions (converted to millimetres) plus a
     ready-to-paste TypeScript starter stub, so you can lay your own {{variable}}
     text over the artwork's empty zones.

Requirements (one-time):
    pip install "psd-tools[composite]" pillow

Usage:
    python scripts/psd-to-certificate-background.py "path/to/cert.psd" --name elegant-dark-golden
    # optional: --hide "Text,Logo,Watermark"  --dpi 300  --quality 88

Licensing: only use artwork you are licensed to embed in this product. Free
"attribution / no-resale" stock (e.g. GraphicsFamily) is NOT safe to ship in a
paid template gallery — prefer Envato Elements / Freepik Premium or original art.
"""

from __future__ import annotations

import argparse
import os
import re
import sys

MM_PER_INCH = 25.4


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "certificate-background"


def main() -> int:
    parser = argparse.ArgumentParser(description="PSD → certificate background + starter stub")
    parser.add_argument("psd", help="Path to the source .psd file")
    parser.add_argument("--name", help="Output slug (default: derived from filename)")
    parser.add_argument(
        "--hide",
        default="Text,Logo",
        help='Comma-separated layer/group names to hide (default: "Text,Logo")',
    )
    parser.add_argument("--dpi", type=int, default=300, help="Artwork DPI (default 300)")
    parser.add_argument("--quality", type=int, default=88, help="JPG quality (default 88)")
    parser.add_argument(
        "--out",
        default=None,
        help="Output dir (default: <repo>/public/certificates/backgrounds)",
    )
    args = parser.parse_args()

    try:
        from psd_tools import PSDImage
    except ImportError:
        print('ERROR: pip install "psd-tools[composite]" pillow', file=sys.stderr)
        return 1

    if not os.path.isfile(args.psd):
        print(f"ERROR: not found: {args.psd}", file=sys.stderr)
        return 1

    name = slugify(args.name) if args.name else slugify(os.path.splitext(os.path.basename(args.psd))[0])
    hide = {n.strip().lower() for n in args.hide.split(",") if n.strip()}

    web_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    out_dir = args.out or os.path.join(web_root, "public", "certificates", "backgrounds")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"{name}.jpg")
    public_path = f"/certificates/backgrounds/{name}.jpg"

    psd = PSDImage.open(args.psd)
    px_to_mm = MM_PER_INCH / args.dpi
    page_w_mm = round(psd.width * px_to_mm, 1)
    page_h_mm = round(psd.height * px_to_mm, 1)
    orientation = "landscape" if psd.width >= psd.height else "portrait"

    # Collect text layers (for placement hints) and hide requested groups.
    text_hints: list[str] = []
    for layer in psd.descendants():
        if layer.name.strip().lower() in hide:
            layer.visible = False
        if getattr(layer, "kind", "") == "type":
            try:
                bbox = layer.bbox  # (left, top, right, bottom) in px
                x, y = round(bbox[0] * px_to_mm, 1), round(bbox[1] * px_to_mm, 1)
                w, h = round((bbox[2] - bbox[0]) * px_to_mm, 1), round((bbox[3] - bbox[1]) * px_to_mm, 1)
                txt = (layer.text or "").replace("\n", " ")[:40]
                text_hints.append(f"//   x:{x} y:{y} w:{w} h:{h}  <- {txt!r}")
            except Exception:
                pass

    composite = psd.composite(force=True).convert("RGB")
    composite.save(out_path, "JPEG", quality=args.quality, optimize=True, progressive=True)
    size_kb = round(os.path.getsize(out_path) / 1024, 1)

    print(f"\n[OK] {out_path}  ({psd.width}x{psd.height}px, {size_kb} KB)")
    print(f"     public path: {public_path}")
    print(f"     page: {page_w_mm} x {page_h_mm} mm ({orientation})\n")

    print("// ---- starter stub for starter-templates-imagebg.ts ----")
    print("// Original placeholder text positions (mm) — lay your variable text here:")
    for hint in text_hints:
        print(hint)
    print(
        f"""{{
  id: "{name}",
  name: "{name.replace('-', ' ').title()}",
  description: "TODO description.",
  homeFeatured: false,
  previewKind: "gold",
  category: "excellence",
  document: {{
    schemaVersion: 1,
    page: {{ width: {page_w_mm}, height: {page_h_mm}, unit: "mm", orientation: "{orientation}", safeMm: 10 }},
    background: {{ type: "image", value: "{public_path}" }},
    brandKitRef: null,
    variables: VARS,
    rules: [],
    elements: [
      // TODO: add text/qr/signature elements over the empty zones (see hints above).
    ],
  }},
}},"""
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
