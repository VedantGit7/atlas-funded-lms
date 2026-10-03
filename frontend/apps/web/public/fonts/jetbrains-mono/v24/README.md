# JetBrains Mono v24

Unmodified Google Fonts WOFF2 assets, checked in to remove the Next.js 16.3.5 Google-font query parser and network dependency from release builds. All files match the prior successful build byte-for-byte. The manifest records source URLs, checksums, license checksum, fallback metrics and retrieval date. OFL.txt is the upstream redistribution license.

CSS: src/styles/jetbrains-mono.css. Preserve Unicode ranges, weights, display behavior and CSS variables. Only the Latin subset is preloaded; Inter and Playfair remain scoped to the certificate studio. Public URLs contain the upstream version and a content hash; never overwrite deployed bytes at these URLs. Update the version, CSS, manifest, preloads and regression expectations together.

Sources: [Google Fonts stylesheet](https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap), [license](https://raw.githubusercontent.com/google/fonts/main/ofl/jetbrainsmono/OFL.txt).
