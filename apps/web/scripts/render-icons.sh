#!/bin/sh
# Renders every PNG icon in apps/web/public from the one source, public/favicon.svg
# (the letter Ç in #f2efe6 on #14301f, drawn as paths and strokes, so no font is needed).
# Needs rsvg-convert and magick: brew install librsvg imagemagick. Run from anywhere:
#   sh apps/web/scripts/render-icons.sh
set -eu
cd "$(dirname "$0")/../public"
rsvg-convert -w 32 -h 32 favicon.svg -o favicon-32.png
rsvg-convert -w 180 -h 180 favicon.svg -o apple-touch-icon.png
rsvg-convert -w 192 -h 192 favicon.svg -o icons/icon-192.png
rsvg-convert -w 512 -h 512 favicon.svg -o icons/icon-512.png
# The maskable icon keeps the mark inside the 80 % safe circle: the same art at 80 %, on more green.
rsvg-convert -w 410 -h 410 favicon.svg | magick - -background '#14301f' -gravity center -extent 512x512 -strip icons/icon-maskable-512.png
