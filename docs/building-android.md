# Building Saldo for Android

## What you get

One file — `app-release.apk` — signed with a key you made yourself and pointed at the server you
run. You copy it onto a phone and install it. There is no Play Store listing and there is not going
to be one, so building it is the only way to have it.

Have the server running first. The address is compiled into the app, not typed on the phone, so you
need to know it before you build: see [self-hosting Saldo](./self-hosting.md).

## Before you start

Check each of these before you clone anything. Every failure below is much easier to read here than
halfway through a Gradle build.

| Check | A right answer | A wrong answer |
| --- | --- | --- |
| `java -version` | `openjdk version "17.0.2"` — any 17.x | `command not found`, or a version under 17. Install a JDK 17 (Temurin, Zulu, or the one bundled with Android Studio). |
| `adb --version` | `Android Debug Bridge version 1.0.41` | `command not found` — either the Android SDK is missing, or its `platform-tools` directory is not on your `PATH`. |
| `echo $ANDROID_HOME` | The SDK directory, e.g. `/Users/you/Library/Android/sdk` | Nothing at all. The build stops with `SDK location not found`. |
| `node --version` | `v22.x` — the major is pinned in `.nvmrc` | A different major. `nvm use` in the checkout picks the right one up. |
| `pnpm --version` | `10.x` | `command not found`. `corepack enable pnpm` installs it. |

The easiest way to get the SDK is to install Android Studio and let it do it; you never have to open
the IDE again afterwards. Then put this in your shell profile, so it is there next time too:

```bash
# macOS
export ANDROID_HOME="$HOME/Library/Android/sdk"
# Linux: export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$ANDROID_HOME/platform-tools:$PATH"
```

## The server address is a build input

Saldo does not ask which server to talk to: an app belongs to one server, and which one is decided
when you build it. Four environment variables are read by `apps/mobile/app.config.ts` — once when
the native project is generated, and again when Gradle embeds the JavaScript. Set them in front of
the build command and both readings see them.

| Variable | Default | What it is |
| --- | --- | --- |
| `SALDO_SERVER_URL` | — (**required**) | The server this build signs in to, e.g. `saldo.example.com`. A bare hostname gets `https://`; spell out `http://` only for a `localhost` you are developing against. Give it an origin, not a URL — a path is rejected. A build without a usable value installs and runs, but its sign-in screen can do nothing except say so. |
| `SALDO_APP_NAME` | `Saldo` | The name under the launcher icon. |
| `SALDO_BUNDLE_ID` | `io.github.saldo.app` | The Android application id. **A fork must change this** — it is the app's identity on the device, and two apps cannot share one. `com.example.saldo` is the shape. |
| `SALDO_SCHEME` | `saldo` | The URL scheme that carries the finished sign-in back from the browser to the app, and which the server must allow through `APP_REDIRECT_SCHEMES`. **Leave it alone.** The app asks the browser to come back to `saldo://auth/callback` whatever you set here, so a different scheme is registered and then never used, and sign-in never completes. |

## Make a keystore

Android identifies an app by the key that signed it, so you need one of your own. Make it once, and
keep it somewhere that is not the checkout:

```bash
mkdir -p ~/keys && cd ~/keys
keytool -genkeypair -v -storetype PKCS12 -keystore saldo-release.keystore \
  -alias saldo -keyalg RSA -keysize 2048 -validity 10000
```

It asks for a password twice, then for a name, an organisation and a country. None of those identity
fields matter for an app nobody publishes — the name you type is what you will see when you check
the signature later, so make it something you will recognise. A PKCS12 keystore has **one** password: keytool
never asks for a separate key password, and the store password is also the key password.

**Back up the file and the password, and do not lose either.** An APK signed with a different key
cannot update one that is already installed — Android refuses it outright. If the key goes, the only
way forward for everyone who has Saldo on their phone is to uninstall and reinstall, which throws
away whatever had not yet synced to your server.

## Tell Gradle about it

Gradle finds the keystore through four properties in `~/.gradle/gradle.properties`. Create the file
if it is not there:

```properties
SALDO_UPLOAD_STORE_FILE=/Users/you/keys/saldo-release.keystore
SALDO_UPLOAD_STORE_PASSWORD=the password you just typed
SALDO_UPLOAD_KEY_ALIAS=saldo
SALDO_UPLOAD_KEY_PASSWORD=the same password again
```

The path must be absolute. They live in your home directory rather than in the repository for two
reasons: `apps/mobile/android/` is regenerated from scratch on every build and is git-ignored, so
anything you write there by hand is gone by the next one; and a password inside a git checkout is a
password waiting to be pushed.

A config plugin, `apps/mobile/plugins/withReleaseSigning.js`, reads those four and wires up
`signingConfigs.release` each time the project is regenerated — which it has to do every time,
because the generated project is thrown away and rewritten by each build.

If it cannot find them the build still finishes, because a machine with no keystore — CI, or someone
who only wants to check that the app compiles — must still be able to run `assembleRelease`. What it
produces is signed with the debug key instead, and it says so:

```
Saldo: no SALDO_UPLOAD_STORE_FILE property, so this release build is signed with the shared
Android debug key. It is fine for testing and must not be given to anyone.
```

That line is easy to lose in Gradle's output, so if the APK is going anywhere near another person,
check the signature rather than trusting that you read the log:
[check that it is really signed](#check-that-it-is-really-signed).

## Build it

```bash
git clone https://github.com/saldo-app/saldo.git
cd saldo
pnpm install

SALDO_SERVER_URL=saldo.example.com pnpm --filter mobile build:android
```

That one script does both halves: `expo prebuild --platform android --clean` regenerates the native
project with your variables in it, then `./gradlew assembleRelease` compiles it. The first run
downloads a Gradle distribution and compiles every native module, so give it a quarter of an hour
and a network connection; later runs are much shorter.

Note that the variables go on the same line as the command, in front of it, so that they are set for
the whole thing. `app.config.ts` is read **twice** — once by the prebuild, and again by Gradle when
it embeds the JavaScript bundle — and the server address comes from the second reading. Exporting
the variables in one terminal and building in another, or setting them only for the prebuild, gives
you an app that installs cleanly and then cannot sign in.

What you are after is:

```
apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

## Check that it is really signed

Ask `apksigner` who signed it. It is not on your `PATH`; it ships with the SDK's build tools, so
reach for it by path and use the newest version you have installed:

```bash
"$ANDROID_HOME"/build-tools/36.0.0/apksigner verify --print-certs \
  apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

The answer names the certificate you made:

```
Signer #1 certificate DN: CN=Saldo, OU=, O=, L=, ST=, C=IT
Signer #1 certificate SHA-256 digest: f7da5723d0690488e8e37029585675dfb0c6c5f97bf3b77d8af1220c359b5e88
```

If instead you see `CN=Android Debug, O=Android, C=US`, the build fell back to the debug key that
ships with the React Native template — the same key, with the same published password, that is on
every machine in the world. Do not hand that APK to anybody.

`keytool -printcert -jarfile` answers "Not a signed jar file" here, and that is not a problem with
the APK. The build signs with APK Signature Scheme v2 and does not add the older JAR signature that
keytool knows how to read; `apksigner verify -v` will show you `v2 scheme … true` against `v1 scheme
(JAR signing) … false`.

## Install it

With the phone plugged in and USB debugging on (Settings → Developer options):

```bash
adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

`-r` replaces an existing Saldo and keeps its data — which works only when the old one was signed
with this same key.

Without a cable: copy the APK to the phone however you like and open it in the phone's file manager.
Android will refuse the first time and offer a settings screen; allow the file manager (or browser)
to install unknown apps, then open the APK again. It is under Settings → Apps → Special app access →
Install unknown apps if you need to find it later.

Then open Saldo. It will show the sign-in screen for the server you built it against; if that server
runs with `REGISTRATION=invite` you need a code first — see
[letting people in](./self-hosting.md#letting-people-in).

## When it goes wrong

**`SDK location not found. Define a valid SDK location with an ANDROID_HOME environment variable.`**
`ANDROID_HOME` is not set in the shell you ran the build from. Export it (see above) and run again.

**The app installs, but the sign-in screen says "This build has no server configured. Rebuild the app
with SALDO_SERVER_URL."** The variable was not in the environment for the whole build. It is read
when Gradle embeds the JavaScript bundle, not only by the prebuild, so a shell that exported it for
one half and not the other produces exactly this. Put it in front of
`pnpm --filter mobile build:android` and run the two halves as one command.

**The build succeeded, but `apksigner` says `CN=Android Debug`.** Gradle never saw your properties,
so it fell back to the debug key and printed the warning above. The fallback keys off
`SALDO_UPLOAD_STORE_FILE` alone, so a typo in exactly that name is the likeliest cause. Check that
all four are in `~/.gradle/gradle.properties` — the file in your home directory, not one inside the
repository — that none of the names is misspelled, and that `SALDO_UPLOAD_STORE_FILE` is an absolute
path to a file that exists. From `apps/mobile/android`,
`./gradlew -q :app:properties | grep SALDO_UPLOAD_STORE_FILE` shows you whether Gradle loaded it at
all. Grep for that one name rather than the whole prefix: the task prints property values, and the
other three are your passwords.

**`INSTALL_FAILED_UPDATE_INCOMPATIBLE`**, or "App not installed" on the phone. Saldo is already
installed under this application id, signed with a different key — often a debug build, or an APK
from a machine whose keystore you no longer have. The only way past it is to uninstall first
(`adb uninstall io.github.saldo.app`), and **that deletes the local database**: anything on that
phone that had not reached your server is gone. If the phone is signed in and has finished syncing,
you lose nothing.

**`Failed to read key saldo from store …: keystore password was incorrect`.** The store password and
the key password are the same string for a PKCS12 keystore; set both properties to it.
`keytool -list -keystore ~/keys/saldo-release.keystore` will tell you whether the password you have
is the right one.

**The build fails somewhere in `:app:` after you edited something under `apps/mobile/android/`.**
That directory is generated. Every build begins by deleting it. Whatever you need to change belongs
in `app.config.ts` or in a config plugin under `apps/mobile/plugins/`.
