#!/usr/bin/env bash
#
# Builds a release APK you can sideload, and tells you which key signed it.
#
#   pnpm --filter mobile build:android saldo.example.com
#   SALDO_SERVER_URL=saldo.example.com pnpm --filter mobile build:android
#
# Signing comes from four properties in ~/.gradle/gradle.properties, outside the checkout:
#
#   SALDO_UPLOAD_STORE_FILE=/Users/you/keys/saldo-release.keystore
#   SALDO_UPLOAD_KEY_ALIAS=saldo
#   SALDO_UPLOAD_STORE_PASSWORD=…
#   SALDO_UPLOAD_KEY_PASSWORD=…
#
# Without them the build still succeeds — `withReleaseSigning` leaves the debug key in place — and
# that APK installs perfectly well. It must not be given to anybody: it is signed with a key every
# Android developer on earth has a copy of, and an APK signed with the debug key cannot later be
# updated by one signed with yours. This script says so out loud at the end rather than letting you
# find out from the person you sent it to.
#
# See docs/building-android.md for the whole path, including what to do when it goes wrong.

set -euo pipefail

cd "$(dirname "$0")/.."

# The server is a build input, not something typed on the phone (§15). Argument first, then the
# environment, so both spellings in the header work.
SERVER_URL="${1:-${SALDO_SERVER_URL:-}}"
BUNDLE_ID="${2:-${SALDO_BUNDLE_ID:-io.github.saldo.app}}"
APP_NAME="${SALDO_APP_NAME:-Saldo}"
SCHEME="${SALDO_SCHEME:-saldo}"
APK="android/app/build/outputs/apk/release/app-release.apk"

if [ -z "$SERVER_URL" ]; then
  echo "error: no server address." >&2
  echo "  pnpm --filter mobile build:android saldo.example.com" >&2
  echo "  SALDO_SERVER_URL=saldo.example.com pnpm --filter mobile build:android" >&2
  echo >&2
  echo "The app signs in to exactly one server and the address is baked in here. Building without" >&2
  echo "it produces an app that starts and says it has no server — nine minutes to find out." >&2
  exit 1
fi

echo "==> server   $SERVER_URL"
echo "==> bundle   $BUNDLE_ID"
echo "==> scheme   $SCHEME://"
echo "==> output   $PWD/$APK"
echo

# `SALDO_DRY_RUN=1` stops here, having printed what it would bake in. The build takes minutes and
# `--clean` throws android/ away, so checking the four values first is cheaper than reading them
# back off a finished APK.
if [ "${SALDO_DRY_RUN:-}" = "1" ]; then
  echo "dry run: stopping before prebuild."
  exit 0
fi

# Exported, not prefixed: app.config.ts is evaluated twice — once by prebuild and again by the
# Gradle task that embeds the JS bundle — and the second one is easy to lose when the steps are run
# separately. Gradle inherits this shell, which is the one thing Android has easier than iOS.
export SALDO_SERVER_URL="$SERVER_URL"
export SALDO_BUNDLE_ID="$BUNDLE_ID"
export SALDO_APP_NAME="$APP_NAME"
export SALDO_SCHEME="$SCHEME"

# `--clean` throws away android/ and regenerates it, which is what makes a changed bundle id or
# server address actually land. Anything edited by hand in there is gone; native config belongs in
# app.config.ts and the config plugins (AGENTS.md).
echo "==> prebuild"
npx expo prebuild --platform android --clean

echo "==> gradle assembleRelease"
(cd android && ./gradlew assembleRelease)

if [ ! -f "$APK" ]; then
  echo "error: gradle reported success but produced no $APK." >&2
  exit 1
fi

echo
echo "==> $PWD/$APK"
echo "    $(du -h "$APK" | cut -f1)"
echo

# Which key signed it is the one thing a person needs to know before passing the file on, and
# `keytool -printcert -jarfile` cannot answer it: a v2-only APK is not a signed jar, and keytool
# says exactly that. apksigner is the tool that reads v2.
APKSIGNER=""
if [ -n "${ANDROID_HOME:-}" ]; then
  APKSIGNER="$(ls -d "$ANDROID_HOME"/build-tools/*/apksigner 2>/dev/null | sort -V | tail -1 || true)"
fi

if [ -z "$APKSIGNER" ]; then
  echo "note: no apksigner found under ANDROID_HOME, so the signing key was not checked."
  echo "      Run it yourself before giving this file to anybody:"
  echo "      \$ANDROID_HOME/build-tools/<version>/apksigner verify --print-certs $APK"
  exit 0
fi

CERT="$("$APKSIGNER" verify --print-certs "$APK" | grep 'certificate DN' | head -1 || true)"
echo "==> $CERT"

case "$CERT" in
  *"CN=Android Debug"*)
    echo
    echo "    That is the debug key, not yours: Gradle found none of the four SALDO_UPLOAD_*"
    echo "    properties in ~/.gradle/gradle.properties. The APK installs and runs, and it is fine"
    echo "    for your own phone — but do not publish it or send it to anybody. Every Android"
    echo "    developer has that key, and an APK signed with it cannot be updated later by one"
    echo "    signed with yours: they would have to uninstall, losing anything not yet synced."
    ;;
  *)
    echo
    echo "    Signed with your own key. Keep the keystore and its passwords: an APK signed with a"
    echo "    different key cannot update this one, so losing them means every user uninstalls."
    ;;
esac
