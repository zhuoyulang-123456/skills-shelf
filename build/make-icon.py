#!/usr/bin/env python3
"""Generate the Skills Shelf app icon (1024 PNG + .icns + .ico).

Run from the project root:
    python3 build/make-icon.py
    iconutil -c icns build/icon.iconset -o build/icon.icns
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SIZE = 1024
SS = 2
W = SIZE * SS
OUT = Path(__file__).resolve().parent

INK_TOP = (46, 44, 39)
INK_BOTTOM = (18, 17, 15)
IVORY_TOP = (247, 245, 238, 255)
IVORY_BOTTOM = (226, 222, 211, 255)
CORAL_TOP = (225, 126, 99, 255)
CORAL_BOTTOM = (192, 84, 60, 255)


def squircle_mask(size: int, inset: int, n: float = 5.0) -> Image.Image:
    half = (size - inset * 2) / 2
    c = size / 2
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    inside = (np.abs((xx - c) / half) ** n + np.abs((yy - c) / half) ** n) <= 1.0
    return Image.fromarray(np.where(inside, 255, 0).astype(np.uint8), "L")


def vertical_gradient(size: int, top: tuple, bottom: tuple) -> Image.Image:
    t = np.linspace(0, 1, size)[:, None]
    arr = np.zeros((size, 1, 4), dtype=np.uint8)
    for i in range(3):
        arr[:, 0, i] = (top[i] * (1 - t[:, 0]) + bottom[i] * t[:, 0]).astype(np.uint8)
    arr[:, 0, 3] = 255
    return Image.fromarray(arr, "RGBA").resize((size, size), Image.NEAREST)


def radial_glow(size: int, center: tuple, radius: float, color: tuple, strength: float) -> Image.Image:
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    d = np.sqrt((xx - center[0]) ** 2 + (yy - center[1]) ** 2) / radius
    a = np.clip(1 - d, 0, 1) ** 2 * strength
    arr = np.zeros((size, size, 4), dtype=np.uint8)
    arr[..., 0], arr[..., 1], arr[..., 2] = color
    arr[..., 3] = (a * 255).astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def card(size: tuple, top: tuple, bottom: tuple, radius: int) -> Image.Image:
    grad = vertical_gradient(size[1], top, bottom).resize(size, Image.NEAREST)
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    layer.paste(grad, (0, 0), mask)
    return layer


def main() -> None:
    inset = 100 * SS
    mask = squircle_mask(W, inset)

    bg = vertical_gradient(W, INK_TOP, INK_BOTTOM)
    bg = Image.alpha_composite(bg, radial_glow(W, (W * 0.30, W * 0.14), W * 0.62, (120, 114, 98), 0.26))
    rng = np.random.default_rng(11)
    grain = rng.normal(0, 3.2, (W // 4, W // 4, 1)).repeat(3, axis=2)
    grain = np.clip(grain, -8, 8).astype(np.int16)
    arr = np.asarray(bg).astype(np.int16)
    arr[..., :3] = np.clip(arr[..., :3] + np.repeat(np.repeat(grain, 4, axis=0), 4, axis=1), 0, 255)
    bg = Image.fromarray(arr.astype(np.uint8), "RGBA")

    canvas = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    canvas.paste(bg, (0, 0), mask)

    # Shelf
    bw, by = 572 * SS, 700 * SS
    bx = (W - bw) // 2
    bh = 16 * SS
    shadow = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (bx + 4 * SS, by + 10 * SS, bx + bw + 4 * SS, by + bh + 10 * SS),
        radius=8 * SS,
        fill=(0, 0, 0, 150),
    )
    canvas = Image.alpha_composite(canvas, shadow.filter(ImageFilter.GaussianBlur(8 * SS)))

    d = ImageDraw.Draw(canvas)
    d.rounded_rectangle((bx, by, bx + bw, by + bh), radius=8 * SS, fill=(58, 54, 46, 255))
    d.rounded_rectangle(
        (bx + 2 * SS, by + 2 * SS, bx + bw - 2 * SS, by + 4 * SS),
        radius=2 * SS,
        fill=(244, 242, 236, 55),
    )

    # Four skill volumes; one is picked out in coral.
    cw, gap = 118 * SS, 26 * SS
    heights = [276 * SS, 306 * SS, 254 * SS, 292 * SS]
    x = bx + (bw - (cw * 4 + gap * 3)) // 2
    for i, h in enumerate(heights):
        accent = i == 2
        cx = x + i * (cw + gap) + (10 * SS if accent else 0)
        cy = by - h - (8 * SS if accent else 0)
        sh = Image.new("RGBA", (W, W), (0, 0, 0, 0))
        ImageDraw.Draw(sh).rounded_rectangle(
            (cx + 4 * SS, cy + 14 * SS, cx + cw + 4 * SS, cy + h + 14 * SS),
            radius=30 * SS,
            fill=(0, 0, 0, 145 if accent else 90),
        )
        canvas = Image.alpha_composite(
            canvas, sh.filter(ImageFilter.GaussianBlur((18 if accent else 12) * SS))
        )
        canvas.alpha_composite(
            card(
                (cw, h),
                CORAL_TOP if accent else IVORY_TOP,
                CORAL_BOTTOM if accent else IVORY_BOTTOM,
                28 * SS,
            ),
            (cx, cy),
        )

    # Hairline rim
    rim = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    ImageDraw.Draw(rim).rounded_rectangle(
        (inset, inset, W - inset, W - inset),
        radius=185 * SS,
        outline=(255, 255, 255, 26),
        width=2 * SS,
    )
    rim.putalpha(Image.composite(rim.getchannel("A"), Image.new("L", (W, W), 0), mask))
    canvas = Image.alpha_composite(canvas, rim)

    icon = canvas.resize((SIZE, SIZE), Image.LANCZOS)
    icon.save(OUT / "icon.png")
    icon.save(
        OUT / "icon.ico",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    iconset = OUT / "icon.iconset"
    iconset.mkdir(exist_ok=True)
    for base in (16, 32, 128, 256, 512):
        icon.resize((base, base), Image.LANCZOS).save(iconset / f"icon_{base}x{base}.png")
        icon.resize((base * 2, base * 2), Image.LANCZOS).save(iconset / f"icon_{base}x{base}@2x.png")
    print("wrote", OUT / "icon.png")


if __name__ == "__main__":
    main()
