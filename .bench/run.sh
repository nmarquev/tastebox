#!/usr/bin/env bash
set -u
BASE="http://localhost:3005"
OUT="$(dirname "$0")/results"
mkdir -p "$OUT"

TOKEN=$(curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"demo@thermomix.com","password":"demo123"}' | sed -E 's/.*"token":"([^"]+)".*/\1/')

declare -a MODELS=(
  "deepseek/deepseek-v4-flash"
  "openai/gpt-4o-mini"
  "google/gemini-2.5-flash-lite"
  "qwen/qwen3.5-flash-02-23"
)
declare -a URLS=(
  "https://cookidoo.international/recipes/recipe/es/r57645"
  "https://www.paulinacocina.net/budin-de-naranja/8585"
  "https://cookpad.com/ar/recetas/17124999?ref=search&search_term=paulina+cocina"
)

mi=0
for MODEL in "${MODELS[@]}"; do
  curl -s -X PUT "$BASE/api/settings/ai" -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" -d "{\"model\":\"$MODEL\"}" >/dev/null
  ui=0
  for URL in "${URLS[@]}"; do
    f="$OUT/m${mi}_u${ui}.json"
    start=$(date +%s.%N)
    body=$(curl -s --max-time 180 -X POST "$BASE/api/import" -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" -d "{\"url\":\"$URL\"}")
    end=$(date +%s.%N)
    elapsed=$(awk "BEGIN{printf \"%.1f\", $end-$start}")
    # wrap with meta
    printf '{"model":"%s","url":"%s","elapsed":%s,"response":%s}\n' \
      "$MODEL" "$URL" "$elapsed" "${body:-null}" > "$f"
    echo "done m${mi}(${MODEL}) u${ui} in ${elapsed}s"
    ui=$((ui+1))
  done
  mi=$((mi+1))
done
echo "ALL DONE"
