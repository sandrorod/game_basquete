"""Estabiliza o drible parado: os quadros da folha foram desenhados com o corpo em posições um pouco diferentes,
e no jogo isso parecia o jogador tremendo. Alinha cada quadro ao primeiro pelas pernas e pela cabeça
(correlação de fase; braços e bola mudam, então ficam de fora) e corrige footX/base em hero.json.
Rodar depois de dribble_ball.py.
Uso: python3 tools/stabilize_dribble.py
"""
import json
import os

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, 'public', 'sprites', 'hero')
GROUPS = ['dribble', 'look', 'spin']
meta = json.load(open(os.path.join(D, 'hero.json')))
CW, CH = 420, 360


def canvas(f):
    """Quadro colado numa tela fixa, com os pés no mesmo ponto (como o jogo desenha)."""
    a = np.array(Image.open(os.path.join(D, f['file'])).convert('RGBA')).astype(np.float32)
    c = np.zeros((CH, CW), np.float32)
    x0, y0 = CW // 2 - f['footX'], CH - 10 - f['base']
    gray = a[:, :, :3].mean(2) * (a[:, :, 3] > 0)
    h, w = gray.shape
    c[max(0, y0):y0 + h, max(0, x0):x0 + w] = gray[max(0, -y0):, max(0, -x0):][: CH - max(0, y0), : CW - max(0, x0)]
    return c


def zones(c, base):
    """Só cabeça e pernas (os braços e a bola mexem de propósito)."""
    m = np.zeros_like(c)
    top = CH - 10 - base
    m[top: top + int(base * 0.16)] = 1
    m[top + int(base * 0.62):] = 1
    win = cv2.createHanningWindow((CW, CH), cv2.CV_32F)
    return c * m * win


for g in GROUPS:
    frames = meta[g]
    ref = zones(canvas(frames[0]), frames[0]['base'])
    for f in frames[1:]:
        (dx, dy), _ = cv2.phaseCorrelate(ref, zones(canvas(f), f['base']))
        f['footX'] = int(round(f['footX'] + dx))
        f['base'] = int(round(f['base'] + dy))
    print(g, [(f['footX'], f['base']) for f in frames])
json.dump(meta, open(os.path.join(D, 'hero.json'), 'w'), indent=1)
