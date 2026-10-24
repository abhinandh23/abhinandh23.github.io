# Abhinandh Rajeev — Portfolio

My personal portfolio, live at **https://abhinandh23.github.io**.

A static, dependency-free site: dark navy with electric-blue `#0000f2` accents, light condensed display type, mono `#labels`, and dithered artwork drawn in the browser on `<canvas>`.

```
index.html   content and markup
styles.css   design tokens, layout, responsive and reduced-motion rules
script.js    dithered artwork, contact terminal, scroll reveal, nav behaviour
resume.pdf   downloadable resume
```

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy

- **Vercel:** `npx vercel` in this folder (no build command; the output directory is `.`).
- **GitHub Pages:** push this folder to a repo and enable Pages on the `main` branch, root folder.

To update content, edit `index.html`. Colors and fonts are CSS variables at the top of `styles.css`.
