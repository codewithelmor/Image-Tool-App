# Journeys

## J1 Open an image and read its details
1. Launch app: drop area visible. Check: `#drop` visible.
2. Click Choose image. Check: `#imageSection` visible, `#fileName` = forest.jpg, `#imageInfo` contains 1920×1080 and JPEG.

## J2 Resize by width and convert to WEBP
1. Resize = By width. Check: `#resizeValueBox` visible.
2. Type 800. Check: input value 800.
3. Image type = WEBP. Check: select value webp.
4. Process image. Check: `#result` visible, text contains `forest_resized_800x450_converted.webp`, preview image loaded (naturalWidth 800), output file exists.

## J3 Compress at quality 60
1. Resize = Keep original; type = Keep original. Check: compress checkbox enabled.
2. Tick Compress, quality 60. Check: `#qualityBox` visible.
3. Process. Check: result text contains `forest_compressed.jpg`, size smaller than original, file exists.

## J4 Show in folder
1. Click Show in folder. Check: an Explorer window titled for the demo folder appears, listing 3 files.
