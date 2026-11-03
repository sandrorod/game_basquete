"""Recorta o desenho grande de corpo inteiro do herói (art/hero-sheet.png, ao lado do retrato)
para a tela inicial: public/sprites/hero/hero_full.png. O fundo azul-escuro em degradê vira transparente
(preenchimento a partir das bordas, avançando enquanto a cor muda pouco de um pixel para o vizinho).
Uso: python3 tools/slice_hero_full.py
"""
import os
from collections import deque

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
X0, Y0, X1, Y1 = 262, 0, 455, 372
TOL = 6
src = np.array(Image.open(os.path.join(ROOT, 'art', 'hero-sheet.png')).convert('RGB'))
crop = src[Y0:Y1, X0:X1].copy()
c = crop.astype(int)
h, w = c.shape[:2]
lum = c.mean(2)
bg = np.zeros((h, w), bool)
q = deque([(y, x) for y in range(h) for x in (0, w - 1)] + [(y, x) for x in range(w) for y in (h - 1,)])
for p in q:
    bg[p] = True
while q:
    y, x = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < h and 0 <= nx < w and not bg[ny, nx] and lum[ny, nx] < 62 and (c[ny, nx, 2] >= c[ny, nx, 0]) and np.abs(c[ny, nx] - c[y, x]).max() <= TOL:
            bg[ny, nx] = True
            q.append((ny, nx))
fg = (~bg).astype(np.uint8) * 255
n, lab, stats, _ = cv2.connectedComponentsWithStats(fg, 8)
big = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
fg = (lab == big).astype(np.uint8) * 255
# fundo preso entre o braço e o corpo: manchas azul-escuras grandes também saem
navy = ((c[:, :, 2] - c[:, :, 0]) > 10) & (lum < 75)
n2, lab2, st2, _ = cv2.connectedComponentsWithStats(navy.astype(np.uint8), 8)
for i in range(1, n2):
    if st2[i, cv2.CC_STAT_AREA] > 40:
        fg[lab2 == i] = 0
ys, xs = np.nonzero(fg)
rgba = np.dstack([crop, fg])[ys.min(): ys.max() + 1, xs.min(): xs.max() + 1]
Image.fromarray(rgba).save(os.path.join(ROOT, 'public', 'sprites', 'hero', 'hero_full.png'))
print(rgba.shape)
