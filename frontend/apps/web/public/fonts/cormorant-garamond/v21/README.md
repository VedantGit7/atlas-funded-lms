# Cormorant Garamond v21

These unmodified WOFF2 files are the same Google Fonts assets previously downloaded by `next/font/google`. They are bundled to avoid the recurring Next 16.3.5 Google-font query transformation failure during release builds. The original failed CI HTTP payload was not retained; a query-bearing font URL reproduces the exact parser failure in an isolated app.

`manifest.json` records source URLs, SHA-256 checksums, sizes, retrieval date and fallback metrics. `OFL.txt` is the upstream redistribution license. CSS lives in `src/styles/cormorant-garamond.css`, preserving all 30 original faces, language ranges, weights and styles. Only the two Latin files are preloaded (77,080 bytes total). The Next 16.3.5 Times New Roman fallback metrics are preserved.

The URL namespace is immutable and files include a content hash. A future update must use a new version directory, update CSS/preloads/manifest together, retain the license and verify rendering. Do not overwrite deployed bytes at an existing URL. The remaining application font families are also vendored under their own versioned directories.

Keep the CSS family named `Cormorant Garamond`: the certificate editor also selects it by that literal name, independently of `--font-cormorant`. Both interfaces must resolve to the same font files.

Sources: [Google Fonts family](https://fonts.google.com/specimen/Cormorant+Garamond), [upstream license](https://github.com/google/fonts/blob/main/ofl/cormorantgaramond/OFL.txt), [Next 16.3.5 parser](https://github.com/vercel/next.js/blob/v16.3.5/crates/next-core/src/next_font/google/mod.rs#L586-L596).
