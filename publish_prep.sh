#!/bin/bash
# Подготовка серии к публикации: сжатие ≤ 30 МБ (звук не перекодируем — пик уже проверен),
# обложка в JPG, загрузка в ветку cherdushki-video репозитория Tovizy/tovizy-site, печать публичных ссылок.
# Перед запуском в новой сессии: add_repo Tovizy/tovizy-site (push) и
#   git clone --depth 1 -b cherdushki-video https://github.com/Tovizy/tovizy-site /home/claude/tovizy-site
# Запуск: ./publish_prep.sh out/s3final.mp4 out/cover/s1e03.png s1e03_voron_ne_spit
set -e
SRC=$(realpath "$1"); COVER=$(realpath "$2"); SLUG="$3"
REPO=/home/claude/tovizy-site
[ -f "$SRC" ] && [ -f "$COVER" ] && [ -n "$SLUG" ] || { echo "нужно: видео обложка имя"; exit 1; }
git -C "$REPO" rev-parse --abbrev-ref HEAD | grep -qx cherdushki-video || { echo "в $REPO должна быть ветка cherdushki-video"; exit 1; }
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SRC")
ABR=$(ffprobe -v error -select_streams a -show_entries stream=bit_rate -of csv=p=0 "$SRC")
# видеобитрейт под 29 МБ всего
VBR=$(python3 -c "print(int((29*8*1024*1024/$DUR - ${ABR:-200000})/1000))")
TMP=$(mktemp -d)
( cd "$TMP" && ffmpeg -loglevel error -y -i "$SRC" -c:v libx264 -preset slow -b:v ${VBR}k -pass 1 -an -f mp4 /dev/null \
  && ffmpeg -loglevel error -y -i "$SRC" -c:v libx264 -preset slow -b:v ${VBR}k -pass 2 -pix_fmt yuv420p -c:a copy -movflags +faststart "$REPO/$SLUG.mp4" )
python3 -c "from PIL import Image; Image.open('$COVER').convert('RGB').save('$REPO/${SLUG}_cover.jpg', quality=92)"
ls -la "$REPO/$SLUG.mp4" "$REPO/${SLUG}_cover.jpg"
ffmpeg -i "$REPO/$SLUG.mp4" -af ebur128=peak=true -f null - 2>&1 | grep -E "I:|Peak:" | tail -2
cd "$REPO"
git add "$SLUG.mp4" "${SLUG}_cover.jpg"
git commit -qm "Чердушки: $SLUG

Co-Authored-By: Claude <noreply@anthropic.com>${CLAUDE_SESSION:+
Claude-Session: $CLAUDE_SESSION}"
git push -q
B=https://raw.githubusercontent.com/Tovizy/tovizy-site/cherdushki-video
echo "ВИДЕО:   $B/$SLUG.mp4"
echo "ОБЛОЖКА: $B/${SLUG}_cover.jpg"
