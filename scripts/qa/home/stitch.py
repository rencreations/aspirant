"""Stitch screenshots into one contact sheet, so a whole walk of the page can be read in one picture.

Usage (the anaconda Python has Pillow; run it with -I):
    C:\\Users\\muham\\anaconda3\\python.exe -I scripts/qa/home/stitch.py out.png COLS SCALE file1.png file2.png ...

COLS is the number of columns, SCALE the size of each tile against its file (0.5 is half). Each tile is
labelled with its file name in the top left corner.
"""

import sys

from PIL import Image, ImageDraw

out, cols, scale = sys.argv[1], int(sys.argv[2]), float(sys.argv[3])
files = sys.argv[4:]
ims = [Image.open(f).convert("RGB") for f in files]
tw = int(ims[0].width * scale)
th = int(ims[0].height * scale)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (cols * tw, rows * th), (30, 30, 30))
draw = ImageDraw.Draw(sheet)
for i, im in enumerate(ims):
    x, y = (i % cols) * tw, (i // cols) * th
    sheet.paste(im.resize((tw, th)), (x, y))
    draw.text((x + 6, y + 6), files[i].split("/")[-1].split("\\")[-1], fill=(255, 0, 90))
sheet.save(out)
print(sheet.size)
