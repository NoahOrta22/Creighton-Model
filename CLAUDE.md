# Creighton Model Chart — Outstanding Work

Tracked gaps found by inspecting the current code (not aspirational — each item below is confirmed missing/incomplete as of this writing).

## Not yet built

- **Export, for both chart types.** `src/main.js` already has the IPC plumbing (`show-save-dialog`, `write-export-file`) and `preload.js` exposes it as `window.api.showSaveDialog` / `window.api.writeExportFile`, but nothing in the renderer calls it.
  - `editor.html` (grid chart) has an `#export-btn` that is `disabled` with `title="Coming soon"` — no click handler exists in `editor.js`.
  - `photo-editor.html` doesn't have an Export button at all.
  - Needs: render the chart (or photo + stamps/text boxes) to an image/PDF client-side, then hand the data to `writeExportFile`.

- **Chart list thumbnails.** `home.js` (`makeCard`) always shows a generic icon instead of a real preview — grid cards say "No preview yet" and photo cards just say "Photo Chart", regardless of actual content.

## Known small bugs / cleanup

- **Undefined CSS variable.** `styles.css` uses `var(--bg-light)` in `.stamp-size-btn` and `.stamp-size-display:focus`, but `--bg-light` is never defined in `:root` — currently resolves to nothing (no fallback), so those backgrounds are silently missing.
- **Dead CSS.** `.photo-item-delete` and its `:hover` rules in `styles.css` are leftover from an old per-stamp delete-button approach; stamp interaction is now handled via manual hit-testing + Pan-mode selection (see `photo-editor.js`), so this CSS has no matching markup anymore. Safe to delete.

## Packaging

- No app icon configured — `package.json`'s `build.mac` has no `icon` field and there's no `icon.icns`/`icon.png` anywhere in the repo, so a packaged build ships with Electron's default icon.
