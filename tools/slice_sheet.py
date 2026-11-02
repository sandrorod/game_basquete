"""Recorta inimigos e objetos de art/enemies-props-sheet.png (fundo já transparente).

Gera public/sprites/enemies/<tipo>_<n>.png, public/sprites/props/<nome>.png e os .json com os tamanhos.
Uso: python3 tools/slice_sheet.py
"""
import json
import os

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'art', 'enemies-props-sheet.png')
a = np.array(Image.open(SRC).convert('RGBA'))
# a névoa colorida do fundo é semitransparente: fica só o que é sólido
solid = (a[..., 3] >= 150).astype(np.uint8)
rgb = a[..., :3].astype(int)

# Inimigos: região de cada um (pose grande + 4 quadros pequenos)
ENEMIES = {
    'thug': (0, 55, 280, 262), 'runner': (315, 55, 585, 262), 'heavy': (605, 55, 875, 262),
    'thief': (900, 55, 1175, 268), 'shooter': (1185, 55, 1525, 268), 'defender': (0, 315, 292, 522),
    'biker': (300, 325, 615, 527), 'baller': (630, 322, 905, 527), 'gangster': (925, 322, 1205, 527),
    'knife': (1215, 322, 1522, 532),
}
# Objetos: (região, nomes da esquerda para a direita)
PROPS = [
    ((0, 558, 292, 672), ['trash_metal', 'trash_green', 'trash_fallen']),
    ((312, 558, 578, 668), ['crate_a', 'crate_b', 'crate_c']),
    ((588, 562, 778, 668), ['barrel_blue', 'barrel_red', 'barrel_yellow']),
    ((798, 562, 942, 662), ['cone_a', 'cone_b']),
    ((978, 562, 1258, 682), ['bench_a', 'bench_b']),
    ((1262, 562, 1528, 678), ['table_set', 'chair_plastic']),
    ((5, 716, 346, 822), ['car_red', 'car_blue']),
    ((350, 716, 582, 828), ['moto_red', 'moto_black']),
    ((585, 712, 792, 822), ['bike_red', 'bike_green']),
    ((798, 716, 1068, 842), ['umbrella_red', 'umbrella_blue']),
    ((1078, 716, 1288, 842), ['sign_stop', 'sign_ped', 'sign_oneway']),
    ((1288, 716, 1532, 848), ['barrier_a', 'barrier_b']),
    ((0, 876, 472, 1008), ['pallet', 'tire', 'spool', 'crates_stack']),
    ((474, 872, 792, 1012), ['ac_unit', 'vending', 'electric_box']),
    ((790, 862, 1108, 1012), ['lamp', 'pole_a', 'pole_b']),
    ((1112, 876, 1532, 1008), ['hydrant_post', 'traffic_light', 'hydrant', 'manhole', 'grate', 'bollard']),
]


def comps(x0, y0, x1, y1, min_area=200):
    sub = solid[y0:y1, x0:x1]
    n, lab, st, _ = cv2.connectedComponentsWithStats(sub, 8)
    out = []
    for i in range(1, n):
        x, y, w, h, area = st[i]
        if area < min_area:
            continue
        piece = rgb[y0 + y:y0 + y + h, x0 + x:x0 + x + w][sub[y:y + h, x:x + w] > 0]
        # descarta rótulos (azul-marinho com texto) e barras de vida
        navy = ((piece[:, 2] > piece[:, 0] + 15) & (piece.max(1) < 90)).mean()
        if (h < 18 and w > 30) or (navy > 0.45 and h < 45):
            continue
        out.append([x0 + x, y0 + y, x0 + x + w, y0 + y + h, area])
    return out


def split_cols(box, parts):
    """Separa uma caixa com vários objetos pelas colunas mais vazias."""
    x0, y0, x1, y1 = box[:4]
    occ = solid[y0:y1, x0:x1].sum(0)
    cuts = []
    w = x1 - x0
    for k in range(1, parts):
        center = int(w * k / parts)
        lo, hi = max(1, center - w // (parts * 2)), min(w - 1, center + w // (parts * 2))
        cuts.append(lo + int(np.argmin(occ[lo:hi])))
    xs = [0] + cuts + [w]
    return [[x0 + xs[i], y0, x0 + xs[i + 1], y1] for i in range(parts)]


def save(box, path):
    x0, y0, x1, y1 = box[:4]
    crop = a[y0:y1, x0:x1].copy()
    m = solid[y0:y1, x0:x1].copy()
    # tira pedacinhos de quadros vizinhos que entraram no recorte
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    if n > 2:
        biggest = st[1:, cv2.CC_STAT_AREA].max()
        for i in range(1, n):
            if st[i, cv2.CC_STAT_AREA] < biggest * 0.08:
                m[lab == i] = 0
    crop[..., 3] = np.where(m > 0, 255, 0)
    ys, xs = np.nonzero(crop[..., 3])
    crop = crop[ys.min(): ys.max() + 1, xs.min(): xs.max() + 1]
    Image.fromarray(crop).save(path)
    return {'w': int(crop.shape[1]), 'h': int(crop.shape[0]), 'footX': foot_x(crop[..., 3])}


def foot_x(alpha):
    """Centro dos pés (linhas de baixo): âncora horizontal estável entre quadros."""
    h = alpha.shape[0]
    rows = alpha[int(h * 0.88):]
    cols = np.nonzero(rows.sum(0))[0]
    return int((cols.min() + cols.max()) / 2) if len(cols) else alpha.shape[1] // 2


# ── inimigos ──
out_e = os.path.join(ROOT, 'public', 'sprites', 'enemies')
os.makedirs(out_e, exist_ok=True)
emeta = {}
for kind, reg in ENEMIES.items():
    cs = comps(*reg, min_area=600)
    # quadros grudados um sobre o outro: separa pela linha mais vazia
    fixed = []
    for c in cs:
        h = c[3] - c[1]
        occ = solid[c[1]:c[3], c[0]:c[2]].sum(1)
        mid = h // 2
        window = occ[max(0, mid - 30): mid + 30]
        # só separa quando há uma faixa praticamente vazia entre dois quadros (não corta a pose grande)
        # no "knife" dois quadros pequenos se encostam (um em cima do outro): separa na linha mais estreita
        stacked = kind == 'knife' and h > 150 and (c[2] - c[0]) < 100
        if h > 150 and len(window) and (window.min() <= 8 or stacked):
            cut = c[1] + max(0, mid - 30) + int(np.argmin(window))
            fixed += [[c[0], c[1], c[2], cut, 1], [c[0], cut, c[2], c[3], 1]]
        else:
            fixed.append(c)
    big = max(fixed, key=lambda c: (c[3] - c[1]) * (c[2] - c[0]))
    small = sorted([c for c in fixed if c is not big], key=lambda c: (round(c[1] / 60), c[0]))
    frames = [big] + small[:4]
    emeta[kind] = []
    for i, c in enumerate(frames):
        info = save(c, os.path.join(out_e, f'{kind}_{i}.png'))
        emeta[kind].append({'file': f'{kind}_{i}.png', **info, '_bottom': int(c[3]), '_row': 0 if i == 0 else round(c[3] / 70)})
    # quadros na mesma fileira do modelo dividem a mesma linha do chão
    for f in emeta[kind]:
        row = [g for g in emeta[kind] if g['_row'] == f['_row'] and (g is f or f is not emeta[kind][0])]
        ground = max(g['_bottom'] for g in row)
        f['base'] = int(f['h'] + (ground - f['_bottom']))
    for f in emeta[kind]:
        f.pop('_bottom')
        f.pop('_row')
with open(os.path.join(out_e, 'enemies.json'), 'w') as f:
    json.dump(emeta, f, indent=1)

# ── objetos ──
out_p = os.path.join(ROOT, 'public', 'sprites', 'props')
os.makedirs(out_p, exist_ok=True)
pmeta = {}
for reg, names in PROPS:
    cs = sorted(comps(*reg, min_area=150), key=lambda c: c[0])
    # junta pedacinhos soltos ao objeto mais próximo
    cs = [c for c in cs if (c[2] - c[0]) * (c[3] - c[1]) > 900] or cs
    while len(cs) < len(names):
        widest = max(cs, key=lambda c: c[2] - c[0])
        i = cs.index(widest)
        need = len(names) - len(cs) + 1
        cs[i:i + 1] = split_cols(widest, min(need, 2 if len(names) - len(cs) == 1 else need))
        cs.sort(key=lambda c: c[0])
    while len(cs) > len(names):
        # mais pedaços que nomes: une os dois mais próximos
        gaps = [(cs[i + 1][0] - cs[i][2], i) for i in range(len(cs) - 1)]
        _, i = min(gaps)
        m = [min(cs[i][0], cs[i + 1][0]), min(cs[i][1], cs[i + 1][1]), max(cs[i][2], cs[i + 1][2]), max(cs[i][3], cs[i + 1][3]), 0]
        cs[i:i + 2] = [m]
    for name, c in zip(names, cs):
        pmeta[name] = {'file': f'{name}.png', **save(c, os.path.join(out_p, f'{name}.png'))}
with open(os.path.join(out_p, 'props.json'), 'w') as f:
    json.dump(pmeta, f, indent=1)
print({k: len(v) for k, v in emeta.items()}, len(pmeta), 'objetos')
