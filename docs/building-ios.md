# Building Saldo for iOS

## What you get

Saldo running on your own iPhone, built from this repository and talking to the server you run.
There is no App Store listing, so this is the only route.

**Read this before you start, because it is the part people are not expecting.** Apple lets you
install an app you built yourself, but with a free Apple ID it does so on a short lease:

- The app **stops working after seven days**. You reopen Xcode, plug the phone in and run it again,
  and the clock restarts. There is a way to automate that, below.
- You can have **three** self-signed apps installed at once.
- You need a Mac. There is no way around that one.

A paid Apple Developer account (99 USD/year) replaces the seven days with a year and the three apps
with a hundred. Nothing else changes — you still build and install it yourself.

Have the server running first. Its address is compiled into the app rather than typed on the phone,
so you need to know it before you build: see [self-hosting Saldo](./self-hosting.md).

## Before you start

| Check | A right answer | A wrong answer |
| --- | --- | --- |
| `sw_vers -productName` | `macOS` | Anything else: iOS apps can only be signed on a Mac. |
| `xcodebuild -version` | `Xcode 26.x` or whatever is current | `command not found`, or the licence prompt. Install Xcode from the App Store, open it once, accept the licence. |
| `pod --version` | `1.16.x` or later | `command not found`. `brew install cocoapods`, or `sudo gem install cocoapods`. |
| `node --version` | `v22.x` — the major is pinned in `.nvmrc` | A different major. `nvm use` in the checkout picks the right one up. |
| `pnpm --version` | `10.x` | `command not found`. `corepack enable pnpm` installs it. |

You also need an Apple ID signed into Xcode: Xcode → Settings → Accounts → **+** → Apple ID. A
plain, free Apple ID is enough; signing in there is what creates the "Personal Team" you will pick
later.

## The server address is a build input

Saldo does not ask which server to talk to: an app belongs to one server, and which one is decided
when you build it. Four environment variables are read by `apps/mobile/app.config.ts` — once when
you generate the Xcode project, and again when Xcode bundles the JavaScript, which is the reading
the server address comes from. Both readings matter, and the second one happens inside Xcode, where
your shell's environment does not reach. There is a step below for that.

| Variable | Default | What it is |
| --- | --- | --- |
| `SALDO_SERVER_URL` | — (**required**) | The server this build signs in to, e.g. `saldo.example.com`. A bare hostname gets `https://`; spell out `http://` only for a `localhost` you are developing against. Give it an origin, not a URL — a path is rejected. A build without a usable value installs and runs, but its sign-in screen can do nothing except say so. |
| `SALDO_BUNDLE_ID` | `io.github.saldo.app` | The bundle identifier. **You have to change this** — see below. |
| `SALDO_APP_NAME` | `Saldo` | The name under the home-screen icon, and the name of the generated Xcode project. |
| `SALDO_SCHEME` | `saldo` | The URL scheme that carries the finished sign-in back from the browser to the app, and which the server must allow through `APP_REDIRECT_SCHEMES`. **Leave it alone.** The app asks the browser to come back to `saldo://auth/callback` whatever you set here, so a different scheme is registered and then never used, and sign-in never completes. |

## Generate the Xcode project

```bash
git clone https://github.com/saldo-app/saldo.git
cd saldo
pnpm install

SALDO_BUNDLE_ID=com.example.saldo SALDO_SERVER_URL=saldo.example.com \
  pnpm --filter mobile exec expo prebuild --platform ios --clean
```

Put something of yours in place of `com.example.saldo` — reversed domain, or
`com.<your-apple-id-name>.saldo`. **The default `io.github.saldo.app` will not sign.** A free
Personal Team may only claim identifiers nobody else has registered, and that one belongs to this
project.

This writes `apps/mobile/ios/` and runs `pod install` inside it. It takes a few minutes the first
time. The directory is generated and git-ignored: `--clean` deletes and rewrites it on every run, so
never keep anything of your own in there.

## Hand the variables to Xcode

Xcode does not inherit the environment of the terminal you typed that command in, and it needs the
same variables when it bundles the JavaScript: without them the app builds and installs, and its
sign-in screen then says it has no server configured.

The build phase that does the bundling sources `apps/mobile/ios/.xcode.env.local` first, so put them
there:

```bash
cat >> apps/mobile/ios/.xcode.env.local <<'EOF'
export SALDO_BUNDLE_ID=com.example.saldo
export SALDO_SERVER_URL=saldo.example.com
EOF
```

Append rather than overwrite — the file may already hold a `NODE_BINARY` line that prebuild wrote
for you, and Xcode needs that to find Node. The file is git-ignored, and `--clean` deletes it along
with the rest of `ios/`, so this step comes back every time you regenerate the project.

## Sign it

Open the **workspace**, not the project — the workspace is the one that knows about the pods:

```bash
open apps/mobile/ios/Saldo.xcworkspace
```

It is named after `SALDO_APP_NAME`, so it is `Saldo.xcworkspace` unless you changed that.

In Xcode, select the **Saldo** target in the left sidebar, open **Signing & Capabilities**, tick
**Automatically manage signing**, and choose your name followed by "(Personal Team)" in the **Team**
dropdown. The bundle identifier below it should already be the one you passed in. Xcode registers
the identifier and creates a provisioning profile by itself; if it shows a red error here, read
[when it goes wrong](#when-it-goes-wrong) before changing anything.

## Run it on the phone

The default Xcode scheme builds Debug, which needs a Metro bundler running on your Mac to start at
all. You want Release, which bundles the JavaScript into the app and then needs nothing:

1. **Product → Scheme → Edit Scheme… → Run → Info → Build Configuration → Release.** Close the
   sheet.
2. Plug the phone in, unlock it, and trust the Mac if it asks.
3. On the phone, turn on **Settings → Privacy & Security → Developer Mode**, then restart it when
   iOS asks. The switch only appears once a Mac has tried to install something, so if you cannot
   find it, carry on to the next step and come back.
4. Pick the phone from the device menu at the top of the Xcode window, next to the scheme.
5. Press **Run** (⌘R).

The first launch will probably stop with "Untrusted Developer": iOS does not run an app signed by an
account it has not been told about. On the phone, go to **Settings → General → VPN & Device
Management**, tap your Apple ID under "Developer App", and trust it. Then open Saldo from the home
screen.

It will show the sign-in screen for the server you built it against; if that server runs with
`REGISTRATION=invite` you need a code first — see
[letting people in](./self-hosting.md#letting-people-in).

## Keeping it alive

With a free Apple ID the provisioning profile expires after seven days, and the app refuses to open
until it is renewed. Either:

- Plug the phone in and press Run in Xcode again, once a week. Nothing is lost — the app's data
  stays on the phone across a reinstall, as long as the bundle identifier is the same.
- Or install [AltStore](https://altstore.io) or [SideStore](https://sidestore.io). Both refresh the
  signature in the background — AltStore from a helper on your Mac, SideStore from the device
  itself — so the seven days stop being your problem. They install an `.ipa` rather than building
  from Xcode; follow their own instructions for producing one, since the Xcode menus for it move
  between releases.

A paid developer account moves the expiry to a year, which is usually long enough to forget about.

## When it goes wrong

**"Failed to register bundle identifier. The app identifier … is not available."** Somebody has
already claimed it — `io.github.saldo.app` certainly is. Re-run the prebuild with a different
`SALDO_BUNDLE_ID`. Changing it only in Xcode is not enough: the next `--clean` puts the old one
back, because the generated project comes from `app.config.ts`.

**"Untrusted Developer" when the app starts.** Settings → General → VPN & Device Management on the
phone, tap your Apple ID, trust it. This has to be done once per Apple ID, not once per install.

**The app installs, but the sign-in screen says "This build has no server configured. Rebuild the
app with SALDO_SERVER_URL."** Xcode did not see `SALDO_SERVER_URL` when it bundled the JavaScript.
Exporting it in a terminal does not reach Xcode; it has to be in `apps/mobile/ios/.xcode.env.local`,
as above. Check the file is still there — a `prebuild --clean` deletes it — then build again.

**"No account for team … " or "Your maximum App ID limit has been reached".** A free Apple ID may
register ten identifiers every seven days, and each throwaway bundle id you try burns one. Settle on
the identifier you want before experimenting.

**There is no `Saldo.xcworkspace`, only `Saldo.xcodeproj`.** The workspace is written by
CocoaPods at the very end of the prebuild, so its absence means `pod install` did not finish. The
prebuild prints `✔ Installed CocoaPods` when it did; re-run it and read the output rather than
scrolling past it. Do not open the `.xcodeproj` instead — it does not know about the pods and will
not build.

**You edited something under `apps/mobile/ios/` and it disappeared.** That directory is generated,
and `--clean` deletes it. Native configuration belongs in `app.config.ts` or in a config plugin
under `apps/mobile/plugins/`.
