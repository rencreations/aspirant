import cv2, numpy as np
base = cv2.cvtColor(cv2.imread('f/r_0.0.png'), cv2.COLOR_BGR2GRAY)
patches = {'tower': (20, 150, 140, 290), 'star': (600, 5, 820, 110), 'ringR': (420, 270, 560, 330)}
for t in ['8.0','8.5','9.0','9.5','10.0','10.5','30.4','30.8','31.4','32.0','32.5']:
    im = cv2.cvtColor(cv2.imread(f'f/t_{t}.png'), cv2.COLOR_BGR2GRAY); out = []
    for n, (x0,y0,x1,y1) in patches.items():
        tpl = base[y0:y1, x0:x1]; r = cv2.matchTemplate(im, tpl, cv2.TM_CCOEFF_NORMED); _, mx, _, loc = cv2.minMaxLoc(r)
        out.append(f'{n} shift ({loc[0]-x0},{loc[1]-y0}) cc {mx:.2f}')
    print(t, ' | '.join(out))
