# Contributing to tinythree

Thanks for helping. The project is small on purpose, so contributions are easy to review.

## Setup

```bash
git clone https://github.com/muskec06/tinythree && cd tinythree
npm install
npm test          # unit tests (node:test)
npm run bench     # token benchmark → bench/RESULTS.md, bench/results.json
```

To preview the playground locally, serve the repo root with any static server (`npx serve .` or `python -m http.server`) and open `/playground/`.

## Adding an example scene

1. Write `examples/<name>.t3`. Keep it short and use copies (`mirror`, `array`, `grid`, `radial`, `use`) where they fit.
2. Write the same scene by hand in `bench/threejs/<name>.js`. Make it compact and idiomatic, with loops and helpers allowed, as a skilled developer would write it. The benchmark is only credible if this version is fair.
3. Check both visually: `python tools/render.py examples/<name>.t3 -o out.png --still 2`.
4. Run `npm run bench` and `python bench/chart.py`, then add the scene to the playground's `EXAMPLES` list and to the README gallery.

## Changing the language

- Every new keyword costs prompt tokens, because it has to be explained in `ai/SYSTEM_PROMPT.md`. Add one only if it removes more tokens from typical scenes than it adds to the prompt.
- Update `spec/LANGUAGE.md`, `ai/SYSTEM_PROMPT.md` and the tests in the same pull request.
- Error messages should name the line and, where possible, suggest a fix. Models read them.
