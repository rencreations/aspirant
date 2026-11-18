# The kite of the home page (`scripts/home/kite/`)

Tetra's chibi picture as the sail of the kite she flies, and three small bows for its tail.

| File                                      | What it is                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| `apps/web/public/img/home/kite.webp`      | The sail: 630 by 859, WebP with alpha, 68,762 bytes.                          |
| `apps/web/public/img/home/kite-bows.webp` | A strip of three ribbon bows (pink, lilac, cyan), 96 by 72 each, 6,400 bytes. |
| `apps/web/public/img/home/kite.json`      | Size, aspect, the figure's box and the anchor points of the string, in uv.    |

```
C:\Users\muham\anaconda3\python.exe -I scripts\home\kite\build.py [--source PNG] [--out DIR]
```

The source is `D:\ren\aspirant\media\_all\angela\chibi\tetra.png` (read only, RGBA 1667 by 938). The figure fills 610 by 839 of it (x 528 to 1137, y 45 to 883): the build checks that box still holds, trims to it, pads 10 pixels of clear ground so a wave in the vertex shader never shows a straight cut, and **spreads the colour of the edge 24 pixels out under the transparent ground** (the rest takes the mean), so mipmaps and filtering leave no dark rim. The WebP is lossy at 88 with the alpha lossless and the colour under transparent pixels kept (`exact`).

**Aspect 0.7334** (width over height). For a plane 0.22 m wide, 0.30 m tall: `0.22 / 0.30` is 0.733. Anchors in `kite.json`, u from the left and v from the top of the padded picture: the crown `top` (0.5, 0), `bridleTop` (0.5, 0.30) on the hair, `knot` (0.5, 0.52) where the string is tied, `bridleLow` (0.5, 0.72) on the belly, `tail` (0.5, 1.0) at the feet where the ribbon starts, and the two hands `handLeft`, `handRight` (0 and 1, 0.80) for a spar. They were chosen by looking at the picture: the picture is a flat figure, not a kite shape, so a spine and a cross spar are lines the page draws over it.

`kite-bows.webp` is drawn here (a bow of two loops and a knot, ink outline, flat colour); `cells` in `kite.json` gives each one. It is meant to be small: 20 to 30 pixels on the page.
