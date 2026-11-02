"""Recorta os quadros do herói de art/hero-sheet.png (fundo azul-marinho e sombra do chão -> transparente).

Gera public/sprites/hero/<animacao>_<n>.png e public/sprites/hero/hero.json (tamanho e linha dos pés).
Uso: python3 tools/slice_hero.py
"""
import json
import os
from collections import deque

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'art', 'hero-sheet.png')
OUT = os.path.join(ROOT, 'public', 'sprites', 'hero')

im = np.array(Image.open(SRC).convert('RGB')).astype(int)
H, W, _ = im.shape
r, b = im[..., 0], im[..., 2]
mx = im.max(2)
# fundo: escuro e azulado (o contorno/cabelo do personagem é preto neutro ou marrom)
bg_like = ((b - r) >= 4) & (mx < 48)
# sombra no chão: preto neutro (só é removida perto dos pés)
dark = mx < 42

# (animação, x0, y0, x1, y1) — medido pelas faixas azuis dos títulos
SECTIONS = [
    ('idle', 0, 410, 592, 555), ('walk', 592, 410, 1254, 555),
    ('run', 0, 586, 663, 723), ('walkv', 663, 586, 1254, 723),
    ('windup', 0, 753, 583, 890), ('throw', 583, 753, 1254, 890),
    ('hurt', 0, 921, 629, 1061), ('pushed', 629, 921, 1254, 1061),
    ('celebrate', 0, 1092, 606, 1254), ('ko', 606, 1092, 1254, 1254),
]


def runs(occ, min_gap=4, min_w=14):
    """Faixas de colunas ocupadas, separadas por colunas vazias."""
    out, start, gap = [], None, 0
    for x, v in enumerate(occ):
        if v:
            if start is None:
                start = x
            gap = 0
            end = x
        elif start is not None:
            gap += 1
            if gap >= min_gap:
                if end - start + 1 >= min_w:
                    out.append((start, end))
                start = None
    if start is not None and end - start + 1 >= min_w:
        out.append((start, end))
    return out


def flood_bg(cm):
    """Marca como fundo só o que está ligado à borda do recorte."""
    h, w = cm.shape
    seen = np.zeros_like(cm)
    q = deque()
    for yy in range(h):
        for xx in (0, w - 1):
            if cm[yy, xx] and not seen[yy, xx]:
                seen[yy, xx] = True
                q.append((yy, xx))
    for xx in range(w):
        for yy in (0, h - 1):
            if cm[yy, xx] and not seen[yy, xx]:
                seen[yy, xx] = True
                q.append((yy, xx))
    while q:
        yy, xx = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = yy + dy, xx + dx
            if 0 <= ny < h and 0 <= nx < w and cm[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    return seen


os.makedirs(OUT, exist_ok=True)
meta = {}
for name, sx0, sy0, sx1, sy1 in SECTIONS:
    fg = ~bg_like[sy0:sy1, sx0:sx1]
    # ocupação das colunas acima da faixa de sombra dos pés
    occ = fg[: max(10, (sy1 - sy0) - 24)].sum(0) > 1
    meta[name] = []
    for i, (fx0, fx1) in enumerate(runs(occ)):
        x0, x1 = max(0, sx0 + fx0 - 4), min(W, sx0 + fx1 + 5)
        col = ~bg_like[sy0:sy1, x0:x1]
        rows = np.nonzero(col.sum(1) > 1)[0]
        y0, y1 = sy0 + max(0, rows.min() - 3), sy0 + min(sy1 - sy0, rows.max() + 3)
        crop = im[y0:y1, x0:x1]
        h, w = crop.shape[:2]
        cm = bg_like[y0:y1, x0:x1].copy()
        # zona dos pés: preto neutro também é fundo (sombra no chão)
        foot_zone = int(h * 0.82)
        cm[foot_zone:] |= dark[y0:y1, x0:x1][foot_zone:]
        bgm = flood_bg(cm)
        alpha = np.where(bgm, 0, 255)
        rgba = np.dstack([crop, alpha]).astype(np.uint8)
        # tira o fiapo da linha do chão: linhas de baixo só com pixels escuros
        while rgba.shape[0] > 10:
            row = rgba[-1]
            vis = row[..., 3] > 0
            if vis.any() and (row[vis][:, :3].max(1) < 70).mean() > 0.9:
                rgba = rgba[:-1]
            elif not vis.any():
                rgba = rgba[:-1]
            else:
                break
        # corta as bordas vazias
        ys, xs = np.nonzero(rgba[..., 3])
        rgba = rgba[ys.min(): ys.max() + 1, xs.min(): xs.max() + 1]
        fname = f'{name}_{i}.png'
        Image.fromarray(rgba).save(os.path.join(OUT, fname))
        top_in_sheet = y0 + int(ys.min())
        a = rgba[..., 3]
        cols = np.nonzero(a[int(a.shape[0] * 0.88):].sum(0))[0]
        foot = int((cols.min() + cols.max()) / 2) if len(cols) else a.shape[1] // 2
        meta[name].append({'file': fname, 'w': int(rgba.shape[1]), 'h': int(rgba.shape[0]), 'footX': foot, '_top': top_in_sheet})
    # linha do chão da seção = pé mais baixo entre os quadros; cada quadro guarda a distância até ela
    ground = max(f['_top'] + f['h'] for f in meta[name])
    for f in meta[name]:
        f['base'] = int(ground - f.pop('_top'))

with open(os.path.join(OUT, 'hero.json'), 'w') as f:
    json.dump(meta, f, indent=1)
print({k: len(v) for k, v in meta.items()})
