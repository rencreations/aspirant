# Home round two: R-A (loader, tap gate, intro, hero, aspirants, rows, strip)

Status: in progress. This file is written as the work goes, so a cut-off leaves notes behind.

## 1. The intro (done)

`boot/timeline.ts`: 13.2 s to 8.0 s. Every beat is kept (two Guinevere drones carry the logo and struggle, the normal drone is shocked then helps, the pair pull the logo to 70 percent, a thanks, they leave) and the beats overlap. It is still not skippable (no Skip button, no Escape: checked in `boot/runtime.ts` and `components/home-boot/`).

| beat                              | before         | now          |
| --------------------------------- | -------------- | ------------ |
| the pair come in (`enter`)        | 0.9            | 0.45         |
| the drone sees them (`shock`)     | 1.85           | 1.0          |
| the logo is dropped (`DROP_AT`)   | 3.35           | 1.87         |
| the drone flies under (`helpFly`) | 3.55 to 4.55   | 2.0 to 2.7   |
| the help (`help`)                 | 4.3 to 5.1     | 2.5 to 3.0   |
| the three carry it (`toMiddle`)   | 5.1 to 6.8     | 3.0 to 4.1   |
| the pull starts (`pull`)          | 7.0            | 4.3          |
| the logo grows (`grow`)           | 7.7 to 9.4     | 4.65 to 5.85 |
| the thanks (`thanks`)             | 9.65           | 5.95         |
| the pair leave (`leave`)          | 11.15 to 12.45 | 6.9 to 7.5   |
| end (joint J0)                    | 13.2           | 8.0          |

The struggle, lift and tension curves are the old ones with their keys at 0.58 of the time. `CARRY_ARRIVE` (1.35 s) is how long the pair take to reach the place where the logo hangs. The tests pin the order of the beats, the length (7 to 8.5 s), J0 and the room the pair have.
