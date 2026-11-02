# Feature map: Image Tool 1.0.0 (explored from source and a live run)

| Feature | Where | Notes |
|---|---|---|
| Choose / drop image | `#pickBtn`, `#drop` | JPG PNG WEBP BMP TIFF GIF. Native dialog. |
| Image details | `#fileName`, `#imageInfo` | "W×H · TYPE · size" |
| Resize | `#resizeMode`, `#resizeValue` | width, height, percent |
| Image type | `#format` | JPG PNG WEBP BMP TIFF GIF |
| Compress | `#compress`, `#quality`, `#palette` | only when not resizing; quality for JPG/WEBP; 256 colors for PNG |
| Process | `#runBtn` | output saved next to original, never overwrites |
| Result | `#resultText`, `#resultImg`, `#showBtn` | sizes, preview, Show in folder |

Not shown (out of scope for a 60-90 s overview): height/percent resize, PNG palette, CLI, installers.
