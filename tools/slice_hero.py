"""Recorta o herói de art/hero-sheet.png (folha com fundo verde) em public/sprites/hero/.
Fundo verde (chroma key) -> transparente, com a borda verde removida das cores.
Cada linha vira uma ou mais animações; os quadros saem dos pedaços do desenho agrupados por coluna.
Os pés de cada quadro ficam alinhados à linha de chão da linha (base), para os quadros não "pularem".
Também grava o desenho grande (hero_full.png) usado na tela inicial.
Uso: python3 tools/slice_hero.py
"""
import json
import os

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'sprites', 'hero')
im = np.array(Image.open(os.path.join(ROOT, 'art', 'hero-sheet.png')).convert('RGB')).astype(int)
# faixas da folha: (x0, y0, x1, y1) -> nomes das animações em ordem (quantos quadros cada uma pega)
ROWS = [
    ((570, 4, 1536, 205), [('walknb', 1), ('walk', 6)], 0.84),    # anda batendo bola (desenhada maior na folha)
    ((570, 208, 1536, 370), [('cross', 6)]),                     # drible baixo (correndo com a bola)
    ((570, 374, 1536, 536), [('idle', 1), ('legs', 4), ('stand', 1), ('spin', 2)]),
    ((0, 539, 1536, 690), [('run', 11)]),
    ((0, 690, 1536, 862), [('windup', 5), ('shoot', 2), ('throw', 3), ('catch', 2)]),
    ((0, 862, 1536, 1024), [('celebrate', 4), ('ko', 7)]),
]
FULL = (355, 0, 570, 455)


def key(cell):
    """Máscara do desenho: tudo que não é o verde do fundo (com folga para o verde misturado nas bordas)."""
    r, g, b = cell[:, :, 0], cell[:, :, 1], cell[:, :, 2]
    green = (g > 120) & (g > r + 45) & (g > b + 45)
    fg = (~green).astype(np.uint8)
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    return fg


def despill(rgb, mask):
    """Tira o verde que vazou nas bordas: o canal verde não passa da média do vermelho e do azul."""
    out = rgb.copy()
    lim = np.maximum(out[:, :, 0], out[:, :, 2])
    spill = (out[:, :, 1] > lim + 10) & (mask > 0)
    out[:, :, 1][spill] = lim[spill] + 10
    return out.clip(0, 255)


def save(rgba, fn):
    Image.fromarray(rgba.astype(np.uint8)).save(os.path.join(OUT, fn))


for f in os.listdir(OUT):
    if f.endswith('.png'):
        os.remove(os.path.join(OUT, f))
meta = {}
for row in ROWS:
    (x0, y0, x1, y1), names = row[0], row[1]
    k_scale = row[2] if len(row) > 2 else 1.0
    cell = im[y0:y1, x0:x1]
    fg = key(cell)
    n, lab, st, _ = cv2.connectedComponentsWithStats(fg, 8)
    big = st[1:, cv2.CC_STAT_AREA].max()
    comps = sorted([[st[i, 0], st[i, 0] + st[i, 2], [i]] for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= max(12, big * 0.004)])
    frames = []
    for c in comps:
        # pedaço que cai dentro da coluna de um quadro (bola, mão, cabelo) entra nele
        if frames and c[0] < frames[-1][1] - 6:
            frames[-1][1] = max(frames[-1][1], c[1])
            frames[-1][2] += c[2]
        else:
            frames.append(c)
    areas = [sum(st[i, cv2.CC_STAT_AREA] for i in f[2]) for f in frames]
    # pedaços pequenos que sobraram sozinhos (bola entre dois quadros) vão para o vizinho mais perto
    body = [f for f, a in zip(frames, areas) if a > max(areas) * 0.2]
    for f, a in zip(frames, areas):
        if a <= max(areas) * 0.2:
            near = min(body, key=lambda b: min(abs(b[0] - f[1]), abs(f[0] - b[1])))
            near[2] += f[2]
    boxes = []
    for _, _, ids in body:
        m = np.isin(lab, ids)
        ys, xs = np.nonzero(m)
        boxes.append((xs.min(), xs.max() + 1, ys.min(), ys.max() + 1, m))
    want = sum(c for _, c in names)
    assert len(boxes) == want, (names, len(boxes), [(b[0], b[1] - b[0], b[3] - b[2]) for b in boxes])
    ground = max(b[3] for b in boxes)
    i = 0
    for name, count in names:
        meta[name] = []
        for k in range(count):
            bx0, bx1, by0, by1, m = boxes[i]
            i += 1
            mm = m[by0:by1, bx0:bx1]
            rgb = despill(cell[by0:by1, bx0:bx1], mm)
            rgba = np.dstack([rgb, mm * 255]).astype(np.uint8)
            if k_scale != 1.0:
                pil = Image.fromarray(rgba)
                rgba = np.array(pil.resize((round(pil.width * k_scale), round(pil.height * k_scale)), Image.LANCZOS))
                rgba[:, :, 3] = np.where(rgba[:, :, 3] > 110, 255, 0)
                mm = rgba[:, :, 3] > 0
            fn = f'{name}_{k}.png'
            save(rgba, fn)
            a = mm > 0
            foot = a[int(a.shape[0] * 0.85):]
            cols = np.nonzero(foot.any(0))[0]
            meta[name].append({'file': fn, 'w': int(rgba.shape[1]), 'h': int(rgba.shape[0]), 'footX': int((cols.min() + cols.max()) / 2), 'base': int(round((ground - by0) * k_scale))})
        print(name, count, [(f['w'], f['h']) for f in meta[name]])
json.dump(meta, open(os.path.join(OUT, 'hero.json'), 'w'), indent=1)

# desenho grande para a tela inicial
x0, y0, x1, y1 = FULL
cell = im[y0:y1, x0:x1]
fg = key(cell)
n, lab, st, _ = cv2.connectedComponentsWithStats(fg, 8)
bigc = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
m = lab == bigc
ys, xs = np.nonzero(m)
mm = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
rgba = np.dstack([despill(cell[ys.min():ys.max() + 1, xs.min():xs.max() + 1], mm), mm * 255])
save(rgba, 'hero_full.png')
print('hero_full', rgba.shape)
