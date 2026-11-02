"""Recorta a arte de corpo inteiro de cada chefe (art/bosses-sheet.png) com GrabCut -> public/sprites/bosses/.
Uso: python3 tools/slice_bosses.py
"""
import json
import os
from collections import deque

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = np.array(Image.open(os.path.join(ROOT, 'art', 'bosses-sheet.png')).convert('RGB'))
# (nome, x0, y0, x1, y1) da região do corpo inteiro em cada cartão
BOSSES = [
    ('razor', 8, 6, 212, 220),
    ('titan', 362, 10, 530, 220),
    ('viper', 688, 10, 845, 220),
    ('coach', 980, 10, 1135, 222),
    ('dunker', 1274, 10, 1430, 220),
    ('shotgun', 6, 540, 172, 750),
    ('ace', 342, 540, 525, 750),
    ('big', 645, 545, 820, 742),
    ('hoops', 952, 540, 1105, 742),
    ('king', 1236, 540, 1415, 742),
]
TOL = 7
OUT = os.path.join(ROOT, 'public', 'sprites', 'bosses')
os.makedirs(OUT, exist_ok=True)
meta = {}
for name, x0, y0, x1, y1 in BOSSES:
    pad = 6
    crop = src[y0 - pad if y0 >= pad else 0: y1 + pad, x0 - pad if x0 >= pad else 0: x1 + pad].copy()
    h, w = crop.shape[:2]
    c = crop.astype(int)
    lum = c.mean(2)
    # varinha mágica: o fundo é um degradê suave; avança enquanto a cor muda pouco de um pixel para o vizinho
    bg = np.zeros((h, w), bool)
    q = deque([(yy, xx) for yy in range(h) for xx in (0, w - 1)] + [(yy, xx) for xx in range(w) for yy in (0, h - 1)])
    for pnt in q:
        bg[pnt] = True
    while q:
        yy, xx = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = yy + dy, xx + dx
            if 0 <= ny < h and 0 <= nx < w and not bg[ny, nx] and lum[ny, nx] > (28 if ny > h * 0.78 else 55) and np.abs(c[ny, nx] - c[yy, xx]).max() <= (16 if ny > h * 0.78 else TOL):
                bg[ny, nx] = True
                q.append((ny, nx))
    fg = (~bg).astype(np.uint8) * 255
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    # maior componente (descarta a bola do título e pedaços do retrato)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(fg, 8)
    if n > 1:
        big = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        fg = (lab == big).astype(np.uint8) * 255
    # buracos internos fechados pelo contorno também são do personagem
    cnts, _ = cv2.findContours(fg, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    filled = np.zeros_like(fg)
    cv2.drawContours(filled, cnts, -1, 255, -1)
    fg = np.where(bg & (filled > 0) & (np.abs(c - cv2.blur(crop, (15, 15)).astype(int)).max(2) < 6), 0, filled).astype(np.uint8)
    ys, xs = np.nonzero(fg > 40)
    rgba = np.dstack([crop, fg])[ys.min(): ys.max() + 1, xs.min(): xs.max() + 1]
    Image.fromarray(rgba).save(os.path.join(OUT, f'{name}.png'))
    a = rgba[:, :, 3] > 100
    bottom = a[int(a.shape[0] * 0.85):]
    cols = np.nonzero(bottom.any(0))[0]
    foot_x = int((cols.min() + cols.max()) / 2) if len(cols) else rgba.shape[1] // 2
    meta[name] = {'file': f'{name}.png', 'w': int(rgba.shape[1]), 'h': int(rgba.shape[0]), 'footX': foot_x, 'base': int(rgba.shape[0])}
with open(os.path.join(OUT, 'bosses.json'), 'w') as f:
    json.dump(meta, f, indent=1)
print(meta)
