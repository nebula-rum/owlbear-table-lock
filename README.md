# Table Lock for Owlbear Rodeo

Table Lock turns a chosen scene item into a finite tabletop boundary for [Owlbear Rodeo](https://www.owlbear.rodeo/).

It is designed for layouts such as campaign dashboards, poster-style tables, board games, character-sheet workspaces, star maps, and other scenes where you do not want the camera wandering away from the main background.

## Features

- Choose one scene item as the tabletop boundary.
- Set a per-scene minimum zoom so the tabletop cannot be zoomed out beyond its fit-to-view scale.
- Clamp panning on all four sides so the viewport stays over the tabletop.
- Keep the tabletop centered on an axis when the viewport aspect ratio makes panning on that axis impossible.
- Zoom in normally without restriction.
- Let every connected player calculate the correct boundary for their own browser/window size.
- **Fit Table** instantly reframes the selected tabletop.
- Store configuration in scene metadata, so every Owlbear scene can have its own tabletop.

> **Current limitation:** Owlbear extensions cannot cancel the native pan/zoom input before Owlbear applies it. Table Lock therefore corrects an out-of-bounds viewport immediately afterward. Fast or aggressive camera movement can produce a small elastic/snap-back effect.

## Installation

Once Table Lock is hosted, install it in Owlbear Rodeo by adding the public `manifest.json` URL to your extensions.

For local development, use:

```text
http://localhost:5173/manifest.json
```

## Using Table Lock

1. Open an Owlbear Rodeo room and scene.
2. Select exactly one map, poster, or other scene item that should define the table.
3. Open **Table Lock** from the extensions menu.
4. Choose **Set Selected as Table**.
5. Enable **Table Lock**.
6. Use **Fit Table** to frame the full tabletop.
7. Zoom and pan normally. Table Lock will keep the viewport within the configured tabletop.

The GM controls which item defines the table and whether Table Lock is enabled. Each client enforces the boundary independently using its own viewport dimensions.

## Local development

Requirements:

- Node.js and npm
- An Owlbear Rodeo account

Install dependencies and start Vite:

```bash
npm install
npm run dev -- --host 0.0.0.0
```

Then add this custom extension in Owlbear Rodeo:

```text
http://localhost:5173/manifest.json
```

Useful commands:

```bash
npm test
npm run build
```

## Build

Create a production build with:

```bash
npm run build
```

Vite writes the static extension to `dist/`. The hosted site must make `dist/manifest.json`, `dist/index.html`, `dist/background.html`, and the generated assets available over HTTPS.

## Publish with GitHub + Render

This repository includes `render.yaml`, so it can be deployed as a Render static site.

1. Create a new GitHub repository and push this project to it.
2. In Render, create a new Blueprint or Static Site from that repository.
3. Render builds with `npm ci && npm run build` and publishes `dist/`.
4. The included configuration sends `Access-Control-Allow-Origin: https://www.owlbear.rodeo` for the static site.
5. After deployment, open your public manifest URL, for example:

```text
https://your-render-site.onrender.com/manifest.json
```

6. Add that URL to Owlbear Rodeo as a custom extension and test it in a real room before sharing it publicly.

A custom domain is strongly recommended for a long-lived extension because it lets you change hosting providers later without changing the manifest URL installed by users.

## Before submitting to the Owlbear extension store

The extension should already be hosted and usable through a public manifest URL. Prepare:

- extension title and short description;
- author name or alias;
- externally hosted icon;
- externally hosted hero image/screenshot;
- public manifest URL;
- support / learn-more URL (normally the GitHub repository or Issues page);
- usage instructions and screenshots.

The official Owlbear showcase submission uses a Markdown entry with frontmatter containing those values. Verification is a separate process with additional browser, mobile, accessibility, support, and custom-domain requirements.

## Privacy and permissions

Table Lock does not request browser permissions and does not send campaign data to an external service. Its scene configuration is stored through Owlbear Rodeo's scene metadata APIs.

## License

Table Lock is released under the [MIT License](LICENSE).
