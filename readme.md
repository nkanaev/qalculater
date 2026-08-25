# qalculater

Web version of [Qalculate](https://qalculate.github.io/): a single page with a
JS wrapper around a libqalculate WASM build.

## Prerequisites

The host is assumed to have emscripten preinstalled and activated. See the
[emscripten download guide](https://emscripten.org/docs/getting_started/downloads.html).

Verify with `emcc --version`. Also required: `rake`, `make`, `curl`.

## Build

`rake build` fetches gmp, mpfr, libxml2 and libqalculate 5.11.0, cross-compiles
them with emscripten, and links the bindings in `src/entry.cpp` into
`public/qalc.js` + `public/qalc.wasm`.

Run locally:

```sh
rake serve   # http://localhost:8000
```

## Layout

- `src/`      — app source: `entry.cpp` (embind bindings), `index.html`, `main.js`, `style.css`
- `public/`   — generated deployable site
- `out/`      — build artifacts: `pkg/` (tarballs), `dep/` (extracted sources), `build/` (compiled libs + install prefix)
