"""Gera os cenários finais do jogo (public/sprites/stages/stage_N.jpg) a partir dos painéis do modelo.

1. Usa a versão em alta resolução (art/stages_hd/stage_N.png, EDSR ×4, ver upscale_stages.py) reduzida para 3×;
   se ainda não existir, amplia o painel original.
2. Estende o chão para baixo: o painel só tem uma faixa fina de chão. Em vez de esticá-la (fica borrado),
   acha um trecho do chão sem objetos, repete esse trecho (espelhado, sem emenda) e desce com perspectiva
   (fileiras engrossando para a frente). O resultado já tem a proporção da tela: o jogo só escala por igual.
Uso: python3 tools/prepare_stages.py
"""
import os

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'sprites', 'stages')
SRC = os.path.join(ROOT, 'art', 'stages_src')
# fração do painel onde começa o chão (pé das fachadas)
GROUND = {1: 0.8, 2: 0.64, 3: 0.83, 4: 0.83, 5: 0.72, 6: 0.73, 7: 0.78, 8: 0.82, 9: 0.8, 10: 0.8}
# tela lógica: altura 360, pé das fachadas em 236 (+6 de folga, como no jogo)
SCREEN_H, ART_GROUND = 360, 242


def clean_window(strip, width):
    """Coluna inicial do trecho de chão mais "limpo" (menos parecido com objetos): menor desvio da cor típica."""
    col = strip.mean(0)  # cor média por coluna
    med = np.median(col, 0)
    dev = np.abs(col - med).sum(1) + strip.std(0).sum(1) * 0.5
    csum = np.concatenate([[0], np.cumsum(dev)])
    scores = csum[width:] - csum[:-width]
    return int(np.argmin(scores))


for n in range(1, 11):
    hd_path = os.path.join(ROOT, 'art', 'stages_hd', f'stage_{n}.png')
    orig = Image.open(os.path.join(SRC, f'stage_{n}.png')).convert('RGB')
    if os.path.exists(hd_path):
        hd = Image.open(hd_path).convert('RGB')
        im = hd.resize((orig.width * 3, orig.height * 3), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=1.6, percent=55, threshold=2))
    else:
        im = orig.resize((orig.width * 3, orig.height * 3), Image.LANCZOS)
    a = np.array(im).astype(np.float32)
    ph, pw = a.shape[:2]
    ground = GROUND[n] * ph
    total_h = int(round(ground * SCREEN_H / ART_GROUND))
    ext = total_h - ph
    if ext <= 0:
        # o painel já tem chão de sobra: só corta embaixo
        out = a[:total_h].clip(0, 255).astype(np.uint8)
        Image.fromarray(out).save(os.path.join(OUT, f'stage_{n}.jpg'), quality=90)
        print(n, out.shape[1], 'x', out.shape[0], '(cortado)')
        continue
    # textura: metade de baixo da faixa de chão, só o trecho sem objetos, repetido em espelho na largura toda
    r0 = int(ground + (ph - ground) * 0.45)
    strip = a[r0:ph]
    win = max(60, pw // 5)
    x0 = clean_window(strip, win)
    piece = strip[:, x0:x0 + win]
    tiles = []
    for i in range(pw // win + 2):
        tiles.append(piece if i % 2 == 0 else piece[:, ::-1])
    tex = np.concatenate(tiles, 1)[:, :pw]
    sh = tex.shape[0]
    # para baixo: espelhado na vertical (sem emenda), fileiras engrossando até 2,2× (perspectiva)
    rows = []
    v = 0.0
    for y in range(ext):
        u = y / max(1, ext - 1)
        grow = 1 + 1.2 * u
        k = int(v) % (2 * sh)
        src_row = sh - 1 - k if k < sh else k - sh  # começa espelhado (continua a última fileira do painel)
        rows.append(tex[src_row])
        v += 1 / grow
    floor = np.stack(rows, 0)
    # emenda suave com o fim do painel e um leve escurecimento na frente
    blend = min(18, ext)
    for i in range(blend):
        t = i / blend
        floor[i] = floor[i] * t + a[ph - 1] * (1 - t)
    shade = np.linspace(1.0, 0.86, ext)[:, None, None]
    floor = floor * shade
    out = np.concatenate([a, floor], 0).clip(0, 255).astype(np.uint8)
    Image.fromarray(out).save(os.path.join(OUT, f'stage_{n}.jpg'), quality=90)
    print(n, out.shape[1], 'x', out.shape[0], 'chão limpo em x =', x0, '' if os.path.exists(hd_path) else '(sem HD ainda)')
