# Creighton Model Chart

A desktop app for building Creighton Model NaProTRACKING charts — grid-style
charts and photo-based charts with stamps, correction marks, and text notes —
organized into folders, saved locally on your Mac.

## Installing

1. Go to the [latest release](https://github.com/NoahOrta22/Creighton-Model/releases/latest).
2. Under **Assets**, download `Creighton-Model-Chart-<version>.dmg`.
3. Open the `.dmg` and drag **Creighton Model Chart** into your **Applications** folder.
4. First launch: double-clicking will be blocked by macOS Gatekeeper, since
   this build isn't code-signed with an Apple Developer ID. Instead,
   **right-click the app → Open → confirm "Open"** in the dialog. This is
   only needed once per version you install.

## Updating

The app checks for new versions on launch and periodically while running.
Because it isn't code-signed, it can't install updates automatically — when
a new version is available you'll get a prompt to open the release page,
where you repeat the install steps above (same one-time Gatekeeper unlock
per version).

Your saved charts, photos, and folders are never touched by an install or
update — they live outside the app itself (see below).

## Where your data lives

All saved charts, uploaded photos, and folders are stored under your user
data directory, separate from the installed app:

```
~/Library/Application Support/Creighton Model Chart/
  charts/       one JSON file per chart
  images/       photos used in photo charts
  folders.json  folder list
```

Installing a new version replaces the app bundle only — it never reads from
or writes to this directory.

## Development

```bash
npm install
npm start        # launch the app
```

## Releasing a new version

```bash
npm version patch   # or minor / major — bumps package.json + tags the commit
npm run release      # builds the .dmg/.zip and publishes a GitHub Release
```

Publishing requires a `GH_TOKEN` environment variable (a GitHub personal
access token with `repo` scope) available in your shell — see `~/.zshenv`.
