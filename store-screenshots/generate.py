"""Build App Store screenshots at Apple's exact pixel sizes."""
from __future__ import annotations

import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(ROOT)

BG = (10, 10, 8)
ACCENT = (252, 234, 7)
INK = (244, 241, 224)
MUTED = (184, 180, 154)

SIZES = [
    (1242, 2688),
    (2688, 1242),
    (1284, 2778),
    (2778, 1284),
]

SCREENS = [
    {
        "file": "screenshot-home.png",
        "name": "01-accueil",
        "kicker": "BEATONSTEP",
        "title": "Ta musique\nsuit tes pas",
        "sub": "L'app lit ton allure et met un titre au même rythme.",
    },
    {
        "file": "screenshot-pace.png",
        "name": "02-reglages",
        "kicker": "BEATONSTEP",
        "title": "Adaptatif,\nou tu fixes",
        "sub": "Marche, footing, sprint : la musique suit.",
    },
    {
        "file": "screenshot-library.png",
        "name": "03-bibliotheque",
        "kicker": "BEATONSTEP",
        "title": "Le bon titre,\nau bon BPM",
        "sub": "Mix inclus et musiques téléphone.",
    },
]

FONT_REG = r"C:\Windows\Fonts\segoeui.ttf"
FONT_BOLD = r"C:\Windows\Fonts\segoeuib.ttf"


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def round_corners(im: Image.Image, radius: int) -> Image.Image:
    im = im.convert("RGBA")
    mask = Image.new("L", im.size, 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle((0, 0, im.width, im.height), radius=radius, fill=255)
    im.putalpha(mask)
    return im


def shadow(size: tuple[int, int], radius: int, blur: int, pad: int) -> Image.Image:
    w, h = size
    layer = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle(
        (pad, pad + 8, pad + w, pad + h + 8),
        radius=radius,
        fill=(0, 0, 0, 160),
    )
    return layer.filter(ImageFilter.GaussianBlur(blur))


def paint_bg(w: int, h: int) -> Image.Image:
    canvas = Image.new("RGB", (w, h), BG)
    glow = Image.new("RGB", (w, h), BG)
    gd = ImageDraw.Draw(glow)
    cx, cy = int(w * 0.5), int(h * 0.22 if h > w else h * 0.5)
    r = int(min(w, h) * 0.55)
    gd.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(42, 38, 8))
    glow = glow.filter(ImageFilter.GaussianBlur(int(min(w, h) * 0.18)))
    return Image.blend(canvas, glow, 0.55)


def paste_center(base: Image.Image, overlay: Image.Image, xy: tuple[int, int]) -> None:
    base.paste(overlay, xy, overlay)


def draw_wrapped(draw: ImageDraw.ImageDraw, text: str, fnt, fill, xy, max_w: int, line_h: int) -> int:
    x, y = xy
    words = text.split()
    line = ""
    for word in words:
        trial = (line + " " + word).strip()
        if draw.textlength(trial, font=fnt) <= max_w:
            line = trial
        else:
            draw.text((x, y), line, font=fnt, fill=fill)
            y += line_h
            line = word
    if line:
        draw.text((x, y), line, font=fnt, fill=fill)
        y += line_h
    return y


def fit_shot(shot: Image.Image, max_w: int, max_h: int) -> Image.Image:
    scale = min(max_w / shot.width, max_h / shot.height)
    nw = max(1, int(shot.width * scale))
    nh = max(1, int(shot.height * scale))
    return shot.resize((nw, nh), Image.Resampling.LANCZOS)


def compose_portrait(w: int, h: int, shot: Image.Image, spec: dict) -> Image.Image:
    canvas = paint_bg(w, h).convert("RGBA")
    draw = ImageDraw.Draw(canvas)
    pad = int(w * 0.075)
    kicker_f = font(FONT_BOLD, int(w * 0.028))
    title_f = font(FONT_BOLD, int(w * 0.078))
    sub_f = font(FONT_REG, int(w * 0.032))

    y = int(h * 0.055)
    draw.text((pad, y), spec["kicker"], font=kicker_f, fill=ACCENT)
    y += int(h * 0.038)
    for line in spec["title"].split("\n"):
        draw.text((pad, y), line, font=title_f, fill=INK)
        y += int(title_f.size * 1.12)
    y += int(h * 0.012)
    y = draw_wrapped(draw, spec["sub"], sub_f, MUTED, (pad, y), w - pad * 2, int(sub_f.size * 1.35))

    max_shot_w = w - pad * 2
    max_shot_h = h - y - int(h * 0.07)
    fitted = fit_shot(shot, max_shot_w, max_shot_h)
    radius = max(28, int(fitted.width * 0.08))
    sh = shadow(fitted.size, radius, blur=max(12, w // 80), pad=max(24, w // 30))
    rounded = round_corners(fitted, radius)
    sx = (w - fitted.width) // 2
    sy = y + int(h * 0.03)
    paste_center(canvas, sh, (sx - (sh.width - fitted.width) // 2, sy - (sh.height - fitted.height) // 2))
    paste_center(canvas, rounded, (sx, sy))
    return canvas.convert("RGB")


def compose_landscape(w: int, h: int, shot: Image.Image, spec: dict) -> Image.Image:
    canvas = paint_bg(w, h).convert("RGBA")
    draw = ImageDraw.Draw(canvas)
    pad = int(h * 0.1)
    col_w = int(w * 0.46)
    kicker_f = font(FONT_BOLD, int(h * 0.045))
    title_f = font(FONT_BOLD, int(h * 0.11))
    sub_f = font(FONT_REG, int(h * 0.042))

    y = int(h * 0.22)
    draw.text((pad, y), spec["kicker"], font=kicker_f, fill=ACCENT)
    y += int(h * 0.07)
    for line in spec["title"].split("\n"):
        draw.text((pad, y), line, font=title_f, fill=INK)
        y += int(title_f.size * 1.12)
    y += int(h * 0.04)
    draw_wrapped(draw, spec["sub"], sub_f, MUTED, (pad, y), col_w - pad, int(sub_f.size * 1.35))

    max_shot_h = h - pad * 2
    max_shot_w = w - col_w - pad
    fitted = fit_shot(shot, max_shot_w, max_shot_h)
    radius = max(24, int(fitted.width * 0.08))
    sh = shadow(fitted.size, radius, blur=max(10, h // 70), pad=max(20, h // 28))
    rounded = round_corners(fitted, radius)
    sx = col_w + (w - col_w - fitted.width) // 2
    sy = (h - fitted.height) // 2
    paste_center(canvas, sh, (sx - (sh.width - fitted.width) // 2, sy - (sh.height - fitted.height) // 2))
    paste_center(canvas, rounded, (sx, sy))
    return canvas.convert("RGB")


def main() -> None:
    for w, h in SIZES:
        out_dir = os.path.join(ROOT, f"{w}x{h}")
        os.makedirs(out_dir, exist_ok=True)
        portrait = h > w
        for spec in SCREENS:
            shot = Image.open(os.path.join(SITE, spec["file"])).convert("RGB")
            canvas = compose_portrait(w, h, shot, spec) if portrait else compose_landscape(w, h, shot, spec)
            path = os.path.join(out_dir, f"{spec['name']}.png")
            canvas.save(path, "PNG", optimize=True)
            print(path, canvas.size)


if __name__ == "__main__":
    main()
