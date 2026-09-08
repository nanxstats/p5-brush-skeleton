#!/bin/bash
#
# Render an example to PNG with headless Chrome.
#
#   tools/render.sh examples/shinygenui-hero/index.html hero.png 1920 1187
#
# Chrome may exit successfully even when WebGL fails to initialize, so the
# script checks that the capture contains more than a handful of colors. The
# capture is then compressed in place with pngquant when it is installed,
# which roughly halves the size with no visible change.

set -euo pipefail

if (( $# < 4 )); then
    echo "usage: $0 <input.html> <output.png> <width> <height>"
    exit 1
fi

INPUT="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
OUTPUT="$2"
WIDTH="$3"
HEIGHT="$4"

if [[ "$OSTYPE" == "darwin"* ]]; then
    CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    CHROME_BIN="/c/Program Files/Google/Chrome/Application/chrome.exe"
else
    CHROME_BIN="/usr/bin/google-chrome"
fi

if [ ! -f "$CHROME_BIN" ]; then
    echo "Chrome/Chromium not found at $CHROME_BIN"
    exit 1
fi

"$CHROME_BIN" --headless \
    --enable-gpu \
    --disable-software-rasterizer \
    --hide-scrollbars \
    --force-device-scale-factor=1 \
    --window-size="$WIDTH,$HEIGHT" \
    --virtual-time-budget=15000 \
    --screenshot="$OUTPUT" \
    "file://$INPUT" 2>/dev/null

if command -v magick >/dev/null 2>&1; then
    COLORS="$(magick "$OUTPUT" -format %k info:)"
    if (( COLORS < 500 )); then
        echo "Render looks incomplete ($COLORS colors); check Chrome WebGL and CDN access."
        exit 1
    fi
fi

if command -v pngquant >/dev/null 2>&1; then
    pngquant --force --skip-if-larger --output "$OUTPUT" "$OUTPUT"
fi

echo "Wrote $OUTPUT"
