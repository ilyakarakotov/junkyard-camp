#!/usr/bin/env python3
"""Texture QA: measure plate luminance, band sigma, and light direction
against the reference targets the critic established.

Usage: python3 scripts/measure-tex.py shots/tex-rX.png
Targets: plate median L 28-34, flat 0.7-3px band sigma 1.5-4.5,
TL-BR quadrant delta +6..+12 (top-left brighter).
"""
import sys
import numpy as np
from PIL import Image

img = Image.open(sys.argv[1]).convert('RGB')
a = np.asarray(img, dtype=np.float32)
H, W, _ = a.shape
dpr = 3  # shots are DPR3
L = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]

# Plate interior sample boxes (CSS px, TeamSelect layout): card 1 interior
# below the crest, avoiding text: x 60..150, y 300..340 etc. Use a few
# text-free patches inside cards 1..4.
patches_css = [
    (55, 415, 130, 450),   # card1 below name area left
    (255, 415, 330, 450),  # card2
    (55, 700, 130, 735),   # card3
    (255, 700, 330, 735),  # card4
]
meds = []
sigmas = []
for (x0, y0, x1, y1) in patches_css:
    p = L[y0 * dpr:y1 * dpr, x0 * dpr:x1 * dpr]
    meds.append(np.median(p))
    # 0.7-3 CSS px band: difference of gaussians approx via box blurs
    from scipy import ndimage  # noqa
    lo = ndimage.uniform_filter(p, size=int(0.7 * dpr))
    hi = ndimage.uniform_filter(p, size=int(3 * dpr))
    band = lo - hi
    sigmas.append(band.std())

print(f"plate median L: {[round(float(m),1) for m in meds]} (target 28-34)")
print(f"band sigma 0.7-3px: {[round(float(s),2) for s in sigmas]} (target 1.5-4.5)")

# Light direction: card1 quadrants (whole card incl frame, text is symmetric enough)
x0, y0, x1, y1 = 40 * dpr, 250 * dpr, 445 * dpr, 720 * dpr
card = L[y0:y1, x0:x1]
h2, w2 = card.shape[0] // 2, card.shape[1] // 2
TL = card[:h2, :w2].mean()
BR = card[h2:, w2:].mean()
TR = card[:h2, w2:].mean()
print(f"TL-BR: {TL-BR:+.1f} (target +6..+12), TL-TR: {TL-TR:+.1f} (target >0)")
