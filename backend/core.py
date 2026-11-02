"""
Image processing core: resize, convert and compress images with Pillow.

This module is UI-agnostic: it never prints or prompts. Bad user data is
signalled with ConvertError. Prompts live in cli.py, the JSON-lines protocol
lives in backend.py.

The output is saved next to the source image (unless `output` is given), with
the name of what changed appended to the file name, e.g.:

    photo.jpg -> photo_resized_800x600.jpg
    photo.jpg -> photo_compressed.jpg
    photo.jpg -> photo_converted.png
    photo.jpg -> photo_resized_50pct_converted.webp
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageOps

# Target formats offered to the user: key -> (PIL format, file extension)
FORMATS = {
    "jpg": ("JPEG", ".jpg"),
    "jpeg": ("JPEG", ".jpg"),
    "png": ("PNG", ".png"),
    "webp": ("WEBP", ".webp"),
    "bmp": ("BMP", ".bmp"),
    "tiff": ("TIFF", ".tiff"),
    "tif": ("TIFF", ".tiff"),
    "gif": ("GIF", ".gif"),
}
MENU_FORMATS = ["jpg", "png", "webp", "bmp", "tiff", "gif"]

# Formats that support an adjustable quality setting
LOSSY_FORMATS = {"JPEG", "WEBP"}
# Formats that cannot store transparency
NO_ALPHA_FORMATS = {"JPEG", "BMP"}

RESIZE_MODES = ("width", "height", "percent")
DEFAULT_QUALITY = 75
MAX_DIMENSION = 100_000


# What Pillow raises for files it cannot open or decode.
UNREADABLE = (OSError, ValueError, SyntaxError, Image.DecompressionBombError)


class ConvertError(Exception):
    """The input or the requested options are not usable (message is user-facing)."""


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def human_size(num_bytes: int) -> str:
    size = float(num_bytes)
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024 or unit == "GB":
            return f"{size:.1f} {unit}" if unit != "B" else f"{int(size)} B"
        size /= 1024
    return f"{size:.1f} GB"


def unique_path(path: Path) -> Path:
    """Never overwrite an existing file: add _1, _2, ... if needed."""
    if not path.exists():
        return path
    counter = 1
    while True:
        candidate = path.with_name(f"{path.stem}_{counter}{path.suffix}")
        if not candidate.exists():
            return candidate
        counter += 1


def resolve_format(key: str) -> tuple[str, str]:
    """'jpg' / 'PNG' / ... -> (PIL format, extension)."""
    try:
        return FORMATS[str(key).strip().lower().lstrip(".")]
    except KeyError:
        raise ConvertError(
            f"Unknown image type '{key}'. Use one of: {', '.join(MENU_FORMATS)}."
        ) from None


def _whole_number(value: float, what: str) -> int:
    number = round(float(value))
    if not 1 <= number <= MAX_DIMENSION:
        raise ConvertError(f"{what} must be between 1 and {MAX_DIMENSION}.")
    return number


def compute_resize(
    width: int, height: int, mode: str, value: float
) -> tuple[tuple[int, int], str]:
    if mode == "width":
        new_w = _whole_number(value, "Width")
        new_h = max(1, round(height * new_w / width))
    elif mode == "height":
        new_h = _whole_number(value, "Height")
        new_w = max(1, round(width * new_h / height))
    elif mode == "percent":
        pct = float(value)
        if not 1 <= pct <= 1000:
            raise ConvertError("Percentage must be between 1 and 1000.")
        new_w = max(1, round(width * pct / 100))
        new_h = max(1, round(height * pct / 100))
        if max(new_w, new_h) > MAX_DIMENSION:
            raise ConvertError(
                f"The result would be larger than {MAX_DIMENSION} pixels."
            )
        return (new_w, new_h), f"resized_{pct:g}pct"
    else:
        raise ConvertError(
            f"Unknown resize mode '{mode}'. Use one of: {', '.join(RESIZE_MODES)}."
        )
    if max(new_w, new_h) > MAX_DIMENSION:
        raise ConvertError(f"The result would be larger than {MAX_DIMENSION} pixels.")
    return (new_w, new_h), f"resized_{new_w}x{new_h}"


def prepare_for_format(img: Image.Image, pil_format: str) -> Image.Image:
    """Make the image mode compatible with the target format."""
    if pil_format in NO_ALPHA_FORMATS and img.mode in ("RGBA", "LA", "P"):
        rgba = img.convert("RGBA")
        background = Image.new("RGB", rgba.size, (255, 255, 255))
        background.paste(rgba, mask=rgba.split()[-1])
        return background
    if pil_format in NO_ALPHA_FORMATS and img.mode != "RGB":
        return img.convert("RGB")
    if pil_format == "GIF" and img.mode not in ("P", "L"):
        return img.convert("P", palette=Image.Palette.ADAPTIVE)
    return img


def build_save_kwargs(pil_format: str, compression: dict | None) -> dict:
    kwargs: dict = {}
    if pil_format == "JPEG":
        kwargs.update(quality=95, optimize=True)
    elif pil_format == "WEBP":
        kwargs.update(quality=95)
    elif pil_format == "PNG":
        kwargs.update(optimize=True)

    if compression is not None:
        if pil_format in LOSSY_FORMATS:
            kwargs["quality"] = compression["quality"]
            if pil_format == "JPEG":
                kwargs.update(optimize=True, progressive=True)
        elif pil_format == "PNG":
            kwargs.update(optimize=True, compress_level=9)
    return kwargs


def _open(path: str | Path) -> Path:
    source = Path(path).expanduser()
    if not source.is_file():
        raise ConvertError(f"File not found: {source}")
    return source


# --------------------------------------------------------------------------- #
# Public API
# --------------------------------------------------------------------------- #
def probe(path: str | Path) -> dict:
    """Read the basic facts about an image: name, path, size in pixels, format, bytes."""
    source = _open(path)
    try:
        with Image.open(source) as img:
            width, height = ImageOps.exif_transpose(img).size
            fmt = img.format
    except UNREADABLE:
        raise ConvertError("That file is not a readable image.") from None
    return {
        "name": source.name,
        "path": str(source.resolve()),
        "width": width,
        "height": height,
        "format": fmt,
        "size": source.stat().st_size,
    }


def process(
    path: str | Path,
    *,
    resize: tuple[str, float] | None = None,
    target_format: str | None = None,
    compress: bool = False,
    quality: int = DEFAULT_QUALITY,
    png_palette: bool = False,
    output: str | Path | None = None,
) -> dict:
    """
    Resize, convert and/or compress an image.

    resize        (mode, value): mode is "width", "height" or "percent".
    target_format key from FORMATS ("jpg", "png", ...); None keeps the source type.
    compress      re-save smaller. Not allowed together with `resize`
                  (resizing already reduces the file size).
    quality       1-100, for JPG and WEBP.
    png_palette   for PNG: reduce to 256 colors (lossy, much smaller).
    output        explicit output path; default is next to the source, never overwriting.
    """
    source = _open(path)
    if resize is not None and compress:
        raise ConvertError("Compression is only available when you are not resizing.")
    if resize is None and target_format is None and not compress:
        raise ConvertError(
            "Nothing to do: choose a resize, a new image type or compression."
        )
    if not 1 <= int(quality) <= 100:
        raise ConvertError("Quality must be between 1 and 100.")

    try:
        with Image.open(source) as opened:
            source_format = opened.format
            img = ImageOps.exif_transpose(opened)  # respect camera rotation
            img.load()
    except UNREADABLE:
        raise ConvertError("That file is not a readable image.") from None

    # Determine the output format (same as source unless converting)
    if target_format:
        pil_format, extension = resolve_format(target_format)
    else:
        known = {f for f, _ in FORMATS.values()}
        pil_format = source_format if source_format in known else "PNG"
        extension = (
            source.suffix.lower()
            if source_format == pil_format
            else FORMATS[pil_format.lower()][1]
        )

    compression = None
    if compress:
        if pil_format in LOSSY_FORMATS:
            compression = {"quality": int(quality)}
        elif pil_format == "PNG":
            compression = {"png_palette": bool(png_palette)}
        else:
            compression = {}  # no adjustable compression: default settings

    # Build the suffix describing what changed
    labels = []
    if resize is not None:
        new_size, label = compute_resize(*img.size, *resize)
        img = img.resize(new_size, Image.Resampling.LANCZOS)
        labels.append(label)
    if compression is not None:
        labels.append("compressed")
    if target_format:
        labels.append("converted")

    img = prepare_for_format(img, pil_format)
    if compression and compression.get("png_palette"):
        has_alpha = "A" in img.getbands()
        img = img.convert("RGBA" if has_alpha else "RGB").quantize(
            colors=256,
            method=Image.Quantize.FASTOCTREE if has_alpha else Image.Quantize.MEDIANCUT,
        )

    if output:
        destination = Path(output)
    else:
        destination = unique_path(
            source.with_name(f"{source.stem}_{'_'.join(labels)}{extension}")
        )
    try:
        img.save(
            destination, format=pil_format, **build_save_kwargs(pil_format, compression)
        )
    except OSError as e:
        destination.unlink(missing_ok=True)
        raise ConvertError(f"Could not save the image: {e}") from None

    return {
        "output": str(destination),
        "width": img.size[0],
        "height": img.size[1],
        "size": destination.stat().st_size,
        "original_size": source.stat().st_size,
    }
