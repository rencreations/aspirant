import bpy, json, sys
PREFIX = "selena_silverbolt_raiko_entrance_"
out = {}
for a in bpy.data.actions:
    n = a.name.replace(PREFIX, "")
    if not n.startswith("cam_"): continue
    curves = {(c.data_path, c.array_index): c for c in a.fcurves}
    fr = int(round(a.frame_range[1]))
    rows = []
    for f in range(1, fr+1):
        rows.append([curves[("location",k)].evaluate(f) for k in range(3)] + [curves[("rotation_euler",k)].evaluate(f) for k in range(3)])
    out[n] = rows
json.dump(out, open(sys.argv[sys.argv.index("--")+1], "w"))
print("DUMPED", len(out))
