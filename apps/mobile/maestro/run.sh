#!/usr/bin/env bash
# Runs one Maestro flow on one iOS simulator, from a clean install.
#
#   apps/mobile/maestro/run.sh <simulator-udid> <flow.yaml> [--seed]
#
# - Reinstalls the Release build, so the app has no data and no permissions decided.
# - With --seed, opens the app once (it runs its migrations), closes it, and fills its database
#   with the demo data (`pnpm --filter mobile seed:db`). The app then starts on the tabs.
# - Set SALDO_APP_PATH to the built Saldo.app. The default is the newest Release build in DerivedData.
#
# Build the app once with: `npx expo run:ios --configuration Release --device <udid> --no-bundler`.
set -euo pipefail

udid="${1:?usage: run.sh <simulator-udid> <flow.yaml> [--seed]}"
flow="${2:?usage: run.sh <simulator-udid> <flow.yaml> [--seed]}"
seed="${3:-}"
bundle="io.github.saldo.app"
here="$(cd "$(dirname "$0")" && pwd)"

app="${SALDO_APP_PATH:-}"
if [ -z "$app" ]; then
  app="$(ls -dt "$HOME"/Library/Developer/Xcode/DerivedData/Saldo-*/Build/Products/Release-iphonesimulator/Saldo.app | head -n 1)"
fi

xcrun simctl terminate "$udid" "$bundle" >/dev/null 2>&1 || true
xcrun simctl uninstall "$udid" "$bundle" >/dev/null 2>&1 || true
xcrun simctl install "$udid" "$app"

if [ "$seed" = "--seed" ]; then
  xcrun simctl launch "$udid" "$bundle" >/dev/null
  sleep 8
  xcrun simctl terminate "$udid" "$bundle"
  data="$(xcrun simctl get_app_container "$udid" "$bundle" data)"
  (cd "$here/.." && pnpm --silent seed:db "$data/Documents/SQLite/saldo.db" --reset)
fi

maestro --device "$udid" test "$flow"
