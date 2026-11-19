import sys; sys.path.insert(0, "D:/ren/aspirant-work/home/CAM-landscape")
from PIL import Image
import numpy as np
shot, rec, out = sys.argv[1], sys.argv[2], sys.argv[3]
s = Image.open(shot).convert('RGB'); print(s.size)
w, h = s.size
fh = int(round(w/ (3840/1728)))
y0 = (h - fh)//2
crop = s.crop((0, y0, w, y0+fh))
r = Image.open(rec).convert('RGB').resize(crop.size)
blend = Image.blend(crop, r, 0.5)
sheet = Image.new('RGB', (w, fh*3)); sheet.paste(r, (0,0)); sheet.paste(crop, (0,fh)); sheet.paste(blend, (0,2*fh))
sheet.save(out)
