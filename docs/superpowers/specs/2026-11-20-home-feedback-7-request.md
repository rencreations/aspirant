# The owner's seventh message of feedback, 20 Nov 2026 (word for word)

It follows `2026-11-20-home-feedback-6-request.md`. The process rule of the third message still holds: no CI, no test suites, no builds while iterating.

The owner's terms: the **source model** (or "3D model") is `D:\ren\aspirant\3d\selena_silverbolt_raiko\selena_silverbolt_raiko\entrance` (a .blend, a .glb and textures: the rig, the animations, everything); the **video reference** is the folder of in-game recordings `D:\ren\aspirant\media\_others\in-game-animation\selena` (horizontal.mkv has the idle-to-pose, pose-to-idle, idle and pose; vertical.mkv is the portrait version). The video reference is the absolute source of truth for the poses, the camera, the shader and the rendering.

> I wanted you to fix some things in homepage,
>
> I wanted you to remove ALL dynamic background below the character page and just use normal background.
>
> Then let's start from the character page. In the last content in the list, you can see 3d model of selena right. For your context, the source model are in "D:\ren\aspirant\3d\selena_silverbolt_raiko\selena_silverbolt_raiko\entrance" and from now will be called 3d model or source, then there's in game video in "D:\ren\aspirant\media\_others\in-game-animation\selena" and will be called video reference. The video reference have all of the right pose, camera shader, rendering, and so much more according to in game. In the 3d model source, it have all the things starting from rig, animations, and so much more.
>
> First, I wanted you to fix Selena rendering. Currently the rendering ARE BAD. The outline are TOO THICK, make it a LOTS more thinner and make sure the outline DIDN'T DISTURB the model, especially the face. See the video reference on how to render it properly, and you must match the final output EXACTLY like the video reference. Next I will mainly use this terms of animations and all animations are available in source model. Here are the animations that'll be used
>
> Idle-to-pose: selena_silverbolt_raiko_entrance_city_interaction_R
> Pose-to-idle: selena_silverbolt_raiko_entrance_city_interaction_back_R
> Idle: selena_silverbolt_raiko_entrance_city_idle
> Pose: selena_silverbolt_raiko_entrance_city_interaction_R_loop
> Out: selena_silverbolt_raiko_entrance_cam_city_intercation02
> Skybox: "C:\Users\muham\Downloads\skybox.png"
>
> For the camera, it's also have all the animations there with added _*cam_city*_. But the camera pers or position might be wrong, the absolute source of truth is the video reference, I wanted you to match that.
>
> First, apply the skybox and make sure the angle are right to achieve the same background as in the video reference. Then, make sure the 3d model and the skybox are separated, so the cursor follow animation are right for the 3d model and will shows that it's really 3d model instead of pre-render video. Then I wanted you to fix the camera position first for all of the animations. You can see the the video reference, so you can see all animations like idle-to-pose, pose-to-idle, idle and pose all in "D:\ren\aspirant\media\_others\in-game-animation\selena\horizontal.mkv", make sure to see it detailly and match the camera position, angle, focal length, and perspective and so much more and make sure it's 1:1 to the video reference. So when preview in character page, the 3d model will loop using pose animation, then when user scroll more and the frame expand, it will play pose-to-idle to transition, then will play idle on loop. When user scroll up to go back to preview character, it'll play idle-to-pose then when will play pose on loop. Make sure to handle case where user stopped mid scroll and what will happen. Then I wanted you to remove all of the interaction first to the 3D model and remove all interactable, so now the character will only play the animation. Okay now, I wanted you to add only simple interaction for the characters, the interaction are including this when on certain animation
>
> Pose: Head and eyes will follow cursor movement position and it will ONLY move slightly and gently but still visible and not too much. Only that
> Idle-to-pose & pose-to-idle: no interaction
> Idle: Head and eyes will follow cursor movement position and it will ONLY move slightly and gently but still visible and not too much. Silverbolt head will not follow cursor and will stay still. On cursor movement also, it will move or rotate the model slightly, so it's like viewing 3d and moving the angle a little bit and NOT TOO MUCH, only slightly to make user know it's not a pre-render video and is real 3d. Then for the out animation or when user continue to scroll to next section, it will play selena_silverbolt_raiko_entrance_cam_city_intercation02 or out animation. So first I wanted you to see the animation first. So in the animation, you can see the character turn around, and her hand extend. I wanted you to add animations where when her hand extend, then she retract her hand as if she's pulling something from above. Then in the web, I wanted you to make it like she pull a white background from above and match it with the animations, make sure the white canvas are right and some of her fingers in front of the canvas she pull and some behind like in real 3d shapes. Then she will pull the canvas to below and her hand will disappear, then it will load next section.

## What it asks for, by part

**Backgrounds.** Every dynamic backdrop of the sections after the character page (Selena, voices, music, funny, chase, bend, archive, footer) is removed: the plain normal background only.

**Selena's rendering.** The outline is far too thick: make it a lot thinner and make sure it does not disturb the model, above all the face. The final output must match the video reference exactly (shading, colours, outline, everything).

**The animations used** (all in the source model): idle to pose (`city_interaction_R`), pose to idle (`city_interaction_back_R`), idle (`city_idle`), pose (`city_interaction_R_loop`), out (the camera clip `cam_city_intercation02` and the character's matching clip), and the skybox `C:\Users\muham\Downloads\skybox.png`.

**Camera and skybox.** The video reference is the truth for the camera of every animation (position, angle, focal length, perspective): match it 1:1 (the source model's cameras may be wrong). Apply the skybox at the angle that gives the same background as the video; keep the model and the skybox separate so that the cursor moves the model against the background and the visitor sees real 3D, not a pre-rendered video.

**Behaviour.** In the character page's frame she loops the POSE animation. When the visitor scrolls on and the frame expands: pose to idle plays once, then idle loops. Scrolling back up: idle to pose plays, then the pose loops. Define what happens when the visitor stops mid scroll.

**Interaction.** Remove every interaction of the 3D model: she only plays animations. Then add only this: in POSE her head and eyes follow the cursor, only slightly and gently but visible; in IDLE the same, plus Silverbolt's head stays still, plus the whole model turns slightly with the cursor (a small change of viewing angle) so it reads as real 3D; no interaction during the two transitions.

**The out animation.** When the visitor scrolls on to the next section the out animation plays: she turns around and extends her hand. Add: the hand retracts as if pulling something from above. On the web she pulls a WHITE background (a canvas) from above, matched to the animation; some of her fingers are in front of the white canvas and some behind it, as in real 3D. She pulls it down, her hand disappears, and the next section loads.
