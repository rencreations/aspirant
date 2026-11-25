# The 3D Models room (`scripts/library/models/`)

The room `/collection/models` was rebuilt on 25 Nov 2026 (the owner's words: `docs/superpowers/specs/2026-11-25-models-room-request.md`, the contract between these scripts and the room: `...-models-room-redesign.md`). Every view of the room is one GLB file in the R2 bucket under `models/v1/`, made here into the mirror `D:\ren\aspirant-r2\library\v1\models\v1\`.

| Folder or file     | Makes                                                                                                                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entries.json`     | The list: fifteen entries in the owner's order, their views (id, label, camera mode, behaviour), the clips each view lists and the turn an item opens with. Written by hand: it is the source. |
| `selena-entrance/` | `selena-entrance.glb`: Selena and Silverbolt, the fourteen entrance clips, the cameras fitted to the game's recordings, the sticker's place. README there.                                     |
| `selena-in-game/`  | `selena-in-game.glb` (both forms and the timing of the change), `selena-phone.glb`, `silverbolt.glb`. README there.                                                                            |
| `parts/`           | The characters and their items, one file a view, and the Aspirant Drone. README there.                                                                                                         |
| `build.mjs`        | The rest: the companions (the About page's `companion.glb`, `bunny.glb` and `tetra.glb`, copied byte for byte), the sticker, the posters and `apps/web/public/data/library/models.json`.       |
| `posters/`         | The page `build.mjs` renders the posters in (the site's three, the room's light, a clear ground).                                                                                              |

## How to run

```
node scripts/library/models/selena-entrance/build.mjs      # see each folder's README for its own options
node scripts/library/models/selena-in-game/build.mjs
node scripts/library/models/parts/build.mjs
node scripts/library/models/build.mjs                      # companions, sticker, posters, manifest (and build_index.py)
python scripts/library/r2.py sync library/v1/models        # upload
```

`build.mjs` takes step names (`companions sticker posters manifest`), `--only=<view,view>` for the posters, and `--partial` for the manifest. `--partial` leaves out a view whose file is not made yet, with a warning: it is for working on the room while a pipeline runs, never for a release. The manifest runs `scripts/library/build_index.py` (the search and the counts).

Never edit the data file or the mirror by hand. A file changed under the same key is cached for 30 days by the bucket: make a new folder (`models/v2/`) and change `PREFIX` here and the keys the room reads from the data.

## Sources (read only)

- `D:\ren\aspirant\3d\` (the rigged and single mesh conversions, `selena_silverbolt_raiko\`), never `obsidia\` (the owner's call).
- `C:\Users\muham\Downloads\3d\` (the owner's original downloads), and the game client files the first room showed (`library/v1/others/3d/` in the mirror).
- `C:\Users\muham\Downloads\vs.png` (the sticker).
- The recordings in `D:\ren\aspirant\media\_others\in-game-animation\selena\` (the cameras are fitted to them).
- `apps/web/public/models/about/{companion,bunny,tetra}.glb` (made by `scripts/about/`).
