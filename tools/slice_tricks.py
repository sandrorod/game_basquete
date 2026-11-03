"""Recorta os truques do herói (art/hero-tricks-sheet.png): passagem entre as pernas e bola girando no dedo.
Fundo preto -> transparente (preenchimento a partir das bordas, para não apagar os contornos escuros).
A folha dos truques tem outro traço (mais detalhado, cores mais claras, outro cabelo). Para ficar igual ao
herói jogando: reduz para a mesma resolução dos quadros do herói, troca a cabeça pela do próprio sprite do jogo,
aproxima as cores da paleta do herói e põe o mesmo contorno escuro.
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
WIDEN = 1.1
# altura do jogador de pé na folha dos truques (1º quadro da bola no dedo)
STANDING_H = 350
# (nome, y0, y1) de cada faixa, abaixo do título azul
SECTIONS = [('legs', 95, 410, 14), ('spin', 535, 945, 1)]


def flood_bg(cell, test=None):
    h, w = cell.shape[:2]
    dark = test(cell) if test else cell.max(2) < 34
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

# A folha dos truques desenha o jogador com outro cabelo e sem óculos: troca a cabeça pela do herói principal.
# Cabeça do herói (quadro, caixa x0,y0,x1,y1 = cabelo até o queixo): de frente e de perfil (olhando para a direita)
HEAD_SRC = {'front': ('idle_0.png', (24, 2, 46, 26)), 'side': ('walk_0.png', (23, 3, 46, 29))}
# Onde fica a cabeça em cada quadro dos truques (caixa do cabelo ao queixo) e qual cabeça usar
HEAD_DST = {
    'legs': [((118, 0, 190, 58), 'side'), ((118, 0, 182, 58), 'front'), ((155, 0, 218, 48), 'side'), ((148, 0, 212, 52), 'side'), ((138, 0, 202, 55), 'side'), ((92, 0, 152, 55), 'front')],
    'spin': [((52, 0, 122, 60), 'front'), ((52, 5, 118, 68), 'front'), ((78, 18, 140, 78), 'front'), ((68, 38, 128, 98), 'front'), ((82, 42, 138, 102), 'front'), ((58, 52, 118, 112), 'front'), ((58, 52, 115, 112), 'front')],
}
SRC_FILES = {}
for key, (fn, _) in HEAD_SRC.items():
    if fn.startswith('art:'):
        # cabeça grande do desenho de corpo inteiro (alta resolução); o fundo azul-escuro vira transparente
        big = np.array(Image.open(os.path.join(ROOT, 'art', fn[4:])).convert('RGB')).astype(int)
        x0, y0, x1, y1 = HEAD_SRC[key][1]
        pad = 6
        cell = big[y0 - pad if y0 >= pad else 0: y1, x0 - pad: x1 + pad]
        bgm = flood_bg(cell, lambda c: (c.max(2) < 75) & (c[:, :, 2] >= c[:, :, 0] - 4))
        rgba = np.dstack([cell, np.where(bgm, 0, 255)]).astype(np.uint8)
        full = np.zeros((big.shape[0], big.shape[1], 4), np.uint8)
        full[y0 - pad if y0 >= pad else 0: y1, x0 - pad: x1 + pad] = rgba
        SRC_FILES[key] = Image.fromarray(full)
    else:
        SRC_FILES[key] = Image.open(os.path.join(OUT, fn)).convert('RGBA')


def swap_head(rgba, box, kind, f=1.0):
    img = Image.fromarray(rgba)
    box = tuple(round(v * f) for v in box)
    fn, (sx0, sy0, sx1, sy1) = HEAD_SRC[kind]
    head = SRC_FILES[kind].crop((sx0, sy0, sx1, sy1))
    x0, y0, x1, y1 = box
    k = (y1 - y0) / (sy1 - sy0)
    hw, hh = max(1, round(head.width * k)), max(1, round(head.height * k))
    head = head.resize((hw, hh), Image.LANCZOS if k < 1 else Image.NEAREST)
    # apaga o cabelo antigo (parte de cima da caixa), depois cola a cabeça nova com o queixo no mesmo lugar
    a = np.array(img)
    # cabelo (parte de cima, largura toda) e rosto (parte de baixo, só o meio: os ombros ficam)
    hair_bottom = y0 + int((y1 - y0) * 0.6)
    m = max(1, round(6 * f))
    a[max(0, y0 - m):hair_bottom, max(0, x0 - m):x1 + m, 3] = 0
    mx = int((x1 - x0) * 0.17)
    a[hair_bottom:y1 - 2, x0 + mx:x1 - mx, 3] = 0
    img = Image.fromarray(a)
    cx = (x0 + x1) // 2
    img.alpha_composite(head, (max(0, cx - hw // 2), max(0, y1 - hh)))
    return np.array(img)
# paleta do herói jogando: média e desvio das cores (LAB) dos quadros parado e andando
_hero_px = []
for lst in ('idle', 'walk'):
    for fr in meta[lst]:
        h = np.array(Image.open(os.path.join(OUT, fr['file'])).convert('RGBA'))
        _hero_px.append(h[h[:, :, 3] > 200][:, :3])
_hero_lab = cv2.cvtColor(np.concatenate(_hero_px)[None].astype(np.uint8), cv2.COLOR_RGB2LAB)[0].astype(np.float32)
HERO_MEAN, HERO_STD = _hero_lab.mean(0), _hero_lab.std(0)
HERO_H = meta['idle'][0]['h']


def match_palette(rgba, amount=0.8):
    """Aproxima as cores da paleta do herói jogando (transferência de média/desvio em LAB)."""
    m = rgba[:, :, 3] > 0
    px = rgba[:, :, :3][m][None].astype(np.uint8)
    lab = cv2.cvtColor(px, cv2.COLOR_RGB2LAB)[0].astype(np.float32)
    mean, std = lab.mean(0), lab.std(0) + 1e-3
    out = (lab - mean) / std * HERO_STD + HERO_MEAN
    out = lab * (1 - amount) + out * amount
    rgb = cv2.cvtColor(out.clip(0, 255).astype(np.uint8)[None], cv2.COLOR_LAB2RGB)[0]
    res = rgba.copy()
    res[:, :, :3][m] = rgb
    return res


def outline(rgba):
    """Contorno escuro de 1 px em volta do personagem (como nos quadros do herói)."""
    a = rgba[:, :, 3] > 0
    pad = np.pad(rgba, ((1, 1), (1, 1), (0, 0)))
    ap = np.pad(a, 1)
    grown = cv2.dilate(ap.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    ring = grown & ~ap
    pad[ring] = (28, 16, 18, 255)
    return pad


F = None
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
    if F is None:
        # fator de redução: o jogador de pé na folha (1º quadro da bola no dedo, 350 px) = altura do herói parado
        F = HERO_H / STANDING_H
    out = []
    for i, (rgba, top, bot) in enumerate(frames):
        # mesma resolução do herói jogando (o quadro de pé dos truques fica da altura do quadro parado do herói)
        im2 = Image.fromarray(rgba)
        im2 = im2.resize((max(1, round(im2.width * F * WIDEN)), max(1, round(im2.height * F))), Image.LANCZOS)
        rgba = np.array(im2)
        rgba[:, :, 3] = np.where(rgba[:, :, 3] > 110, 255, 0)
        box, kind = HEAD_DST[name][i]
        rgba = swap_head(rgba, (box[0] * WIDEN, box[1], box[2] * WIDEN, box[3]), kind, F)
        rgba = match_palette(rgba)
        rgba = outline(rgba)
        fn = f'{name}_{i}.png'
        Image.fromarray(rgba).save(os.path.join(OUT, fn))
        a = rgba[:, :, 3] > 0
        foot = a[int(a.shape[0] * 0.88):]
        c = np.nonzero(foot.any(0))[0]
        out.append({'file': fn, 'w': int(rgba.shape[1]), 'h': int(rgba.shape[0]), 'footX': int((c.min() + c.max()) / 2), 'base': int(round((ground - top) * F)) + 1})
    meta[name] = out
    print(name, len(out), [(f['w'], f['h']) for f in out])
json.dump(meta, open(os.path.join(OUT, 'hero.json'), 'w'), indent=1)
