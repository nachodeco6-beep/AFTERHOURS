# AFTERHOURS

An immersive digital experience for night owls, designers, musicians and creative minds:
a sound room, a private journal and an archive of nocturnal work.

Built with React, TypeScript, Vite, Tailwind CSS v4, Framer Motion and Lucide icons.

**Live site:** https://nachodeco6-beep.github.io/AFTERHOURS/

## Run it locally

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

| Script              | What it does                                                    |
| ------------------- | --------------------------------------------------------------- |
| `npm run build`     | Type-checks and builds to `dist/`                               |
| `npm run preview`   | Serves the production build                                     |
| `npm run typecheck` | TypeScript only                                                 |
| `npm run lint`      | oxlint                                                          |
| `npm run audio`     | Re-synthesises the Sound Room tracks (requires `ffmpeg` on PATH) |
| `npm run deploy`    | Builds for GitHub Pages and publishes `dist/` to the `gh-pages` branch |

## What's inside

- **Hero**: a live canvas landscape (ridgelines and a drifting light that leans toward the pointer),
  the visitor's local clock and time zone, and a masked headline reveal after a short title card.
  The title card plays once per session.
- **01 Sound Room**: four moods, each with its own SVG cover, palette and track. There's one shared
  `<audio>` element, routed through Web Audio for the live spectrum and a gain-based volume
  control (which also works on iOS). The player has a waveform scrubber with keyboard seeking
  (←/→ 5 s, PgUp/PgDn 15 s). Playback states come only from real media events, and missing files
  show an error that names the file.
- **02 The Void**: a journal saved to `localStorage` (`afterhours.journal.v1`). It autosaves,
  shows character and word counts, lets you undo a delete, syncs across tabs and handles blocked
  storage.
- **03 Night Archive**: twelve generative works drawn on canvas from fixed seeds (`src/lib/art.ts`),
  shown as real `<img>` elements. They sit in an asymmetric grid with category filters and a
  detail view you can drive from the keyboard.
- **Motion**: a custom cursor (fine pointers only), scroll reveals and film grain. With
  `prefers-reduced-motion` the intro, loops and transitions are switched off.

## Audio

The four tracks in `public/audio/` were composed for this project by
`scripts/generate-audio.mjs`. It's a small offline synthesiser (oscillators, Karplus–Strong
strings, FM bells and a Freeverb-style reverb), and its output is encoded to MP3 with ffmpeg, so
there are no licensing questions.

To use your own music, replace any of these files with an MP3 of the same name:

```
public/audio/midnight-drive.mp3
public/audio/deep-focus.mp3
public/audio/ocean-at-night.mp3
public/audio/no-sleep-club.mp3
```

Durations are read from the files. The waveform peaks in `src/data/waveforms.json` are produced by
`npm run audio`, so regenerate them (or edit that file) if you want the scrubber shape to match new
audio.

## Project structure

```
src/
  components/        PlayerProvider, Header, Hero(+Canvas), Intro, Cursor, Marquee, Journal, Footer…
    sound/           SoundRoom, MoodCover, Waveform, Spectrum
    archive/         Archive, ArchiveModal, Artwork
  hooks/             useAudioPlayer (player context), useJournal, useDialog, useClock, useTrackDurations
  lib/               art.ts (generative renderers), format.ts
  data/              moods, archive, nav, waveforms.json
scripts/generate-audio.mjs
```

Fonts (Big Shoulders Display, Inter Tight, Instrument Serif, JetBrains Mono) are Google Fonts,
self-hosted through `@fontsource`, so the site makes no third-party requests.
