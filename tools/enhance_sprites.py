"""Melhora os sprites (herói, inimigos, chefes, objetos, prêmios) com a rede EDSR ×4 (OpenCV dnn_superres):
1. limpa pontinhos soltos (pedaços pequenos separados do corpo);
2. estende as cores das bordas para o fundo transparente (a rede não mancha o contorno com a cor do fundo);
3. amplia a cor ×4 com a EDSR e a transparência com interpolação suave + corte nítido;
4. grava em 2× (resolução que o jogo usa em telas de celular) e atualiza w/h/footX/base no JSON.
Os originais ficam em art/sprites_src/ (o script sempre parte deles; pode rodar de novo).
Uso: python tools/enhance_sprites.py CAMINHO/EDSR_x4.pb [pasta...]
"""
import json
import os
import shutil
import sys

import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, 'public', 'sprites')
SRC = os.path.join(ROOT, 'art', 'sprites_src')
SCALE = 2
GROUPS = {'hero': 'hero.json', 'enemies': 'enemies.json', 'bosses': 'bosses.json', 'props': 'props.json', 'items': 'items.json'}

sr = cv2.dnn_superres.DnnSuperResImpl_create()
sr.readModel(sys.argv[1])
sr.setModel('edsr', 4)


def clean(rgba):
    a = (rgba[:, :, 3] > 0).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(a, 8)
    if n > 2:
        big = st[1:, cv2.CC_STAT_AREA].max()
        for i in range(1, n):
            if st[i, cv2.CC_STAT_AREA] < max(6, big * 0.004):
                rgba[lab == i, 3] = 0
    return rgba


def bleed(rgb, alpha, steps=6):
    """Espalha as cores das bordas para o fundo transparente (evita halo escuro na ampliação)."""
    rgb = rgb.astype(np.float32)
    known = alpha > 0
    for _ in range(steps):
        k = known.astype(np.float32)
        s = cv2.blur(rgb * k[:, :, None], (3, 3))
        c = cv2.blur(k, (3, 3))
        grow = (~known) & (c > 0)
        rgb[grow] = s[grow] / c[grow][:, None]
        known = known | grow
    return rgb.clip(0, 255).astype(np.uint8)


def enhance(path_in, path_out):
    rgba = cv2.imread(path_in, cv2.IMREAD_UNCHANGED)
    if rgba.shape[2] == 3:
        rgba = np.dstack([rgba, np.full(rgba.shape[:2], 255, np.uint8)])
    rgba = clean(rgba)
    pad = 4
    rgba = cv2.copyMakeBorder(rgba, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=(0, 0, 0, 0))
    rgb = bleed(rgba[:, :, :3], rgba[:, :, 3])
    up = sr.upsample(rgb)
    h, w = rgba.shape[:2]
    a_up = cv2.resize(rgba[:, :, 3], (w * 4, h * 4), interpolation=cv2.INTER_CUBIC).astype(np.float32)
    a_up = np.clip((a_up - 70) * 2.2, 0, 255)
    out = np.dstack([up, a_up.astype(np.uint8)])
    out = cv2.resize(out, (w * SCALE, h * SCALE), interpolation=cv2.INTER_AREA)
    p = pad * SCALE
    out = out[p:-p, p:-p]
    cv2.imwrite(path_out, out)


groups = sys.argv[2:] or list(GROUPS)
for g in groups:
    src_dir, pub_dir = os.path.join(SRC, g), os.path.join(PUB, g)
    if not os.path.exists(src_dir):
        shutil.copytree(pub_dir, src_dir)
    meta = json.load(open(os.path.join(src_dir, GROUPS[g])))
    frames = [f for v in meta.values() for f in (v if isinstance(v, list) else [v])]
    for f in frames:
        enhance(os.path.join(src_dir, f['file']), os.path.join(pub_dir, f['file']))
        for k in ('w', 'h', 'footX', 'base'):
            if k in f:
                f[k] = int(f[k] * SCALE)
    json.dump(meta, open(os.path.join(pub_dir, GROUPS[g]), 'w'), indent=1)
    print(g, len(frames), 'quadros', flush=True)
