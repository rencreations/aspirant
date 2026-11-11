# The owner's second round on the rebuilt collection rooms, 11 Nov 2026 (word for word)

Kept as the owner wrote it. The first round is in [2026-11-10-collection-redesign-request.md](2026-11-10-collection-redesign-request.md). How the rooms work is in [`docs/design/collection-rooms.md`](../../design/collection-rooms.md). Typos are the owner's.

> I wanted you to change some things in Collection > Music.
>
> First, when the music are paused or stopped or goes to another track, the disk will back to normal orientation or 0 degree rotation smoothly. Currently the disk will stop midway and the image is flipped, make sure the disk image and the disk is in right orientation everytime.
>
> In the song details, also put logo that will takes to the song's page like spotify, apple music, and youtube. Use their official logo and show it below as an clickable icons.
>
> Remove the download button in the music player above (since there's already download button below). Then change it to button for looping the song infinitely.
>
> Modify some links that goes to our website but in different endpoints. For example when user click some links in "watch", it will take to another endpoints within our website, but when user click back or close it will take to the site's parent for example in collections instead of back to the songs page. I wanted you to implement checking, so that if the links are opened from the /collections/music, when close it will go back to /collections/music instead of another page.
>
> In mobile version, the button on below are too cramped, move the watch to the top (beside collections back button), only change for mobile or smaller screen.
>
> Here are the order of the songs and the one that you needed to show. All of the songs are available from the aspirant official soundtrack in https://www.youtube.com/watch?v=-FO_mSebVk8 or in /collection/video/others/?i=film-selena-and-obsidia-video-music-collection-001-4013351897154849593
>
> The order of the music that will show is
> Gray new world
> Timestamp from video ~3:11
> https://sndo.ffm.to/nbv6a32
> https://open.spotify.com/album/3RqpCLaKIsE0RprxgkQMvy
> https://music.apple.com/id/album/gray-new-world-single/6822303373
> https://www.youtube.com/playlist?list=OLAK5uy_mZimUbXj63eiFE-h9d6836LUeHjw9VJX0
> Watch
> Selena Trailer video
> Day of Ender video
> Soundtrack video (timestamped)
> Lullaby of Oblivion
> Timestamp from video ~0:02
> https://sndo.ffm.to/y54mdda
> https://open.spotify.com/album/3k8oWwDgD1HjsQD7y4eI3x
> https://music.apple.com/id/album/lullaby-of-oblivion-single/6822281114
> https://www.youtube.com/playlist?list=OLAK5uy_m_bzm35RhNtFq9nbbM3jcvFSbocSytUVE
> Watch
> Obsidia Trailer Video
> Day of Ender video
> Soundtrack video (timestamped)
> Cross x Credo: Vexana version
> Timestamp from video ~6:08
> Watch
> Connection Lost video
> Re:Link video
> Soundtrack video (timestamped)
> Cross x Credo: Guinevere version
> Timestamp from video ~7:54
> Watch
> Connection Lost video
> Re:Link video
> Soundtrack video (timestamped)
> Chang'e & Lesley Music
> Timestamp from video ~9:40
> Watch
> Change & Lesley Trailer
> Soundtrack video (timestamped)
> Angela & Ruby Music
> Timestamp from Video ~10:44
> Watch
> Ruby & Angela Trailer
> Ruby Trailer
> Angela Trailer
> Soundtrack video (timestamped)
> We Believe!
> Keep it the same for all
>
> Next, let's talk about /collection/video/films/. Fix some things below.
>
> I wanted you to add button to fullscreen, and it will play in the video player. In full screen. This will also work on mobile, since when in vertical mobile screen, the experience are not really great, so it will be full screen and be horizontal when on mobile or smaller screen.
>
> Also I wanted you to modify the video player. Make the timestamp timeline not snap when there's a button below it. Currently there's a problem for example when user wanted to change volume, the cursor keep snapping to timeline instead of acting normally and go to the volume button, check fo rall.
>
> Make the progress or video timestamp below that user can interact to jump to certain timestamp, make it more clear so user know it's a timeline that they can use to jump or see the video timestamp.
>
> When in index, clicking on empty will unfocus or close the index popup.
>
> When not in whole frame mode, there's a spaces right above and below the video. Just fill it with black instead of gradient.
>
> In mobile, make the index button to be on top beside the collections. This only apply for mobile or smaller screen.
>
> Also in mobile, when user toggling the whole frame on and off, I wanted the overlay text (title, length, etc) be moved smoothly instead of just teleporting, so it will morph into the new positions whether it's whole screen or not. I also want you to think for animations the text will do when user is still scrollin, so when mid scroll or when user wanted to scroll down or up, make sure the text have some kinds of animations that's smooth (so it doesn't just stay and disappear).
>
> In mobile or smaller screen, in index, there's a bug in close button that's too close and doesn't have margin. Also I wanted the films and close to be sticky when on mobile or smaller screen, so when user scroll, it will stick. Also change the layout and make the thumbnail of the video more big and it will cover the whole width, and the title and desc will go below the thumbnail, so the thumbnail is big.
>
> Also make sure that the subtitle is always on by default and will also be on when next visit even when it's turned off before.
>
> In films > others, move the live action to the very top.
>
> Now let's talk about /collection/animation. I will give you things to change in collection/animation below.
>
> First, remove the automatic scroll or automatic goes to next list. Now it will only be by user actions instead of automatically.
>
> Also now, for each characters it will play their themes. Below are the configurations
> Selena - Gray new world
> Obsidia - Lullaby of Oblivion
> Guinevere - Cross x Credo: Guinevere version
> Vexana - Cross x Credo: Vexana version
> Chang'e - Chang'e & Lesley Music
> Lesley - Chang'e & Lesley Music
> Ruby - Ruby & Anglea Music
> Angela - Ruby & Anglea Music
> Layla - We Believe!
> Fanny - We Believe!
> This song will play when on preview or in /collection/animation and inside the page or in /collection/animation/:char.
>
> When the animations is still in welcome, I wanted you to remove every button except the back button. So there's even no skip button for welcome. This only do in beginning or first visit (not the "welcome" button). Then when the welcome animations done, or the character is in the same pose as idle, then the button will appear with smooth animations. Then when user click the action to change into another loop, for example the phone, flight and lean in Selena (for all characters also), I wanted the button to change dynamically based on it's state. So for example when user press the button, it will react immediately and hide other button and shows loading if it's still loading. Then when in it's in the pose looping (for example in flight when in Selena), there will ONLY be one button and that's going back to idle, so it will clearly state which is possible to do and not. Do for all characters also. Then when press welcome, it will play the welcoming animations again and hide all button until the animations is done (no skip). Then when user click the fast action button like Silverbolt, Badge or Right Arm in Selena (do for all characters also), the action button will hide until the animations are done or the pose is like the idle pose. Do for all characters and make sure user doesn't confused is the button pressable or not and which button is interactables, make sure it's dynamic and only shows when it's interactables. Also add a hover animations that's cool while keeping the current button design.
>
> In /collection/animation/, I wanted you to change the background and use this https://reactbits.dev/backgrounds/micro-slats, you can read "C:\Users\muham\Downloads\rbg.txt" and make sure the background is interactables by the cursor and match the color and design for each characters.
>
> Change also the thumbnail or the photo that shows when on that list (photo that shows before the welcoming video start). Change it to each character's splash art, you can see it in D:/ren/aspirant and find the splash art for each character. Crop to make sure the characters are in frame when on smaller screen or mobile.
>
> When on mobile or smaller screen in VERTICAL orientation, I wanted you to move the actions button to bottom. So there will be a button centered on bottom that's easily reachable by fingers and it shows "Actions" on the button, and if clicked, it will opens more options that show the real actions options that user can select. For the screen that the aspect ratio is vertical like in mobile or smaller screen, I wanted you to add full screen button beside the back to collections button, and it will open in fullscreen horizontally if in mobile, and the actions button will back on the right, but with adjusted size for mobile or smaller screen. Also when on vertical or smaller screen like in mobile, add a "whole frame" button that's toggleable like in collection/video/films and it will make the video fit in width instead of height, so user in mobile or smaller screen can see it full. Put the button above beside the fullscreen.
>
> Fix this in /collection mobile or smaller screen. When user click details on a collection page options, the photo overlaps with the search and continue to home button, make sure it doesn't overlap.

(The last line of the message is a note about the working process, not the site, and is left out.)
