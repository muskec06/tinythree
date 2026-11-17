# Instructions for AI agents

This repo is **tinythree**, a compact 3D scene language (`.t3`) that compiles to Three.js.
When a user asks you to "use tinythree" to make a 3D scene, model or video, follow these steps.

## 1. Set up
```bash
npm install                                   # compiler + token counter
pip install playwright && playwright install chromium   # only if you render video/PNG
# ffmpeg must be on PATH for video
```

## 2. Learn the language
Read [`ai/SYSTEM_PROMPT.md`](ai/SYSTEM_PROMPT.md) (about 1,500 tokens). That is the whole language.
`examples/` shows the style, but write the user's scene yourself; do not copy an example file.

## 3. Write and check the scene
Save it as `out/<name>.t3` (`out/` is git-ignored), then:
```bash
node bin/tinythree.js check out/<name>.t3     # fix every "line N: ..." error and re-run
node bin/tinythree.js build out/<name>.t3 -o out/<name>.html   # interactive page
```

## 4. Render
Give the scene line a duration (`dur=10s`) and a camera move (`anim cam orbit 20s`) if the user wants a video.
```bash
python3 tools/render.py out/<name>.t3 -o out/<name>.png --still 2        # look at this first
python3 tools/render.py out/<name>.t3 -o out/<name>.mp4 --size 1280,720  # video
```
Open the PNG and check it really looks like what was asked. Improve the scene before rendering the video.

## 5. Show the token saving
Write the same scene once more as a compact, idiomatic, hand-written Three.js file, the way you
normally would without tinythree (see `bench/threejs/` for the style; no padding, no extra comments).
Save it as `out/<name>.js`, then:
```bash
node bin/tinythree.js tokens out/<name>.t3 out/<name>.js
```

## 6. Report to the user
Give them the MP4 (and the HTML page), then a short table: tinythree tokens and lines, Three.js
tokens and lines, and the "x fewer tokens" figure from step 5. Mention that the language guide
(`ai/SYSTEM_PROMPT.md`) is read once per conversation and pays for itself after a few scenes,
and that across the repo's benchmark the average is about 3.5x fewer tokens (`bench/RESULTS.md`).
