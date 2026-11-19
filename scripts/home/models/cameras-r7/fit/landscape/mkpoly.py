import sys; sys.path.insert(0, "D:/ren/aspirant-work/home/CAM-landscape")
import numpy as np, json
SRC = open("warpfit2.py").read()
MARK = chr(10) + "rng = np.random"
exec(SRC.split(MARK)[0])
C = fit2(Pi, Qi, 3, 0.05, 0.0)   # 10 x 2
dev = np.linalg.norm(feats(G, 3)@C - GQ, axis=1); e = np.linalg.norm(feats(Pi, 3)@C - Qi, axis=1)
print('train median', np.median(e).round(2), 'rms inl', np.sqrt((e[e<15]**2).mean()).round(2), 'max dev', dev.max().round(0))
poly = [round(float(v), 4) for v in C[:,0]] + [round(float(v), 4) for v in C[:,1]]
print(poly)
# corners
for nm, (x, y) in (('tl',(0,0)),('tr',(1920,0)),('bl',(0,864)),('br',(1920,864)),('c',(960,432))):
    print(nm, (feats(np.array([[x,y]],float),3)@C).round(0).tolist())
p='D:/aspirant/scripts/home/models/cameras-r7/fits.json'
d=json.load(open(p)); d.pop('skyPlanar',None); d['skyPoly']=poly
d['skyNote']=("The recording's background is the painting as a flat picture bent by a cubic map (not an equirectangular sky seen through the lens: that "
 "model has no solution, every earlier fit failed on it). The map takes the recording's pixel in the 1920 by 864 frame, x = (px - 960) / 960 and y = (py - 432) / 432, "
 "to the picture's pixel in 1774 by 887: the first 10 numbers are the x coefficients, the next 10 the y coefficients, terms [1, x, y, x2, xy, y2, x3, x2y, xy2, y3]. "
 "Matched with SIFT on five frames of horizontal.mkv (248 inliers, holdout median 5 picture px), pulled to the best affine map where nothing matched (weight 0.05). "
 "`sky` is the rest camera's rotation transposed (her space to the camera). See round7-CAM-landscape.md")
json.dump(d, open(p,'w'), indent=2)
