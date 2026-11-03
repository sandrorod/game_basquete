"""Recorta os truques do herói (art/hero-tricks-sheet.png): passagem entre as pernas e bola girando no dedo.
Fundo preto -> transparente (preenchimento a partir das bordas, para não apagar os contornos escuros).
Grava em public/sprites/hero/ e acrescenta 'legs' e 'spin' em hero.json.
Uso: python3 tools/slice_tricks.py
"""
import json
import os
from collections import deque

import numpy as np
from PIL import Image
import cv2

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
im = np.array(Image.open(os.path.join(ROOT, 'art', 'hero-tricks-sheet.png')).convert('RGB')).astype(int)
OUT = os.path.join(ROOT, 'public', 'sprites', 'hero')
# (nome, y0, y1) de cada faixa, abaixo do título azul
SECTIONS = [('legs', 95, 410, 14), ('spin', 535, 945, 1)]


def flood_bg(cell):
    h, w = cell.shape[:2]
    dark = cell.max(2) < 34
    seen = np.zeros((h, w), bool)
    q = deque([(y, x) for y in range(h) for x in (0, w - 1) if dark[y, x]] + [(y, x) for x in range(w) for y in (0, h - 1) if dark[y, x]])
    for p in q:
        seen[p] = True
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and dark[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    return seen


meta = json.load(open(os.path.join(OUT, 'hero.json')))
for name, y0, y1, join in SECTIONS:
    band = im[y0:y1]
    bg = flood_bg(band)
    fg = ~bg
    cols = fg.sum(0) > 0
    # quadros = trechos de colunas ocupadas (pequenas falhas juntadas)
    runs, x = [], 0
    W = len(cols)
    while x < W:
        if cols[x]:
            s = x
            while x < W and (cols[x] or cols[x:x + join].any()):
                x += 1
            if x - s > 40:
                runs.append((s, x))
        x += 1
    if name == 'spin':
        # quadros encostados (anel da bola, mão estendida): cada pedaço vai para o jogador mais próximo
        centers = [115, 345, 575, 800, 1010, 1225, 1430]
        n, lab, stats, cent = cv2.connectedComponentsWithStats(fg.astype(np.uint8), 8)
        owner = {k: int(np.argmin([abs(cent[k][0] - c) for c in centers])) for k in range(1, n) if stats[k, cv2.CC_STAT_AREA] > 6}
        frames = []
        for i in range(len(centers)):
            m = np.isin(lab, [k for k, o in owner.items() if o == i])
            ys, xs = np.nonzero(m)
            a, b, top, bot = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
            rgba = np.dstack([band[top:bot, a:b], m[top:bot, a:b] * 255]).astype(np.uint8)
            frames.append((rgba, top, bot))
        runs = []
    else:
        frames = []
    for i, (a, b) in enumerate(runs):
        m = fg[:, a:b]
        ys = np.nonzero(m.any(1))[0]
        top, bot = ys.min(), ys.max() + 1
        rgba = np.dstack([band[top:bot, a:b], m[top:bot] * 255]).astype(np.uint8)
        frames.append((rgba, top, bot))
    ground = max(f[2] for f in frames)
    out = []
    for i, (rgba, top, bot) in enumerate(frames):
        fn = f'{name}_{i}.png'
        Image.fromarray(rgba).save(os.path.join(OUT, fn))
        a = rgba[:, :, 3] > 0
        foot = a[int(a.shape[0] * 0.88):]
        c = np.nonzero(foot.any(0))[0]
        out.append({'file': fn, 'w': int(rgba.shape[1]), 'h': int(rgba.shape[0]), 'footX': int((c.min() + c.max()) / 2), 'base': int(ground - top)})
    meta[name] = out
    print(name, len(out), [(f['w'], f['h']) for f in out])
json.dump(meta, open(os.path.join(OUT, 'hero.json'), 'w'), indent=1)
