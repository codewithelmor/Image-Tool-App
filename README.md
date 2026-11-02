# Image Tool

Resize, convert and compress images with a desktop app or the command line. The result is saved **next to the original**, with what changed appended to the name, and an existing file is never overwritten. **Everything is bundled**: the installer contains the app and its Python backend (with Pillow), so there is nothing to install.

## Features

- **Drag and drop** an image (or choose one): JPG, PNG, WEBP, BMP, TIFF, GIF.
- **Resize** by width, height (aspect ratio kept) or percentage.
- **Convert** to JPG, PNG, WEBP, BMP, TIFF or GIF.
- **Compress** when you are not resizing: a quality from 1 to 100 for JPG and WEBP, or lossless re-compression for PNG with an optional reduction to 256 colors.
- Respects camera (EXIF) rotation; converting a transparent image to JPG or BMP flattens it onto white.
- **Preview** of the result and a *Show in folder* button.
- **Standalone installer** for Windows, Linux and macOS.

| Action | Source | Output |
|---|---|---|
| Resize by width/height | `photo.jpg` | `photo_resized_800x600.jpg` |
| Resize by percentage | `photo.jpg` | `photo_resized_50pct.jpg` |
| Compress only | `photo.jpg` | `photo_compressed.jpg` |
| Convert only | `photo.jpg` | `photo_converted.png` |
| Resize + convert | `photo.jpg` | `photo_resized_50pct_converted.webp` |
| Compress + convert | `photo.png` | `photo_compressed_converted.jpg` |

Notes: animated GIFs are saved as a single frame; BMP, TIFF and GIF have no adjustable quality, so "compress" re-saves them with default settings.

## Usage

### Desktop app

Drop an image on the window, choose a resize, a new type and/or compression, and click **Process image**.

### Command line

```bash
pip install -r backend/requirements.txt
python backend/cli.py
```

The tool asks for the image path, then whether to resize, convert and (if not resizing) compress. Use a virtual environment if you prefer to keep your global Python clean (`python -m venv .venv`, then activate it).

### JSON backend

This is how the Electron app drives Python. Always run it with `-X utf8 -u`.

```bash
python -X utf8 -u backend/backend.py check                       # verify Pillow loads
python -X utf8 -u backend/backend.py probe <image>
python -X utf8 -u backend/backend.py process <image> --resize-mode width --resize-value 800 --format webp
python -X utf8 -u backend/backend.py process <image> --compress --quality 70
```

## Development

| Requirement | Notes |
|---|---|
| Python 3.10+ | Runs the backend; `pip install -r backend/requirements.txt` (Pillow) |
| Node.js | Only for developing or packaging the desktop app |

```bash
cd app
npm install
npm start          # compiles TypeScript and launches Electron (needs python on PATH)
npm run typecheck
```

## Building Installers

PyInstaller cannot cross-compile, so build on the OS you are targeting. The build freezes the backend together with Pillow and checks that the packaged backend runs.

| OS | Command | Output in `app/dist/` |
|----|---------|-----------------------|
| Windows | `powershell -ExecutionPolicy Bypass -File scripts\build-all.ps1` | `*Setup*.exe` |
| Linux | `scripts/build-all.sh` | `*.AppImage`, `*.deb` |
| macOS | `scripts/build-all.sh` | `*.dmg` |

Add `-Clean` / `--clean` for a fresh build. Builds are unsigned.

## Project Structure

```text
_Azure-Config-Converter-App/
├── .agents
│   └── skills
│       ├── app-icon-restyle
│       │   ├── scripts
│       │   │   └── export_icons.py
│       │   └── SKILL.md
│       └── skill-creator
│           ├── agents
│           │   ├── analyzer.md
│           │   ├── comparator.md
│           │   └── grader.md
│           ├── assets
│           │   └── eval_review.html
│           ├── eval-viewer
│           │   ├── generate_review.py
│           │   └── viewer.html
│           ├── references
│           │   └── schemas.md
│           ├── scripts
│           │   ├── __init__.py
│           │   ├── aggregate_benchmark.py
│           │   ├── generate_report.py
│           │   ├── improve_description.py
│           │   ├── package_skill.py
│           │   ├── quick_validate.py
│           │   ├── run_eval.py
│           │   ├── run_loop.py
│           │   └── utils.py
│           ├── LICENSE.txt
│           └── SKILL.md
├── .claude
│   ├── commands
│   │   └── commit.md
│   ├── skills
│   │   ├── app-icon-restyle
│   │   │   ├── scripts
│   │   │   │   └── export_icons.py
│   │   │   └── SKILL.md
│   │   └── skill-creator
│   │       ├── agents
│   │       │   ├── analyzer.md
│   │       │   ├── comparator.md
│   │       │   └── grader.md
│   │       ├── assets
│   │       │   └── eval_review.html
│   │       ├── eval-viewer
│   │       │   ├── generate_review.py
│   │       │   └── viewer.html
│   │       ├── references
│   │       │   └── schemas.md
│   │       ├── scripts
│   │       │   ├── __init__.py
│   │       │   ├── aggregate_benchmark.py
│   │       │   ├── generate_report.py
│   │       │   ├── improve_description.py
│   │       │   ├── package_skill.py
│   │       │   ├── quick_validate.py
│   │       │   ├── run_eval.py
│   │       │   ├── run_loop.py
│   │       │   └── utils.py
│   │       ├── LICENSE.txt
│   │       └── SKILL.md
│   └── settings.json
├── .github
│   └── workflows
│       └── build.yml
├── app
│   ├── assets
│   │   ├── icons
│   │   │   ├── 128x128.png
│   │   │   ├── 16x16.png
│   │   │   ├── 256x256.png
│   │   │   ├── 32x32.png
│   │   │   ├── 48x48.png
│   │   │   ├── 512x512.png
│   │   │   └── 64x64.png
│   │   ├── icon.ico
│   │   └── icon.png
│   ├── scripts
│   │   └── copy-static.js
│   ├── src
│   │   ├── renderer
│   │   │   ├── index.html
│   │   │   ├── renderer.ts
│   │   │   └── style.css
│   │   ├── main.ts
│   │   ├── preload.ts
│   │   └── types.d.ts
│   ├── package-lock.json
│   ├── package.json
│   └── tsconfig.json
├── backend
│   ├── backend.py
│   ├── cli.py
│   ├── core.py
│   └── requirements.txt
├── scripts
│   ├── build-all.ps1
│   ├── build-all.sh
│   ├── build-backend.ps1
│   ├── build-backend.sh
│   └── update_readme_tree.py
├── .gitattributes
├── .gitignore
├── CLAUDE.md
├── README.md
└── skills-lock.json
```
