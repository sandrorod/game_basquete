"""Acrescenta ao herói as folhas extras (fundo verde), na mesma escala dos quadros já gravados:
- art/hero-tricks-sheet.png: olha para a câmera (look), passa entre as pernas (legs), roda no dedo (spin);
- art/hero-dribble-sheet.png: bate bola parado (dribble) e anda batendo bola (walk).
Rodar depois de slice_hero.py e enhance_sprites.py (hero): a escala é calculada pelo quadro parado já gravado.
Uso: python3 tools/slice_hero_extra.py
"""
import json
import os

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'sprites', 'hero')
# folha -> lista de linhas; cada linha: lista de (animação, quantos quadros)
SHEETS = {
    'hero-tricks-sheet.png': [[('look', 6)], [('legs', 6)], [('spin', 6)]],
    'hero-dribble-sheet.png': [[('dribble', 7)], [('walk', 8)], [('walk', 5), ('turn', 4)]],
    'hero-run-sheet.png': [[('rundrib', 7)], [('rundrib', 6)], [('rundrib', 6)]],
}
# linhas desenhadas em outro tamanho na folha: o quadro mais alto da linha fica da altura do herói parado
FIT_ROWS = {('hero-dribble-sheet.png', 1), ('hero-dribble-sheet.png', 2), ('hero-run-sheet.png', 0), ('hero-run-sheet.png', 1), ('hero-run-sheet.png', 2)}


def key(cell):
    r, g, b = cell[:, :, 0], cell[:, :, 1], cell[:, :, 2]
    green = (g > 120) & (g > r + 45) & (g > b + 45)
    fg = (~green).astype(np.uint8)
    return cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))


def despill(rgb, mask):
    out = rgb.copy()
    lim = np.maximum(out[:, :, 0], out[:, :, 2])
    spill = (out[:, :, 1] > lim + 10) & (mask > 0)
    out[:, :, 1][spill] = lim[spill] + 10
    return out.clip(0, 255)


def rows_of(fg):
    prof = fg.sum(1)
    runs, start = [], None
    for y, v in enumerate(prof):
        if v > 3 and start is None:
            start = y
        if v <= 3 and start is not None:
            if y - start > 40:
                runs.append((start, y))
            start = None
    if start is not None:
        runs.append((start, len(prof)))
    return runs


def frames_of(cell):
    """Cada pedaço grande (corpo) é um quadro; pedaços pequenos (bola solta, dedos, anel) vão para o corpo mais perto."""
    fg = key(cell)
    n, lab, st, cen = cv2.connectedComponentsWithStats(fg, 8)
    big = st[1:, cv2.CC_STAT_AREA].max()
    bodies = [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > big * 0.25]
    bodies.sort(key=lambda i: cen[i][0])
    groups = {b: [b] for b in bodies}
    for i in range(1, n):
        if i in groups or st[i, cv2.CC_STAT_AREA] < 12:
            continue
        x, y, w, h = st[i, :4]
        def dist(b):
            bx, by, bw, bh = st[b, :4]
            dx = max(0, bx - (x + w), x - (bx + bw))
            dy = max(0, by - (y + h), y - (by + bh))
            return dx + dy * 0.5
        groups[min(bodies, key=dist)].append(i)
    out = []
    for b in bodies:
        m = np.isin(lab, groups[b])
        ys, xs = np.nonzero(m)
        out.append((xs.min(), xs.max() + 1, ys.min(), ys.max() + 1, m))
    return out


meta = json.load(open(os.path.join(OUT, 'hero.json')))
ref_h = meta['idle'][0]['h']
for name in {n for rows in SHEETS.values() for row in rows for n, _ in row}:
    meta.pop(name, None)
    for f in os.listdir(OUT):
        if f.startswith(name + '_'):
            os.remove(os.path.join(OUT, f))
for sheet, rows in SHEETS.items():
    im = np.array(Image.open(os.path.join(ROOT, 'art', sheet)).convert('RGB')).astype(int)
    found = rows_of(key(im))
    assert len(found) == len(rows), (sheet, found)
    scale = None
    for ri, ((y0, y1), names) in enumerate(zip(found, rows)):
        cell = im[max(0, y0 - 4):y1 + 4]
        boxes = frames_of(cell)
        assert len(boxes) == sum(c for _, c in names), (sheet, names, len(boxes))
        # escala: o 1º quadro de pé da folha fica da altura do quadro parado do herói
        if scale is None:
            scale = ref_h / (boxes[0][3] - boxes[0][2])
        row_scale = ref_h / max(b[3] - b[2] for b in boxes) if (sheet, ri) in FIT_ROWS else scale
        ground = max(b[3] for b in boxes)
        i = 0
        for name, count in names:
            lst = meta.setdefault(name, [])
            for _ in range(count):
                bx0, bx1, by0, by1, m = boxes[i]
                i += 1
                mm = m[by0:by1, bx0:bx1]
                rgba = np.dstack([despill(cell[by0:by1, bx0:bx1], mm), mm * 255]).astype(np.uint8)
                pil = Image.fromarray(rgba)
                pil = pil.resize((max(1, round(pil.width * row_scale)), max(1, round(pil.height * row_scale))), Image.LANCZOS)
                rgba = np.array(pil)
                rgba[:, :, 3] = np.where(rgba[:, :, 3] > 110, 255, 0)
                fn = f'{name}_{len(lst)}.png'
                Image.fromarray(rgba).save(os.path.join(OUT, fn))
                a = rgba[:, :, 3] > 0
                cols = np.nonzero(a[int(a.shape[0] * 0.85):].any(0))[0]
                lst.append({'file': fn, 'w': int(rgba.shape[1]), 'h': int(rgba.shape[0]), 'footX': int((cols.min() + cols.max()) / 2), 'base': int(round((ground - by0) * row_scale))})
for name in ('look', 'legs', 'spin', 'dribble', 'walk', 'turn', 'rundrib'):
    print(name, len(meta[name]), [(f['w'], f['h']) for f in meta[name]][:3])
json.dump(meta, open(os.path.join(OUT, 'hero.json'), 'w'), indent=1)
