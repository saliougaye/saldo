# Building Saldo for iOS

## What you get

Saldo running on your own iPhone, built from this repository. There is no App Store listing, so this
is the only route.

**Read this before you start, because it is the part people are not expecting.** Apple lets you
install an app you built yourself, but with a free Apple ID it does so on a short lease:

- The app **stops working after seven days**. You reopen Xcode, plug the phone in and run it again,
  and the clock restarts. There is a way to automate that, below.
- You can have **three** self-signed apps installed at once.
- You need a Mac. There is no way around that one.

A paid Apple Developer account (99 USD/year) replaces the seven days with a year and the three apps
with a hundred. Nothing else changes — you still build and install it yourself.

**The recommended way to install it is [Sideloadly](https://sideloadly.io).** One command builds an
`.ipa`, and Sideloadly signs it with your Apple ID as it installs it — nothing to set up in Xcode's
signing screens — and, with its automatic refresh turned on, signs it again before the seven days
run out. That route is [building an .ipa](#building-an-ipa-for-a-sideload-tool) below. Running
from Xcode, which the rest of this page walks through, is for when you are changing the app itself.

The build does not need a server. The app works on the phone alone, and asks for a server's address
only if you want one: on the first screen, or later from Profile → Server and sync. To run one, see
[self-hosting Saldo](./self-hosting.md).

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

## The build inputs

Three environment variables are read by `apps/mobile/app.config.ts` — once when you generate the
Xcode project, and again when Xcode bundles the JavaScript. Both readings matter, and the second one
happens inside Xcode, where your shell's environment does not reach. There is a step below for that.
None of them is a server address: that is typed in the app.

| Variable | Default | What it is |
| --- | --- | --- |
| `SALDO_BUNDLE_ID` | `io.github.saldo.app` | The bundle identifier. **You have to change this** — see below. |
| `SALDO_APP_NAME` | `Saldo` | The name under the home-screen icon, and the name of the generated Xcode project. |
| `SALDO_SCHEME` | `saldo` | The URL scheme that carries the finished sign-in back from the browser to the app; the app asks to come back to `<scheme>://auth/callback`. **Changing it is two changes, not one:** the server refuses a redirect whose scheme is not in its `APP_REDIRECT_SCHEMES` (see [self-hosting](./self-hosting.md#configuration)), and the sign-in fails with `invalid_redirect_uri`. Worth changing when another app on the same phone already claims `saldo://`. |

## Generate the Xcode project

```bash
git clone https://github.com/saliougaye/saldo.git
cd saldo
pnpm install

SALDO_BUNDLE_ID=com.example.saldo \
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
same variables when it bundles the JavaScript: without them the bundle embeds the defaults, and with
a `SALDO_SCHEME` of your own the sign-in then redirects to a scheme the app never registered.

The build phase that does the bundling sources `apps/mobile/ios/.xcode.env.local` first, so put them
there:

```bash
cat >> apps/mobile/ios/.xcode.env.local <<'EOF'
export SALDO_BUNDLE_ID=com.example.saldo
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

The first screen offers "Only on this phone" or "With your Saldo server"; the second asks for the
server's address and then offers sign-in. If that server runs with `REGISTRATION=invite` you need a
code first — see [letting people in](./self-hosting.md#letting-people-in).

## Keeping it alive

With a free Apple ID the provisioning profile expires after seven days, and the app refuses to open
until it is renewed. Either:

- **Install with [Sideloadly](https://sideloadly.io) and turn on its automatic refresh
  (recommended).** Its background daemon signs the app again when it is near expiry, whenever it
  can see the phone — over USB, or over Wi-Fi once Wi-Fi sideloading is set up. That needs the
  computer running Sideloadly, so a phone that stays out of its reach for a week still lapses.
- Plug the phone in and press Run in Xcode again, once a week. Nothing is lost — the app's data
  stays on the phone across a reinstall, as long as the bundle identifier is the same.
- [AltStore](https://altstore.io) and [SideStore](https://sidestore.io) do the same job as
  Sideloadly, and also refresh in the background — AltStore from a helper on your Mac, SideStore
  from the device itself.

A paid developer account moves the expiry to a year, which is usually long enough to forget about.

## Building an .ipa for a sideload tool

Those tools want an `.ipa`, and a free Apple ID cannot export one through Xcode's Archive →
Distribute. It does not need to: they sign the app themselves at install time, so what they want is
an **unsigned** build, which is a plain `xcodebuild` plus a zip.

```bash
pnpm --filter mobile build:ipa com.yourname.saldo
```

The argument is optional and defaults to this project's own bundle identifier; pass one of your own
if the tool refuses to sign that. `SALDO_BUNDLE_ID` works as an environment variable instead, as do
`SALDO_APP_NAME` and `SALDO_SCHEME`, and `SALDO_DRY_RUN=1` prints what it would bake in and stops —
worth one run, because the build takes minutes and `--clean` throws `ios/` away before it starts.

The file lands at `apps/mobile/build/Saldo.ipa`. To install it with Sideloadly:

1. Plug the phone in, unlock it, and choose it as the device in Sideloadly.
2. Drag the `.ipa` into Sideloadly and enter your Apple ID.
3. Turn on its **automatic refresh** option, so the app is signed again before the seven days run
   out.
4. Press **Start**.
5. On the phone, turn on **Settings → Privacy & Security → Developer Mode** if iOS asks for it
   (iOS 16 and later), then trust your Apple ID under **Settings → General → VPN & Device
   Management**. Open Saldo from the home screen.

To update the app later, build a new `.ipa` and install it the same way, with the same Apple ID and
the same bundle identifier: it replaces the old one and the data on the phone stays.

Sideloadly offers to rewrite the bundle identifier as it installs. Accepting is fine: the
`saldo://` scheme that carries sign-in back from the browser lives in `Info.plist` and does not
depend on the identifier. What you must not change is the scheme itself unless the server's
`APP_REDIRECT_SCHEMES` changes with it — see [the build inputs](#the-build-inputs) above.

The script is `apps/mobile/scripts/build-ipa.sh`, and it is short enough to read if you would
rather run the steps by hand.

## When it goes wrong

**"Failed to register bundle identifier. The app identifier … is not available."** Somebody has
already claimed it — `io.github.saldo.app` certainly is. Re-run the prebuild with a different
`SALDO_BUNDLE_ID`. Changing it only in Xcode is not enough: the next `--clean` puts the old one
back, because the generated project comes from `app.config.ts`.

**"Untrusted Developer" when the app starts.** Settings → General → VPN & Device Management on the
phone, tap your Apple ID, trust it. This has to be done once per Apple ID, not once per install.

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
