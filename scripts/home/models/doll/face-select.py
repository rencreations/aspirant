"""Chooses the triangles of the doll's face and writes them to curation/face-tris.json.

    C:\\Users\\muham\\anaconda3\\python.exe -I scripts\\home\\models\\doll\\face-select.py DUMP.json OUT.json

DUMP.json is written by `node scripts/home/models/doll/build.cjs --dump DIR` (the source mesh as a
soup of 14,385 triangles, in the FBX's centimetres). OUT.json is the list of the triangle numbers.
The face is not one piece of the mesh: the hair, the bangs and the skin are welded into one shell and
the face is painted on a chart-soup atlas, so the choice is made in three steps, then corrected by
hand with `curation/face-edits.json` (triangle numbers to add and to remove, each with its reason):

1. the skull's front surface: for every 1 cm cell of the front, the deepest front-facing triangle;
   a triangle within `DEPTH_TOLERANCE` of that surface is the skin or something painted on it;
2. the paint: a triangle whose picture is the pink of the hair (not the skin, the lashes, the
   irises or the white of the eye) is dropped, so the bangs that lie on the face stay out;
3. one pass of neighbour voting: a hole in the selection whose neighbours are selected is filled,
   a selected triangle with no selected neighbour is dropped.

The numbers a triangle has here are the order of the FBX loader's triangle soup, which never
changes for this file: the list stays valid for every rebuild.
"""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

BASE_PNG = Path(
    r"D:\ren\aspirant\3d\obsidia\Meshy_AI_chibi_boxer_doll_rigged_20261117_animated_mixamo_Walking"
    r"\Meshy_AI_chibi_boxer_doll_rigged_20261117_animated_mixamo_Walking.png"
)
HERE = Path(__file__).resolve().parent

# The front of the head in the file's centimetres (feet at y 0, front +Z): the doll's centre line
# is at x about 3.7. These bound where a face triangle can be.
BOX = dict(x=(-46.0, 56.0), y=(66.0, 118.0), z_min=6.0)
CELL = 1.0
DEPTH_TOLERANCE = 1.6


def load(dump_path):
    d = json.load(open(dump_path))
    pos = np.array(d["position"]).reshape(-1, 3)
    uv = np.array(d["uv"]).reshape(-1, 2)
    nrm = np.array(d["normal"]).reshape(-1, 3)
    t = len(pos) // 3
    return pos.reshape(t, 3, 3), uv.reshape(t, 3, 2), nrm.reshape(t, 3, 3)


def triangle_colours(uv):
    base = np.asarray(Image.open(BASE_PNG).convert("RGB"))
    h, w = base.shape[:2]
    out = np.zeros((len(uv), 3), float)
    # the mean of the centroid and the three corners pulled toward the centre (avoids the gutter)
    centre = uv.mean(1)
    for k, p in enumerate([centre] + [centre + (uv[:, i] - centre) * 0.5 for i in range(3)]):
        x = np.clip((p[:, 0] * w).astype(int), 0, w - 1)
        y = np.clip(((1 - p[:, 1]) * h).astype(int), 0, h - 1)
        out += base[y, x]
    return out / 4


def neighbours(tp):
    """For every triangle, the triangles that share an edge (matched by position)."""
    key = np.round(tp * 1000).astype(np.int64)
    ids = {}
    vid = np.zeros(tp.shape[:2], int)
    for t in range(len(tp)):
        for k in range(3):
            kk = tuple(key[t, k])
            vid[t, k] = ids.setdefault(kk, len(ids))
    edges = {}
    for t in range(len(tp)):
        for k in range(3):
            a, b = vid[t, k], vid[t, (k + 1) % 3]
            edges.setdefault((min(a, b), max(a, b)), []).append(t)
    nb = [set() for _ in range(len(tp))]
    for tris in edges.values():
        for a in tris:
            for b in tris:
                if a != b:
                    nb[a].add(b)
    return nb


def select(tp, uv, nrm):
    cen = tp.mean(1)
    n = nrm.mean(1)
    inbox = (
        (cen[:, 0] > BOX["x"][0])
        & (cen[:, 0] < BOX["x"][1])
        & (cen[:, 1] > BOX["y"][0])
        & (cen[:, 1] < BOX["y"][1])
        & (cen[:, 2] > BOX["z_min"])
    )
    # Geometric front-facing: by the triangle's own winding, not the file's normals.
    geo = np.cross(tp[:, 1] - tp[:, 0], tp[:, 2] - tp[:, 0])
    geo /= np.maximum(np.linalg.norm(geo, axis=1)[:, None], 1e-9)
    front = geo[:, 2] > 0.05
    cand = np.where(inbox & front)[0]

    xs = np.arange(BOX["x"][0], BOX["x"][1] + CELL, CELL)
    ys = np.arange(BOX["y"][0], BOX["y"][1] + CELL, CELL)
    zmin = np.full((len(ys), len(xs)), np.nan)
    for i in cand:
        for v in tp[i]:
            gx = int((v[0] - BOX["x"][0]) / CELL)
            gy = int((v[1] - BOX["y"][0]) / CELL)
            if 0 <= gx < len(xs) and 0 <= gy < len(ys):
                if np.isnan(zmin[gy, gx]) or v[2] < zmin[gy, gx]:
                    zmin[gy, gx] = v[2]
    from scipy import ndimage

    valid = ~np.isnan(zmin)
    filled = zmin.copy()
    idx = ndimage.distance_transform_edt(~valid, return_distances=False, return_indices=True)
    filled = zmin[tuple(idx)]
    surface = ndimage.median_filter(filled, size=7, mode="nearest")

    def surf(x, y):
        gx = np.clip(((x - BOX["x"][0]) / CELL).astype(int), 0, len(xs) - 1)
        gy = np.clip(((y - BOX["y"][0]) / CELL).astype(int), 0, len(ys) - 1)
        return surface[gy, gx]

    sel = np.zeros(len(tp), bool)
    for i in cand:
        ok = True
        for v in tp[i]:
            if v[2] - surf(np.array([v[0]]), np.array([v[1]]))[0] > DEPTH_TOLERANCE:
                ok = False
                break
        sel[i] = ok
    print("depth layer", int(sel.sum()), "of", len(cand), "candidates")

    # 2. the paint: the pink of the hair is not the face.
    colour = triangle_colours(uv)
    r, g, b = colour[:, 0], colour[:, 1], colour[:, 2]
    hair = (g < 176) & (r - g > 18) & (b > 150) & (b - g > 5)
    # Eyes are red and blue: the red iris has r far over g and b, the blue iris the reverse.
    iris = ((r - g > 70) & (r - b > 70)) | ((b - r > 35) & (b - g > 0))
    dark = colour.mean(1) < 120
    sel &= ~(hair & ~iris & ~dark)
    print("after the hair colour", int(sel.sum()))
    return sel, surf


def vote(sel, nb, passes=2):
    sel = sel.copy()
    for _ in range(passes):
        count = np.array([sum(sel[j] for j in nb[i]) for i in range(len(sel))])
        total = np.array([max(len(nb[i]), 1) for i in range(len(sel))])
        fill = (~sel) & (count / total >= 0.67) & (count >= 2)
        drop = sel & (count == 0)
        sel = (sel | fill) & ~drop
    return sel


def components(sel, nb):
    """Labels the selected triangles by the piece they hang together in (by shared edges)."""
    label = -np.ones(len(sel), int)
    sizes = []
    for start in np.where(sel)[0]:
        if label[start] >= 0:
            continue
        k = len(sizes)
        stack = [start]
        label[start] = k
        n = 0
        while stack:
            t = stack.pop()
            n += 1
            for j in nb[t]:
                if sel[j] and label[j] < 0:
                    label[j] = k
                    stack.append(j)
        sizes.append(n)
    return label, sizes


def dark_samples(uv):
    """How many of ten points inside each triangle's picture are black paint (lash, lid, brow)."""
    base = np.asarray(Image.open(BASE_PNG).convert("RGB")).astype(float)
    h, w = base.shape[:2]
    bary = np.array(
        [(1 / 3, 1 / 3, 1 / 3), (0.6, 0.2, 0.2), (0.2, 0.6, 0.2), (0.2, 0.2, 0.6), (0.8, 0.1, 0.1),
         (0.1, 0.8, 0.1), (0.1, 0.1, 0.8), (0.5, 0.5, 0.0), (0.0, 0.5, 0.5), (0.5, 0.0, 0.5)]
    )
    count = np.zeros(len(uv), int)
    for b in bary:
        p = (uv * b[None, :, None]).sum(1)
        x = np.clip((p[:, 0] * w).astype(int), 0, w - 1)
        y = np.clip(((1 - p[:, 1]) * h).astype(int), 0, h - 1)
        count += base[y, x].mean(1) < 100
    return count


def relief(tp, uv, sel, nb, surface_of):
    """Triangles that stand off the face and belong to it: dark lash, lid and brow pieces."""
    from scipy.spatial import cKDTree

    colour = triangle_colours(uv)
    cen = tp.mean(1)
    tree = cKDTree(cen[sel][:, :2])
    dist, _ = tree.query(cen[:, :2])
    dark = colour.mean(1) < 125
    height = cen[:, 2] - surface_of(cen[:, 0], cen[:, 1])
    near = (dist < 4.5) & (~sel) & (cen[:, 1] > BOX["y"][0]) & (cen[:, 2] > BOX["z_min"])
    partly = dark_samples(uv) >= 2
    cand = near & (dark | partly) & (height < 9.0)
    return np.where(cand)[0], height


def main():
    dump, out = sys.argv[1], sys.argv[2]
    tp, uv, nrm = load(dump)
    sel, surf = select(tp, uv, nrm)
    nb = neighbours(tp)
    sel = vote(sel, nb)
    label, sizes = components(sel, nb)
    biggest = int(np.argmax(sizes))
    print("pieces", sorted(sizes, reverse=True)[:12], "kept", sizes[biggest])
    sel = label == biggest
    cen = tp.mean(1)
    for k, n in enumerate(sizes):
        if k != biggest and n >= 8:
            m = label == k
            print("  dropped piece", n, "at", np.round(cen[m].mean(0), 1))
    rel, height = relief(tp, uv, sel, nb, surf)
    print("relief triangles", len(rel), "heights above the surface cm: min %.1f median %.1f max %.1f" % (height[rel].min(), np.median(height[rel]), height[rel].max()) if len(rel) else "")
    edits_path = HERE / "curation" / "face-edits.json"
    relief_set = set(int(i) for i in rel)
    if edits_path.exists():
        edits = json.load(open(edits_path))
        for row in edits.get("add", []):
            sel[row["tris"]] = True
        for row in edits.get("remove", []):
            sel[row["tris"]] = False
        for row in edits.get("addRelief", []):
            relief_set.update(row["tris"])
        for row in edits.get("removeRelief", []):
            relief_set.difference_update(row["tris"])
    face = [int(i) for i in np.where(sel)[0]]
    print("face triangles", len(face), "relief", len(relief_set))
    # Where each corner of a relief triangle goes when the build flattens it onto the face (cm).
    relief_z = {}
    for t in sorted(relief_set):
        relief_z[str(t)] = [round(float(surf(np.array([v[0]]), np.array([v[1]]))[0]), 4) for v in tp[t]]
    json.dump({"face": face, "relief": sorted(relief_set), "reliefZ": relief_z}, open(out, "w"))


if __name__ == "__main__":
    main()
