#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成 PWA 图标。

优先用自定义图标源图 icon-src.png（Gemini 生成的深色图标，白底）：
  1) 白底 flood fill 成黑色（app 主题黑 #000）；
  2) 找深蓝图标方块外接框（深蓝=蓝通道明显高于红通道，排除白烟/灰阴影/灰柱）；
  3) 取中心正方形（边长=较长边）居中裁剪，避免拉伸变形；
  4) 缩放成 512 / 192 / 180。
若 icon-src.png 缺失，回退到旧的 emoji 方案（黑底 + 橙色圆角描边 + emoji）。
"""
from PIL import Image, ImageDraw, ImageFilter
import shutil, os

CUSTOM = "icon-src.png"
EMOJI = "emoji512.png"
ORANGE = (255, 122, 47, 255)  # var(--accent) #ff7a2f

def from_custom():
    img = Image.open(CUSTOM).convert("RGB")
    W, H = img.size
    # 白底 -> 黑底
    for xy in [(0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1)]:
        ImageDraw.floodfill(img, xy, (0, 0, 0), thresh=70)
    px = img.load()
    minx = miny = 10 ** 9
    maxx = maxy = -1
    for y in range(H):
        for x in range(W):
            r, g, b = px[x, y]
            if b > r + 8 and max(r, g, b) < 200:
                minx = min(minx, x); maxx = max(maxx, x)
                miny = min(miny, y); maxy = max(maxy, y)
    w = maxx - minx + 1
    h = maxy - miny + 1
    side = max(w, h)
    cx = (minx + maxx) // 2
    cy = (miny + maxy) // 2
    left = max(0, min(cx - side // 2, W - side))
    top = max(0, min(cy - side // 2, H - side))
    return img.crop((left, top, left + side, top + side))

def from_emoji(size):
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
    if not os.path.exists(CUSTOM) and not os.path.exists(EMOJI):
        shutil.copy(os.path.expanduser("~/projects/huohuo-words/emoji512.png"), EMOJI)

    custom = None
    if os.path.exists(CUSTOM):
        custom = from_custom()

    for name, s in [("icon-192.png", 192), ("icon-512.png", 512), ("icon-180.png", 180)]:
        img = custom.resize((s, s), Image.Resampling.LANCZOS) if custom else from_emoji(s)
        img.save(name, quality=95)
        print("生成", name, "(" + ("自定义图标" if custom else "emoji 回退") + ")")
