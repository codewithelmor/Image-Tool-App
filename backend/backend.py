"""
JSON-lines front end for the Electron app. Every line on stdout is one JSON event:
  check                                          {"event": "check", "pillow": "<version>"}
  probe <file>                                   {"event": "probe", ...image info}
  process <file> [--resize-mode M --resize-value V] [--format F]
                 [--compress [--quality Q] [--png-palette]] [--output P]
                                                 {"event": "process", "output", "width",
                                                  "height", "size", "original_size"}
  any failure                                    {"event": "error", "message"}   (exit code 1)
"""

import argparse
import json
import sys

import core
from PIL import __version__ as pillow_version


def send(event, **data):
    sys.stdout.write(json.dumps({"event": event, **data}, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def build_parser():
    parser = argparse.ArgumentParser(
        description="Image tool backend (JSON lines on stdout)"
    )
    commands = parser.add_subparsers(dest="command", required=True)

    commands.add_parser("check", help="verify Pillow loads")

    probe = commands.add_parser(
        "probe", help="read size, format and file size of an image"
    )
    probe.add_argument("file")

    process = commands.add_parser(
        "process", help="resize, convert and/or compress an image"
    )
    process.add_argument("file")
    process.add_argument("--resize-mode", choices=core.RESIZE_MODES)
    process.add_argument("--resize-value", type=float)
    process.add_argument(
        "--format", help=f"target type: {', '.join(core.MENU_FORMATS)}"
    )
    process.add_argument("--compress", action="store_true")
    process.add_argument("--quality", type=int, default=core.DEFAULT_QUALITY)
    process.add_argument("--png-palette", action="store_true")
    process.add_argument("--output", help="output path (default: next to the source)")
    return parser


def main():
    args = build_parser().parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    try:
        if args.command == "check":
            send("check", pillow=pillow_version)
        elif args.command == "probe":
            send("probe", **core.probe(args.file))
        else:
            resize = None
            if args.resize_mode:
                if args.resize_value is None:
                    raise core.ConvertError(
                        "--resize-value is required with --resize-mode."
                    )
                resize = (args.resize_mode, args.resize_value)
            result = core.process(
                args.file,
                resize=resize,
                target_format=args.format,
                compress=args.compress,
                quality=args.quality,
                png_palette=args.png_palette,
                output=args.output,
            )
            send("process", **result)
    except (core.ConvertError, OSError) as e:
        send("error", message=str(e))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
