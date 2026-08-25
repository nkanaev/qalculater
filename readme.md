# qalculater

Web version of [Qalculate](https://qalculate.github.io/).

## Setup

Install rerequisities:

* rake
* curl
* emscripten ([installation guide](https://emscripten.org/docs/getting_started/downloads.html))

Run:

```sh
rake build  # builds the project
rake serve  # starts local webserver at http://localhost:8000
```

## Layout

- `src/`      - app source: embind
- `web/`      - deployable site
- `out/`      - build artifacts
