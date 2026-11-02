"""Interactive command-line front end: asks everything, then calls core."""

from __future__ import annotations

import sys
from pathlib import Path

import core


# --------------------------------------------------------------------------- #
# Prompt helpers
# --------------------------------------------------------------------------- #
def ask(prompt: str) -> str:
    try:
        return input(prompt).strip()
    except (EOFError, KeyboardInterrupt):
        print("\nCancelled.")
        sys.exit(0)


def ask_yes_no(prompt: str, default: bool = False) -> bool:
    hint = "Y/n" if default else "y/N"
    while True:
        answer = ask(f"{prompt} [{hint}]: ").lower()
        if not answer:
            return default
        if answer in ("y", "yes"):
            return True
        if answer in ("n", "no"):
            return False
        print("  Please answer y or n.")


def ask_number(prompt: str, minimum: float, maximum: float, as_int: bool = True):
    while True:
        raw = ask(prompt)
        try:
            value = float(raw)
        except ValueError:
            print("  Please enter a number.")
            continue
        if not (minimum <= value <= maximum):
            print(f"  Value must be between {minimum:g} and {maximum:g}.")
            continue
        return round(value) if as_int else value


def ask_choice(prompt: str, options: list[str]) -> int:
    """Show a numbered menu, return the 0-based index chosen."""
    print(prompt)
    for i, option in enumerate(options, start=1):
        print(f"  {i}) {option}")
    return ask_number("Choose: ", 1, len(options)) - 1


def ask_source_path() -> tuple[Path, dict]:
    while True:
        raw = ask("Path to the image file: ").strip("\"'")
        if not raw:
            continue
        try:
            info = core.probe(raw)
        except core.ConvertError as e:
            print(f"  {e} Try again.")
            continue
        return Path(info["path"]), info


# --------------------------------------------------------------------------- #
# Interactive questions
# --------------------------------------------------------------------------- #
def ask_resize(width: int, height: int):
    """Return (mode, value) or None if the user does not want to resize."""
    if not ask_yes_no("Resize the image?"):
        return None

    mode = ask_choice(
        "Resize by:",
        ["Width (keep aspect ratio)", "Height (keep aspect ratio)", "Percentage"],
    )
    if mode == 0:
        return "width", ask_number(
            f"New width in pixels (current {width}): ", 1, core.MAX_DIMENSION
        )
    if mode == 1:
        return "height", ask_number(
            f"New height in pixels (current {height}): ", 1, core.MAX_DIMENSION
        )
    return "percent", ask_number(
        "Percentage of original size (e.g. 50): ", 1, 1000, as_int=False
    )


def ask_convert() -> str | None:
    """Return the target format key, or None if the user does not want to convert."""
    if not ask_yes_no("Convert to a different image type?"):
        return None
    idx = ask_choice("Target image type:", [f.upper() for f in core.MENU_FORMATS])
    return core.MENU_FORMATS[idx]


def ask_compress(pil_format: str) -> dict | None:
    """Return keyword arguments for core.process, or None if not compressing."""
    if not ask_yes_no("Compress the image?"):
        return None

    if pil_format in core.LOSSY_FORMATS:
        quality = ask_number("Quality 1-100 (lower = smaller file, e.g. 70): ", 1, 100)
        return {"compress": True, "quality": quality}
    if pil_format == "PNG":
        print("  PNG is lossless; it will be re-saved with maximum compression.")
        reduce = ask_yes_no(
            "  Also reduce to 256 colors for a much smaller file (lossy)?"
        )
        return {"compress": True, "png_palette": reduce}
    print(
        f"  {pil_format} has no adjustable compression; saving with default settings."
    )
    return {"compress": True}


# --------------------------------------------------------------------------- #
# Main loop
# --------------------------------------------------------------------------- #
def process_image() -> None:
    _source, info = ask_source_path()
    print(
        f"\nLoaded {info['name']}: {info['width']}x{info['height']}, "
        f"{info['format']}, {core.human_size(info['size'])}\n"
    )

    resize = ask_resize(info["width"], info["height"])
    target = ask_convert()

    options: dict = {"resize": resize, "target_format": target}

    # Compression is only offered when the user is not resizing
    if resize is None:
        if target:
            pil_format = core.resolve_format(target)[0]
        else:
            known = {f for f, _ in core.FORMATS.values()}
            pil_format = info["format"] if info["format"] in known else "PNG"
        compression = ask_compress(pil_format)
        if compression:
            options.update(compression)

    try:
        result = core.process(info["path"], **options)
    except core.ConvertError as e:
        print(f"\n{e}")
        return

    print(f"\nSaved: {result['output']}")
    print(
        f"Size : {result['width']}x{result['height']}, {core.human_size(result['size'])} "
        f"(original {core.human_size(result['original_size'])})"
    )


def main() -> int:
    print("=== Image Tool: resize / convert / compress ===\n")
    while True:
        try:
            process_image()
        except Exception as exc:  # noqa: BLE001 - keep the interactive loop alive
            print(f"\nError: {exc}")
        print()
        if not ask_yes_no("Process another image?"):
            break
    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
