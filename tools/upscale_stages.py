"""Aumenta a resolução dos cenários (art/stages_src/stage_N.png) com a rede EDSR ×4 (OpenCV dnn_superres)
e grava em art/stages_hd/stage_N.png. Precisa de opencv-contrib e do modelo EDSR_x4.pb.
Uso: python tools/upscale_stages.py CAMINHO/EDSR_x4.pb
"""
import os
import sys

import cv2

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sr = cv2.dnn_superres.DnnSuperResImpl_create()
sr.readModel(sys.argv[1])
sr.setModel('edsr', 4)
for n in range(1, 11):
    out = os.path.join(ROOT, 'art', 'stages_hd', f'stage_{n}.png')
    if os.path.exists(out):
        continue
    im = cv2.imread(os.path.join(ROOT, 'art', 'stages_src', f'stage_{n}.png'))
    cv2.imwrite(out, sr.upsample(im))
    print('fase', n, flush=True)
