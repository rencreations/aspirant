import sys; sys.path.insert(0, "D:/ren/aspirant-work/home/CAM-landscape")
from splat import *
from solve import *
import json
clip, rec, out = sys.argv[1], sys.argv[2], sys.argv[3]
C = np.array(json.loads(sys.argv[4])); rot = np.array(json.loads(sys.argv[5])); vfov = float(sys.argv[6]); shy = float(sys.argv[7]) if len(sys.argv)>7 else 0.0
R = Rot.from_rotvec(rot).as_matrix()
v, col, d = load(clip)
img = render(v, col, C, R, vfov, shy, size=3)
overlay(rec, img, 0.6).save(out)
