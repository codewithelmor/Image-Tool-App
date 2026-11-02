"""Builds the final MP4 and caption files from the recording, timeline and per-scene audio.
Usage: python edit.py <take.mkv> <take.json>   (run from the demo folder)
"""

import json
import re
import subprocess
import sys
from pathlib import Path

DEMO = Path(__file__).resolve().parent.parent


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


REC, TL = Path(sys.argv[1]), load(sys.argv[2])
T, SC = TL["timeline"], load(DEMO / "scenes.json")
DUR = load(DEMO / "audio" / "durations.json")
EXP, CAP, TMP = DEMO / "exports", DEMO / "captions", DEMO / "exports" / "tmp"
EXP.mkdir(exist_ok=True)
CAP.mkdir(exist_ok=True)
TMP.mkdir(exist_ok=True)
VERSION = "1.0.0"
NAME = "image-tool-overview-v" + VERSION
FONT = "C\\:/Windows/Fonts/segoeui.ttf"
FONTB = "C\\:/Windows/Fonts/segoeuib.ttf"
TITLE_LEN, END_LEN = 3.0, DUR["end"] + 0.3 + 1.2
MAIN_LEN = T["recordingEnd"]


def run(*a):
    r = subprocess.run([str(x) for x in a], capture_output=True, text=True, check=False)
    if r.returncode:
        print(r.stderr[-1500:])
        raise SystemExit("ffmpeg failed")


def card(path, length, lines):
    """lines: (text, fontfile, size, y, color)"""
    vf = (
        ",".join(
            f"drawtext=fontfile='{f}':text='{t}':fontsize={s}:fontcolor={c}:x=(w-text_w)/2:y={y}"
            for t, f, s, y, c in lines
        )
        + f",fade=t=in:st=0:d=0.4,fade=t=out:st={length - 0.4}:d=0.4"
    )
    run(
        "ffmpeg",
        "-y",
        "-f",
        "lavfi",
        "-i",
        f"color=c=0x121212:s=1920x1080:r=30:d={length}",
        "-vf",
        vf,
        "-c:v",
        "libx264",
        "-crf",
        "16",
        "-pix_fmt",
        "yuv420p",
        path,
    )


card(
    TMP / "title.mp4",
    TITLE_LEN,
    [
        ("Image Tool", FONTB, 110, 400, "white"),
        ("Resize\\, convert and compress images", FONT, 48, 560, "0x9a9a9a"),
        (f"Version {VERSION}", FONT, 36, 650, "0x4f8cff"),
    ],
)
card(
    TMP / "end.mp4",
    END_LEN,
    [
        ("Image Tool", FONTB, 100, 340, "white"),
        ("Try it on one of your own images", FONT, 52, 500, "0x4f8cff"),
        (f"Version {VERSION}", FONT, 36, 590, "0x9a9a9a"),
        (
            "Narration\\: AI-generated voice \\(Microsoft neural voice\\)",
            FONT,
            30,
            900,
            "0x9a9a9a",
        ),
    ],
)

# main footage: trim to the scenes; cover the Windows taskbar while Explorer is on top (scene s05)
s5 = T["s05"]["start"] + 1.0
run(
    "ffmpeg",
    "-y",
    "-i",
    REC,
    "-t",
    MAIN_LEN,
    "-vf",
    f"drawbox=x=0:y=1030:w=1920:h=50:color=0x121212:t=fill:enable='gte(t,{s5})',fps=30,fade=t=in:st=0:d=0.3",
    "-c:v",
    "libx264",
    "-crf",
    "16",
    "-pix_fmt",
    "yuv420p",
    TMP / "main.mp4",
)
run(
    "ffmpeg",
    "-y",
    "-i",
    TMP / "title.mp4",
    "-i",
    TMP / "main.mp4",
    "-i",
    TMP / "end.mp4",
    "-filter_complex",
    "[0][1][2]concat=n=3:v=1:a=0[v]",
    "-map",
    "[v]",
    "-c:v",
    "libx264",
    "-crf",
    "16",
    "-pix_fmt",
    "yuv420p",
    TMP / "video.mp4",
)

# audio: each scene clip starts at its scene's audioAt (+ title offset); end clip on the end card
starts = {k: TITLE_LEN + T[k]["audioAt"] for k in ("s01", "s02", "s03", "s04", "s05")}
starts["end"] = TITLE_LEN + MAIN_LEN + 0.3
total = TITLE_LEN + MAIN_LEN + END_LEN
ins, fl = [], []
for i, (k, s) in enumerate(starts.items()):
    ins += ["-i", DEMO / "audio" / f"{k}.wav"]
    fl.append(f"[{i}]adelay={int(s * 1000)}:all=1[a{i}]")
mix = "".join(f"[a{i}]" for i in range(len(starts)))
fl.append(
    f"{mix}amix=inputs={len(starts)}:normalize=0,apad=whole_dur={total},atrim=0:{total},"
    "loudnorm=I=-16:TP=-1.5:LRA=7[aout]"
)
run(
    "ffmpeg",
    "-y",
    *ins,
    "-filter_complex",
    ";".join(fl),
    "-map",
    "[aout]",
    "-ar",
    "48000",
    "-ac",
    "2",
    TMP / "audio.wav",
)


# captions
def chunks(text):
    parts = re.findall(r"[^,.:;!?]+[,.:;!?]?", text)
    out, cur = [], ""
    for p in (x.strip() for x in parts):
        if not p:
            continue
        if cur and len(cur) + len(p) + 1 > 70:
            out.append(cur)
            cur = p
        else:
            cur = (cur + " " + p).strip()
    if cur:
        out.append(cur)
    return out


def ts(t, sep):
    h, m, s = int(t // 3600), int(t % 3600 // 60), t % 60
    return f"{h:02d}:{m:02d}:{int(s):02d}{sep}{round((s - int(s)) * 1000):03d}"


cues = []
for k, s in starts.items():
    cs = chunks(SC[k])
    w = [len(c) + 6 for c in cs]
    tot = sum(w)
    t = s
    for c, ww in zip(cs, w):
        d = DUR[k] * ww / tot
        cues.append((t, t + d - 0.05, c))
        t += d
srt = "\n".join(
    f"{i}\n{ts(a, ',')} --> {ts(b, ',')}\n{c}\n" for i, (a, b, c) in enumerate(cues, 1)
)
vtt = "WEBVTT\n\n" + "\n".join(
    f"{ts(a, '.')} --> {ts(b, '.')}\n{c}\n" for a, b, c in cues
)
(CAP / f"{NAME}.srt").write_text(srt, encoding="utf-8")
(CAP / f"{NAME}.vtt").write_text(vtt, encoding="utf-8")

# mux: H.264 video + AAC audio + soft subtitle track
final = EXP / f"{NAME}.mp4"
run(
    "ffmpeg",
    "-y",
    "-i",
    TMP / "video.mp4",
    "-i",
    TMP / "audio.wav",
    "-i",
    CAP / f"{NAME}.srt",
    "-map",
    "0:v",
    "-map",
    "1:a",
    "-map",
    "2:0",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-c:s",
    "mov_text",
    "-metadata:s:s:0",
    "language=eng",
    "-movflags",
    "+faststart",
    "-t",
    total,
    final,
)
timeline = (
    {
        "title": [0, TITLE_LEN],
        **{
            k: [TITLE_LEN + T[k]["start"], TITLE_LEN + T[k]["start"] + T[k]["len"]]
            for k in ("s01", "s02", "s03", "s04", "s05")
        },
        "end": [TITLE_LEN + MAIN_LEN, total],
        "total": total,
    }
)
(EXP / "timeline.json").write_text(json.dumps(timeline, indent=1), encoding="utf-8")
print(final, round(total, 1))
