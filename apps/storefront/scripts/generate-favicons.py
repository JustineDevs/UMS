"""
Generate favicon + PWA icon sizes from the Universal Music Store transparent mark.

Sizing follows common UI/UX + PWA guidance:
- 16, 32, 48: browser favicons
- 180: apple-touch-icon
- 192, 512: Android / manifest

Run from repo root:
python apps/storefront/scripts/generate-favicons.py

Requirements:
Python 3.11+ and Pillow (`python -m pip install pillow`)
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image


SCRIPT = Path(__file__).resolve()
STOREFRONT = SCRIPT.parents[1]
REPO_ROOT = SCRIPT.parents[3]

DEFAULT_SRC = REPO_ROOT / "public" / "UVS" / "UVS_Logo(transparent).png"
OUT_DIR = STOREFRONT / "public" / "icons"

SIZES = {
    "favicon-16x16.png": 16,
    "favicon-32x32.png": 32,
    "favicon-48x48.png": 48,
    "apple-touch-icon.png": 180,
    "android-chrome-192x192.png": 192,
    "android-chrome-512x512.png": 512,
}


def flatten_on_white(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    background = Image.new("RGB", image.size, (255, 255, 255))
    background.paste(image, mask=image.split()[3])
    return background


def contain_square(image: Image.Image, size: int, *, pad_ratio: float = 0.12) -> Image.Image:
    """Fit the image inside a square canvas with padding for small favicon legibility."""
    width, height = image.size
    pad = max(1, int(round(size * pad_ratio)))
    inner = size - 2 * pad
    scale = min(inner / width, inner / height)
    next_width = max(1, int(round(width * scale)))
    next_height = max(1, int(round(height * scale)))
    resized = image.resize((next_width, next_height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (size, size), (255, 255, 255))
    canvas.paste(resized, ((size - next_width) // 2, (size - next_height) // 2))
    return canvas


def main() -> int:
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SRC
    if not source.is_file():
        print(f"Missing source: {source}", file=sys.stderr)
        return 1

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    flattened = flatten_on_white(Image.open(source))

    for name, dimension in SIZES.items():
        pad = 0.18 if dimension <= 16 else 0.14 if dimension <= 32 else 0.12
        icon = contain_square(flattened, dimension, pad_ratio=pad)
        destination = OUT_DIR / name
        icon.save(destination, "PNG", optimize=True)
        print(f"Wrote {destination.relative_to(STOREFRONT)} ({dimension}x{dimension})")

    ico_source = flattened.resize((48, 48), Image.Resampling.LANCZOS)
    ico_destination = STOREFRONT / "public" / "favicon.ico"
    ico_destination.parent.mkdir(parents=True, exist_ok=True)
    ico_source.save(
        ico_destination,
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )
    print(f"Wrote {ico_destination.relative_to(STOREFRONT)} (16x16, 32x32, 48x48)")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
