"""Recorta os 10 cenários de art/stages-sheet.png em art/stages_src/stage_<n>.png (depois: upscale_stages.py e prepare_stages.py).
Ordem do modelo: coluna da esquerda = fases 1,3,5,7,9; coluna da direita = fases 2,4,6,8,10.
Uso: python3 tools/slice_stages.py
"""
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
im = Image.open(os.path.join(ROOT, 'art', 'stages-sheet.png')).convert('RGB')
ROWS = [(0, 207), (210, 388), (394, 565), (568, 742), (745, 941)]
COLS = [(0, 835), (837, 1672)]
OUT = os.path.join(ROOT, 'art', 'stages_src')
os.makedirs(OUT, exist_ok=True)
pad = 3
for ci, (x0, x1) in enumerate(COLS):
    for ri, (y0, y1) in enumerate(ROWS):
        n = ri * 2 + ci + 1
        im.crop((x0 + pad, y0 + pad, x1 - pad, y1 - pad)).save(os.path.join(OUT, f'stage_{n}.png'))
print('ok')
