#!/usr/bin/env bash
#
# Builds an unsigned .ipa for sideloading with Sideloadly, AltStore or SideStore.
#
#   pnpm --filter mobile build:ipa saldo.example.com
#   SALDO_SERVER_URL=saldo.example.com pnpm --filter mobile build:ipa
#
# **Unsigned on purpose.** Sideloadly signs the app with your own Apple ID when it installs it, so
# there is nothing here for Xcode to sign and no certificate to arrange first. That is also why
# this does not use Xcode's Archive → Distribute: a free Apple ID cannot export an .ipa that way,
# and the sideload tools do not want one that was.
#
# What comes out lasts **7 days** on a free Apple ID, and you may have 3 sideloaded apps at once.
# Re-run and re-install when it lapses, or use SideStore, which refreshes itself over wifi.
#
# See docs/building-ios.md for the whole path, including what to do when it goes wrong.

set -euo pipefail

cd "$(dirname "$0")/.."

# The server is a build input, not something typed on the phone (§15). Argument first, then the
# environment, so both spellings in the header work.
SERVER_URL="${1:-${SALDO_SERVER_URL:-}}"
BUNDLE_ID="${2:-${SALDO_BUNDLE_ID:-io.github.saldo.app}}"
APP_NAME="${SALDO_APP_NAME:-Saldo}"
SCHEME="${SALDO_SCHEME:-saldo}"
OUT="${SALDO_IPA_OUT:-$PWD/build/$APP_NAME.ipa}"

if [ -z "$SERVER_URL" ]; then
  echo "error: no server address." >&2
  echo "  pnpm --filter mobile build:ipa saldo.example.com" >&2
  echo "  SALDO_SERVER_URL=saldo.example.com pnpm --filter mobile build:ipa" >&2
  echo >&2
  echo "The app signs in to exactly one server and the address is baked in here." >&2
  exit 1
fi

# A free Personal Team cannot claim an id somebody else registered, and the default is this
# project's own. Worth saying once rather than letting Sideloadly fail with a signing error.
if [ "$BUNDLE_ID" = "io.github.saldo.app" ]; then
  echo "note: building with the default bundle id io.github.saldo.app."
  echo "      If Sideloadly refuses to sign it, pass one of your own:"
  echo "      pnpm --filter mobile build:ipa $SERVER_URL com.yourname.saldo"
  echo
fi

echo "==> server   $SERVER_URL"
echo "==> bundle   $BUNDLE_ID"
echo "==> scheme   $SCHEME://"
echo "==> output   $OUT"
echo

# `SALDO_DRY_RUN=1` stops here, having printed what it would bake in. The build takes minutes and
# `--clean` throws ios/ away, so checking the four values first is cheaper than reading them back
# off a finished app.
if [ "${SALDO_DRY_RUN:-}" = "1" ]; then
  echo "dry run: stopping before prebuild."
  exit 0
fi

# `--clean` throws away ios/ and regenerates it, which is what makes a changed bundle id or server
# address actually land. Anything edited by hand in there is gone; native config belongs in
# app.config.ts and the config plugins (AGENTS.md).
echo "==> prebuild"
SALDO_SERVER_URL="$SERVER_URL" \
SALDO_BUNDLE_ID="$BUNDLE_ID" \
SALDO_APP_NAME="$APP_NAME" \
SALDO_SCHEME="$SCHEME" \
  npx expo prebuild --platform ios --clean

# Xcode inherits nothing from this shell. The "Bundle React Native code and images" build phase
# sources .xcode.env.local, and that is the *second* time app.config.ts is evaluated — miss it and
# the build succeeds with an empty extra.serverUrl, so the app starts and says it has no server.
# Appended, never overwritten: prebuild writes NODE_BINARY in there.
echo "==> passing the build inputs to Xcode"
{
  echo "export SALDO_SERVER_URL=$SERVER_URL"
  echo "export SALDO_BUNDLE_ID=$BUNDLE_ID"
  echo "export SALDO_APP_NAME=$APP_NAME"
  echo "export SALDO_SCHEME=$SCHEME"
} >> ios/.xcode.env.local

# The workspace is named after SALDO_APP_NAME, so find it rather than assuming "Saldo".
WORKSPACE="$(cd ios && ls -d ./*.xcworkspace | head -1)"
if [ -z "$WORKSPACE" ]; then
  echo "error: prebuild produced no .xcworkspace under apps/mobile/ios." >&2
  echo "It is written by CocoaPods at the end of prebuild — re-read the output above for the" >&2
  echo "pod install step, which is where this fails when it fails." >&2
  exit 1
fi
XCSCHEME="$(basename "$WORKSPACE" .xcworkspace)"

echo "==> xcodebuild ($XCSCHEME, Release, device, unsigned)"
(cd ios && xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$XCSCHEME" \
  -configuration Release \
  -sdk iphoneos \
  -derivedDataPath build \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGNING_ALLOWED=NO \
  build)

APP="ios/build/Build/Products/Release-iphoneos/$XCSCHEME.app"
if [ ! -d "$APP" ]; then
  echo "error: xcodebuild reported success but produced no $APP." >&2
  exit 1
fi

# An .ipa is a zip with the .app inside a directory called Payload, and nothing else is required.
echo "==> packaging"
rm -rf build/ipa "$OUT"
mkdir -p build/ipa/Payload "$(dirname "$OUT")"
cp -R "$APP" build/ipa/Payload/
(cd build/ipa && zip -qry "$OUT" Payload)
rm -rf build/ipa

echo
echo "==> $OUT"
echo "    $(du -h "$OUT" | cut -f1)"
echo
echo "Open Sideloadly, drag that file in, enter your Apple ID, Start."
echo "Sideloadly may offer to change the bundle id: accepting is fine, the $SCHEME:// scheme that"
echo "carries sign-in back to the app lives in Info.plist and does not depend on it."
