# Abhinandh Rajeev — Portfolio

My personal portfolio, live at **https://abhinandh23.github.io**.

A static, dependency-free site: electric blue `#0000f2` on paper, condensed display type, mono `// labels` and numbered cards.

```
index.html   content and markup
styles.css   design tokens, layout, responsive and reduced-motion rules
script.js    terminal typewriter, scroll reveal, copy button, mobile nav
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
