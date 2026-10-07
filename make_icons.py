#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成 PWA 图标：黑底 + 🔥 火焰 + 橙色圆角方框描边（非圆形）。"""
from PIL import Image, ImageDraw, ImageFilter
import shutil, os

EMOJI = "emoji512.png"
ORANGE = (255, 122, 47, 255)  # var(--accent) #ff7a2f

def make_icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 255))
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    m = size * 0.10
    gd.rounded_rectangle([m, m, size - m, size - m], radius=int(size * 0.20),
                         fill=(255, 122, 47, 42))
    glow = glow.filter(ImageFilter.GaussianBlur(size * 0.07))
    img = Image.alpha_composite(img, glow)

    d = ImageDraw.Draw(img)
    inset = size * 0.045
    radius = int(size * 0.20)
    ring_w = max(3, int(size * 0.030))
    d.rounded_rectangle([inset, inset, size - inset, size - inset],
                        radius=radius, outline=ORANGE, width=ring_w)

    emoji = Image.open(EMOJI).convert("RGBA")
    es = int(size * 0.80)
    emoji = emoji.resize((es, es), Image.Resampling.LANCZOS)
    img.alpha_composite(emoji, (int((size - es) / 2), int((size - es) / 2)))
    return img.convert("RGB")

if __name__ == "__main__":
    if not os.path.exists(EMOJI):
        shutil.copy(os.path.expanduser("~/projects/huohuo-words/emoji512.png"), EMOJI)
    for name, s in [("icon-192.png", 192), ("icon-512.png", 512), ("icon-180.png", 180)]:
        make_icon(s).save(name)
        print("生成", name)
