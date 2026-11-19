import sys; sys.path.insert(0, "D:/ren/aspirant-work/home/CAM-landscape")
import cv2, numpy as np
sky = cv2.imread('D:/ren/aspirant-work/home/SEL-camera-sky/w/skybox.png')
sift = cv2.SIFT_create(nfeatures=15000, contrastThreshold=0.015)
ks, ds = sift.detectAndCompute(cv2.cvtColor(sky, cv2.COLOR_BGR2GRAY), None)
P, Q = [], []
for rec in ['f/r_20.0.png', 'f/r_0.0.png', 'f/r_36.0.png', 'f/r_43.0.png', 'f/r_2.7.png']:
    r = cv2.imread(rec); kr, dr = sift.detectAndCompute(cv2.cvtColor(r, cv2.COLOR_BGR2GRAY), None)
    m = cv2.BFMatcher().knnMatch(dr, ds, k=2)
    for a, b in m:
        if a.distance < 0.82*b.distance: P.append(kr[a.queryIdx].pt); Q.append(ks[a.trainIdx].pt)
P = np.float32(P); Q = np.float32(Q); print(len(P)); np.savez('matches.npz', P=P, Q=Q)
for th in (5, 8, 12):
    H, m = cv2.findHomography(P, Q, cv2.RANSAC, th, maxIters=20000, confidence=0.9999); print('H', th, int(m.sum())); print(H.round(5).tolist())
    A, m2 = cv2.estimateAffine2D(P, Q, method=cv2.RANSAC, ransacReprojThreshold=th, maxIters=20000); print('A', th, int(m2.sum())); print(A.round(4).tolist())
