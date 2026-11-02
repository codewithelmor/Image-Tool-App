# Demo plan: Image Tool v1.0.0

- **Type:** Quick overview, target 60-90 s, no chapters.
- **Audience:** colleagues and small-team users who handle photos for documents, wikis and email.
- **Goal after watching:** try the app on one of their own images.
- **Shared where:** internal / README (not uploaded; user approval first).
- **Voice-over:** local-style free TTS, `edge-tts`, voice `en-US-AndrewMultilingualNeural` (stock Microsoft neural voice, no cloning), rate -4%. AI-voice disclosure on the end card.
- **Format:** 1920x1080, 30 fps, H.264/AAC MP4. Captions SRT + VTT. Vertical cut: skipped (the app UI is a landscape window; a 9:16 crop would cut the options panel).
- **App version shown:** 1.0.0 (`app/package.json`), run from source (`npm start`).
- **Test data:** one local illustrated forest image (`C:\demo\forest.jpg`, copy of the user's file). Original untouched. Working folder is `C:\demo\` so no user name appears on screen.

## Story
1. Problem: a photo is too big to share.
2. Solution: open it, see its size and type, resize by width + convert to WEBP, then a compress run at quality 60.
3. Result: preview and Show in folder with before/after sizes.
4. Call to action: try it on your own image.

## Journeys and target seconds
| Journey | Seconds |
|---|---|
| J1 Open an image and read its details | 15 |
| J2 Resize by width and convert to WEBP | 20 |
| J3 Compress at quality 60 | 15 |
| J4 Show in folder, compare sizes | 12 |
| Title card + end card | 3 + 5 |

## Notes
- The native file-open dialog cannot be driven by Playwright; the automation answers it with the demo file path (the "Choose image..." click is real). Disclosed here, not hidden.
