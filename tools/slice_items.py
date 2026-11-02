"""Recorta os 20 prêmios de art/items-sheet.png (fundo preto -> transparente) em public/sprites/items/.
Uso: python3 tools/slice_items.py
"""
import json
import os
from collections import deque

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
im = np.array(Image.open(os.path.join(ROOT, 'art', 'items-sheet.png')).convert('RGB')).astype(int)
H, W, _ = im.shape
NAMES = [
    'burger', 'fries', 'pizza', 'soda', 'star',
    'coin', 'diamond', 'heart', 'lightning', 'trophy',
    'gift', 'medkit', 'potion_blue', 'potion_purple', 'crown',
    'rocket', 'glove', 'mushroom', 'shield', 'magnet',
]
OUT = os.path.join(ROOT, 'public', 'sprites', 'items')
os.makedirs(OUT, exist_ok=True)
bg = im.max(2) < 28
cw, ch = W / 5, H / 4
meta = {}
for i, name in enumerate(NAMES):
    c, r = i % 5, i // 5
    x0, y0, x1, y1 = int(c * cw), int(r * ch), int((c + 1) * cw), int((r + 1) * ch)
    cell = im[y0:y1, x0:x1]
    cm = bg[y0:y1, x0:x1]
    h, w = cm.shape
    seen = np.zeros_like(cm)
    q = deque([(yy, xx) for yy in range(h) for xx in (0, w - 1) if cm[yy, xx]] + [(yy, xx) for xx in range(w) for yy in (0, h - 1) if cm[yy, xx]])
    for p in q:
        seen[p] = True
    while q:
        yy, xx = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = yy + dy, xx + dx
            if 0 <= ny < h and 0 <= nx < w and cm[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    alpha = np.where(seen, 0, 255)
    ys, xs = np.nonzero(alpha)
    rgba = np.dstack([cell, alpha]).astype(np.uint8)[ys.min(): ys.max() + 1, xs.min(): xs.max() + 1]
    Image.fromarray(rgba).save(os.path.join(OUT, f'{name}.png'))
    meta[name] = {'file': f'{name}.png', 'w': int(rgba.shape[1]), 'h': int(rgba.shape[0]), 'footX': int(rgba.shape[1] // 2)}
with open(os.path.join(OUT, 'items.json'), 'w') as f:
    json.dump(meta, f, indent=1)
print(len(meta), 'prêmios')
