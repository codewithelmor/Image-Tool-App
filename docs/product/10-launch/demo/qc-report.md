# QC report: image-tool-overview-v1.0.0.mp4

- File: `docs/product/10-launch/demo/exports/image-tool-overview-v1.0.0.mp4`
- SHA-256: `e99c2b9444b049df7acfa2719e038c012f744e61fac4abbc9d740d274daec1fc`
- App version shown: 1.0.0 (title and end card; matches `app/package.json`), run from source
- **Result: PASS** (0 High, 0 Medium failures; 1 automated WARN reviewed and accepted)

## Automated (check_video.py)
| Check | Result |
|---|---|
| H.264 yuv420p / AAC 48 kHz | PASS |
| 1920x1080, 30 fps, faststart | PASS |
| Length 76.2 s (plan 60-90 s) | PASS |
| Loudness -16.5 LUFS, true peak -4.5 dBTP | PASS |
| Not silent, no black > 2 s | PASS |
| Frozen > 6 s | WARN: 3.3 s title card (no voice by design); 16.0 s and 67.2 s are held screens while narration plays (checked against timeline.json). Accepted. |
| Captions: 19 cues, no overlaps, end before video end, .vtt present | PASS |

## Visual review (3 contact sheets, every 2 s)
| Journey | Steps | Result on screen |
|---|---|---|
| J1 Open image, read details | pick -> details | PASS: forest.jpg, 1920x1080 - JPEG - 612.5 KB |
| J2 Resize 800 wide + WEBP | mode, value, type, process | PASS: forest_resized_800x450_converted.webp, 800x450, 147.7 KB, preview shown |
| J3 Compress quality 60 | reset resize/type, compress, quality, process | PASS: forest_compressed.jpg, 1920x1080, 254.4 KB |
| J4 Show in folder | click, Explorer opens | PASS: Explorer Details view lists 613 / 255 / 148 KB |

All 18 automation steps passed (see `recordings/take2.json`). No private data on any frame: only `C:\demo\` paths, no user name, no notifications or error dialogs. The Windows taskbar (clock, pinned apps) is covered with a solid bar in the Explorer scene.

## Sync and captions
Scene starts match the narration (title 0-3 s, s01 3.0, s02 13.3, s03 27.3, s04 42.9, s05 56.9, end 66.8; actions are scheduled from the audio durations). Captions read from `scenes.json`, so spelling matches the script ("WEBP", "JPEG", "Process", "Compress", "Show in folder" match the UI labels). Caption timing is proportional per scene (not word-aligned); expect about 0.3 s drift.

## Claims
"much smaller file": 147.7 KB vs 612.5 KB. "about forty percent": 254.4 / 612.5 = 41.5%. An earlier draft said "almost no visible difference" (unmeasured); it was removed.

## Notes for the user
- The native file dialog cannot be driven by Playwright; the automation answered it with the demo file. The "Choose image..." click is real. A yellow ring overlay shows where each click happens (recording overlay only, no app code changed).
- Vertical cut: skipped (see demo-plan.md).
- Not checked: playback in other players or a human listen test (the voice choice was made by pitch-variation measurement, not by ear).
