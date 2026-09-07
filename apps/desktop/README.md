# 3DSFERA Desktop

A Tauri shell around the same web build. There is no separate 3D code path and
there never will be one: `apps/web` is the single source of the scene, the
catalogue and the checkout, and this window shows it.

## Why it exists

The street is a real location — two and a half million triangles and a hundred
and forty megabytes of texture at full detail. A browser can hold it, and the
quality tiers make sure it does. A desktop install can hold it comfortably: the
assets ship inside the bundle, so there is no first-load wait at all, and the
top tier is the default rather than something the device has to earn.

## Building

```bash
pnpm --filter @3dsfera/desktop run dev      # needs the Rust toolchain
pnpm --filter @3dsfera/desktop run build    # installer for the host platform
```

Installers for macOS (Apple Silicon and Intel) and Windows are built by
`.github/workflows/desktop.yml`, on a tag or on demand. They cannot be
cross-compiled: a `.dmg` can only be made on macOS and an `.msi` only on
Windows, so the workflow is a matrix of three runners.

The icon is generated, not committed as a binary blob:

```bash
pnpm --filter @3dsfera/tools run gen:icon
pnpm --filter @3dsfera/desktop exec tauri icon src-tauri/icon.png
```

## The content security policy is not decoration

`src-tauri/tauri.conf.json` carries a strict CSP, and two of its lines are
load-bearing:

- `worker-src 'self' blob:` — the Draco and Basis decoders run in workers
  created from blob URLs. Without it the street loads with no geometry and no
  textures, and it fails silently inside a Suspense boundary.
- `script-src 'self' 'wasm-unsafe-eval'` — both decoders are WebAssembly.

Everything else the scene needs is served from the bundle itself. Nothing is
fetched from a CDN, which is checked in `docs/architecture.md` under "Что не
должно ходить в чужие CDN" and is the reason this shell works offline.

## WebKit

macOS renders through WKWebView, not Chromium, and the two disagree about
WebGL in ways that need fixing one at a time — compressed texture formats
(ASTC rather than BC), `SharedArrayBuffer` and its COOP/COEP headers, colour
space and tone mapping, and context loss on minimise. `docs/architecture.md`
has the list under "WebKit".
