# 3DSFERA Desktop (macOS)

A Tauri shell around the same web build — there is no separate 3D code path and
there never will be one. `apps/web` is the single source of the scene, the
catalog and the checkout.

Status: skeleton only. Stage 6 does the real work — bundling, the icon set, and
fixing the places where WebKit and Chrome disagree about WebGL (see
`docs/architecture.md`, section "WebKit").

```bash
pnpm --filter @3dsfera/desktop run dev    # requires the Rust toolchain
```

Windows is out of scope for this project.
