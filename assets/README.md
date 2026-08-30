# assets/

Static images bundled with the app. Referenced from the renderer via
relative paths (`../../assets/...`) in dev, and copied into the packaged
app's resources via `extraResources` in `package.json` — see
`get-assets-path` in `src/main.js`.

## Stamp images

Used by the grid chart (`editor.js`) and photo chart (`photo-editor.js`),
which both keep an identical `STAMP_IMAGES` map keyed by stamp id:

| File | Stamp id | Meaning (per the editor's toolbar tooltip) |
|---|---|---|
| `red-stamp.jpeg` | `red` | Menstruation / bleeding |
| `yellow-stamp.jpeg` | `yellow` | Same discharge pattern |
| `green-stamp.png` | `green` | Dry / infertile |
| `yellow-baby-stamp.png` | `yellow-baby` | Fertile discharge |
| `white-baby-stamp.png` | `white-baby` | Peak-type mucus |
| `green-baby-stamp.png` | `green-baby` | Green / fertile |

The `P` / `1` / `2` / `3` / `I` markers and the correction-mode tilt are
drawn with CSS/text in the editor, not image files.

## Other images

- `blank-chart.png`, `sample-chart.JPG` — reference images, not currently
  loaded by any code path. Keep or remove as needed; nothing depends on them.

## Adding a new stamp

1. Drop the image file here.
2. Add it to `STAMP_IMAGES` in **both** `src/renderer/editor.js` and
   `src/renderer/photo-editor.js` (they're independent copies, not shared).
3. Add a matching `.stamp-option` button in `src/renderer/editor.html`
   (grid chart toolbar) and/or `src/renderer/photo-editor.html` (photo
   chart toolbar).
