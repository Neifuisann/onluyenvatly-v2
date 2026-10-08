"""Builds src/app/fonts/*.woff2: one Vietnamese-ready file per family.

Google's CSS for Inter and Bricolage declares latin-ext after vietnamese, so
the browser fetches latin-ext (Inter: 85 KB) for ư/ơ/đ/ă on every page, on
top of latin and vietnamese: 7 font files, ~215 KB. One subset per family
covers what we render (Latin, Vietnamese, punctuation, Greek letters and
the usual physics symbols) in 2 files, ~120 KB.

Same axes and OpenType features as the files Google served (wght only;
Inter opsz 14, Bricolage opsz 96 / wdth 100; no cv11/ss01), so text renders
as before.

    pip install fonttools brotli
    python scripts/subset-fonts.py <dir with the google/fonts sources>

Sources (OFL 1.1, licenses next to the output):
  ofl/inter/Inter[opsz,wght].ttf
  ofl/bricolagegrotesque/BricolageGrotesque[opsz,wdth,wght].ttf
"""

import os
import sys
import tempfile

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

BASE = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0300-0304,U+0306,U+0308-0309,U+0323,U+0329"
VIETNAMESE = "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+1EA0-1EF9"
SYMBOLS = "U+2000-206F,U+2070-209F,U+20AB,U+20AC,U+2122,U+2190-2199,U+2206,U+2126,U+00B5,U+2212,U+2215,U+2219,U+221A,U+221E,U+2248,U+2260,U+2264-2265,U+FEFF,U+FFFD"
GREEK = "U+0391-03A9,U+03B1-03C9,U+03D1,U+03D5,U+03F5"
FEATURES = ["calt", "ccmp", "dnom", "frac", "locl", "numr", "pnum", "tnum", "kern", "mark", "mkmk"]
OUT = os.path.join(os.path.dirname(__file__), "..", "src", "app", "fonts")


def codepoints(ranges: str) -> list[int]:
    result = []
    for part in ranges.split(","):
        bounds = part[2:].split("-")
        result.extend(range(int(bounds[0], 16), int(bounds[-1], 16) + 1))
    return result


def build(source: str, out: str, pin: dict[str, float], ranges: str) -> None:
    font = instancer.instantiateVariableFont(TTFont(source), pin)
    # Reload: subsetting an instanced font in memory trips over lazy tables.
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, "instance.ttf")
        font.save(path)
        font = TTFont(path)
        options = subset.Options()
        options.flavor = "woff2"
        options.layout_features = FEATURES
        options.name_IDs = ["*"]
        options.notdef_outline = True
        subsetter = subset.Subsetter(options)
        subsetter.populate(unicodes=codepoints(ranges))
        subsetter.subset(font)
        subset.save_font(font, os.path.join(OUT, out), options)


src = sys.argv[1]
build(
    os.path.join(src, "Inter[opsz,wght].ttf"),
    "inter-vi.woff2",
    {"opsz": 14},
    ",".join([BASE, VIETNAMESE, SYMBOLS, GREEK]),
)
build(
    os.path.join(src, "BricolageGrotesque[opsz,wdth,wght].ttf"),
    "bricolage-grotesque-vi.woff2",
    {"opsz": 96, "wdth": 100},
    ",".join([BASE, VIETNAMESE, SYMBOLS]),
)
