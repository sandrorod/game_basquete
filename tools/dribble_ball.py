"""Tira a bola desenhada dos quadros de drible do herói (parado, andando, correndo) e grava onde ela estava.
No jogo, a bola é desenhada à parte, quicando de verdade da mão até o chão (render/spriteAnim.ts).
1. acha a bola em cada quadro (círculo laranja, detecção de Hough; quadro com detecção fora do padrão usa a mediana);
2. apaga a bola; onde ela cobria o corpo (perna atrás), preenche com as cores em volta (inpaint);
3. grava em hero.json, em cada quadro, 'ball': [x, altura da mão, raio] (pixels do quadro).
Rodar depois de slice_hero_extra.py.
Uso: python3 tools/dribble_ball.py
"""
import json
import os

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, 'public', 'sprites', 'hero')
GROUPS = ['dribble', 'walk', 'rundrib']
SKIP = {('rundrib', 6), ('rundrib', 11), ('walk', 8)}
meta = json.load(open(os.path.join(D, 'hero.json')))


def orange_mask(a):
    hsv = cv2.cvtColor(a[:, :, :3], cv2.COLOR_RGB2HSV).astype(int)
    return ((hsv[:, :, 0] >= 5) & (hsv[:, :, 0] <= 21) & (hsv[:, :, 1] > 150) & (hsv[:, :, 2] > 120) & (a[:, :, 3] > 0)).astype(np.uint8) * 255


def candidates(a, base):
    """Círculos laranja candidatos a bola: (x, y, raio, quanto do disco é laranja)."""
    o = orange_mask(a)
    g = cv2.GaussianBlur(o, (5, 5), 0)
    c = cv2.HoughCircles(g, cv2.HOUGH_GRADIENT, dp=1.2, minDist=base * 0.12, param1=80, param2=12, minRadius=int(base * 0.05), maxRadius=int(base * 0.1))
    if c is None:
        return []
    yy, xx = np.mgrid[:a.shape[0], :a.shape[1]]
    out = []
    for x, y, r in c[0][:12]:
        if y < base * 0.3:
            continue
        out.append((float(x), float(y), float(r), o[(xx - x) ** 2 + (yy - y) ** 2 <= r * r].mean() / 255))
    return out


def detect(a, base):
    c = candidates(a, base)
    return max(c, key=lambda b: b[3]) if c else None


def ball_region(a, x, y, r):
    """A bola inteira: laranja e sombra marrom/vermelho-escuro ligados ao centro, dentro de 1,6× o raio."""
    hsv = cv2.cvtColor(a[:, :, :3], cv2.COLOR_RGB2HSV).astype(int)
    ballish = (((hsv[:, :, 0] <= 24) | (hsv[:, :, 0] >= 170)) & (hsv[:, :, 1] > 90) & (a[:, :, 3] > 0)) | ((a[:, :, :3].max(2) < 70) & (a[:, :, 3] > 0))
    yy, xx = np.mgrid[:a.shape[0], :a.shape[1]]
    near = (xx - x) ** 2 + (yy - y) ** 2 <= (r * 1.6) ** 2
    disc = (xx - x) ** 2 + (yy - y) ** 2 <= (r * 1.08) ** 2
    m = (ballish & near).astype(np.uint8)
    n, lab, _, _ = cv2.connectedComponentsWithStats(m, 8)
    cy, cx = int(min(max(y, 0), a.shape[0] - 1)), int(min(max(x, 0), a.shape[1] - 1))
    region = (lab == lab[cy, cx]) if lab[cy, cx] else np.zeros_like(near)
    region = (region & near) | (disc & (a[:, :, 3] > 0))
    return cv2.dilate(region.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0


for g in GROUPS:
    # quadros com defeito no desenho (corrida: pernas rosadas)
    meta[g] = [f for k, f in enumerate(meta[g]) if (g, k) not in SKIP]
    frames = meta[g]
    bad = []
    imgs = [np.array(Image.open(os.path.join(D, f['file'])).convert('RGBA')) for f in frames]
    found = [detect(a, f['base']) for a, f in zip(imgs, frames)]
    # posição relativa ao pé; quadros fora do padrão (muito longe da mediana) usam a mediana
    rel = [None if b is None else ((b[0] - f['footX']) / f['base'], (f['base'] - b[1]) / f['base'], b[2] / f['base']) for b, f in zip(found, frames)]
    ok = [r for r in rel if r]
    mx, mh, mr = (float(np.median([r[i] for r in ok])) for i in range(3))
    # altura da mão: a bola mais alta do drible (quando está na mão)
    hand = float(np.percentile([r[1] for r in ok], 80))
    for i, (a, f) in enumerate(zip(imgs, frames)):
        r = rel[i]
        erase = found[i]
        if r is None or abs(r[0] - mx) > 0.22 or r[1] > hand + 0.15:
            # detecção fora do padrão: o círculo candidato mais perto da posição típica
            tx, ty = f['footX'] + mx * f['base'], f['base'] - mh * f['base']
            cs = candidates(a, f['base'])
            erase = min(cs, key=lambda b: (b[0] - tx) ** 2 + (b[1] - ty) ** 2) if cs else None
            r = (mx, mh, mr)
        if erase:
            x, y, rad, _ = erase
            hole = ball_region(a, x, y, rad) & (a[:, :, 3] > 0)
            keep = (a[:, :, 3] > 0) & ~hole
            # buraco "dentro" do corpo (perna atrás da bola): fecha a silhueta e pinta com as cores em volta
            k = int(rad * 1.3) | 1
            closed = cv2.morphologyEx(keep.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((k, k), np.uint8)) > 0
            fill = hole & closed
            rgb = cv2.inpaint(np.ascontiguousarray(a[:, :, :3]), (hole.astype(np.uint8) * 255), 5, cv2.INPAINT_TELEA)
            a = a.copy()
            a[fill, :3] = rgb[fill]
            a[:, :, 3] = np.where(keep | fill, 255, 0)
            # arcos finos do contorno da bola grudados na mão: o que some com uma abertura 5×5 perto da bola
            yy, xx = np.mgrid[:a.shape[0], :a.shape[1]]
            near = (xx - x) ** 2 + (yy - y) ** 2 <= (rad * 1.9) ** 2
            al = (a[:, :, 3] > 0).astype(np.uint8)
            thick = cv2.dilate(cv2.morphologyEx(al, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)), np.ones((3, 3), np.uint8)) > 0
            a[near & (al > 0) & ~thick, 3] = 0
            # sobras soltas do contorno da bola (arcos finos separados do corpo)
            n, lab, st, _ = cv2.connectedComponentsWithStats((a[:, :, 3] > 0).astype(np.uint8), 8)
            if n > 2:
                big = st[1:, cv2.CC_STAT_AREA].max()
                for j in range(1, n):
                    if st[j, cv2.CC_STAT_AREA] < big * 0.03:
                        a[lab == j, 3] = 0
            Image.fromarray(a).save(os.path.join(D, f['file']))
        else:
            bad.append(i)
        f['ball'] = [round(f['footX'] + r[0] * f['base'], 1), round(hand * f['base'], 1), round(mr * f['base'], 1)]
    # quadro em que a bola não saiu: fica fora da animação
    meta[g] = [f for k, f in enumerate(frames) if k not in bad]
    print(g, 'mão a', round(hand, 2), 'da altura; raio', round(mr, 3), '; quadros sem detecção confiável:', sum(1 for i in range(len(frames)) if rel[i] is None))
json.dump(meta, open(os.path.join(D, 'hero.json'), 'w'), indent=1)
