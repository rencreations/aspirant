"""Monocular depth with Depth-Anything-V2-Small (transformers, CPU).

Run with a venv that has torch, transformers, pillow, numpy:
  python depth.py <in.png> <out.png> [<in2.png> <out2.png> ...]
Writes an 8-bit grayscale PNG, near = white, same size as the input. Raw model output, no post-processing
(the Node side smooths and masks it).
"""
import sys

import numpy as np
from PIL import Image
from transformers import pipeline

pipe = pipeline("depth-estimation", model="depth-anything/Depth-Anything-V2-Small-hf", device=-1)
args = sys.argv[1:]
for i in range(0, len(args), 2):
    src, dst = args[i], args[i + 1]
    im = Image.open(src).convert("RGB")
    out = pipe(im)
    d = np.array(out["predicted_depth"].squeeze().cpu() if hasattr(out["predicted_depth"], "cpu") else out["predicted_depth"], dtype=np.float32)
    d = np.array(Image.fromarray(d).resize(im.size, Image.BICUBIC), dtype=np.float32)
    d = (d - d.min()) / max(1e-6, d.max() - d.min())
    Image.fromarray((d * 255).astype(np.uint8), "L").save(dst)
    print("depth ok", src, "->", dst, flush=True)
