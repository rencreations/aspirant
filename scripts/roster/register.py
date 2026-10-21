import json, subprocess, sys
import numpy as np
from PIL import Image
from skimage.feature import match_template
from skimage.transform import resize
from skimage.filters import sobel, gaussian

CROP = (12, 112, 976, 1050)
SPL = "D:/aspirant/apps/web/public/img/char/%s/splash.webp"
res = {}
for slug in "obsidia selena vexana guinevere lesley".split():
    # a frame from the middle of the recording, cropped like the build does
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "1.0", "-i", f"C:/Users/muham/Videos/frame/{slug}.mkv",
                    "-frames:v", "1", "-vf", "crop=%d:%d:%d:%d" % (CROP[2], CROP[3], CROP[0], CROP[1]), f"v-{slug}.png"], check=True)
    v = np.asarray(Image.open(f"v-{slug}.png").convert("L"), float) / 255
    sp = Image.open(SPL % slug).convert("L")
    SW = 1024
    sp = np.asarray(sp.resize((SW, int(SW * 1152 / 2048))), float) / 255
    sp = sobel(gaussian(sp, 1.0))
    best = (-1, None)
    for s in np.arange(0.05, 0.40, 0.01):  # splash px (of 1024 wide) per video px
        th, tw = int(v.shape[0] * s), int(v.shape[1] * s)
        if th >= sp.shape[0] or tw >= sp.shape[1] or th < 20:
            continue
        t = sobel(gaussian(resize(v, (th, tw), anti_aliasing=True), 1.0))
        m = match_template(sp, t)
        score = m.max()
        if score > best[0]:
            y, x = np.unravel_index(np.argmax(m), m.shape)
            best = (score, (s, x, y, tw, th))
    score, (s, x, y, tw, th) = best
    cx = (x + tw / 2) / SW
    cy = (y + th / 2) / sp.shape[0]
    res[slug] = {"score": round(float(score), 3), "scale": round(float(s), 3), "cx": round(cx, 4), "cy": round(cy, 4),
                 "w": round(tw / SW, 4), "h": round(th / sp.shape[0], 4)}
    print(slug, res[slug], flush=True)
json.dump(res, open("register.json", "w"), indent=1)
