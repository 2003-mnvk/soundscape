# SoundScape

**Turn sound into art.**

## Overview

SoundScape is a browser-based visual studio. It turns live microphone input into animated Canvas artwork. Open the studio in Demo Mode to explore the visuals before granting microphone access.

## Features

- **Particle Bloom** uses bass and volume to expand and brighten a drifting field of luminous particles.
- **Waveform Flow** turns time-domain samples into layered ribbons with soft trails.
- **Circular Spectrum** maps bass, midrange, and treble into a 96-bar radial spectrum.
- Switch between visualizers while keeping the microphone session active. Live meters show volume and frequency-band levels.
- Adjust sensitivity, motion speed, and palette across modes, or change particle density in Particle Bloom. Settings are saved in the browser and can be reset.
- View artwork fullscreen, pause the animation, or export the current frame as a 1× or 2× PNG.

## Technology stack

React, TypeScript, Vite, and Tailwind CSS power the interface. Motion for React and Lucide React provide interface transitions and iconography. The audio and rendering paths use the native Web Audio API and Canvas 2D.

## Architecture

| Area | Responsibility |
| --- | --- |
| `src/audio/` | Owns microphone permission, stream and context cleanup, FFT sampling, and smoothed audio features. |
| `src/visualizers/` | Implements the three renderers, the shared animation loop, device-pixel-ratio resizing, and offscreen PNG export. |
| `src/components/` and `src/hooks/` | Connect the studio UI to the audio engine and Canvas host. Audio samples stay outside React state. |
| `src/settings/` | Defines typed defaults, palettes, and localStorage validation. |
| `tests/` | Covers feature extraction, mocked audio lifecycle, renderer behavior, settings validation, and export checks. |

## Local setup

Use Node.js 24 LTS and npm. From the project directory, run:

```sh
npm ci
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/), or use the URL printed by Vite. Click **Start Microphone** and allow access. Speak or play sound near the microphone and confirm that the meters and artwork respond. Click **Stop Microphone** and confirm the stage returns to Demo Mode.

## Available npm scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Starts the Vite development server with hot reload. |
| `npm run typecheck` | Runs strict TypeScript checks. |
| `npm test` | Compiles the tested modules and runs the Node.js test suite. |
| `npm run build` | Builds the static site into `dist/`. |
| `npm run preview` | Serves the built site locally after a successful build. |

## Browser compatibility

Use a current desktop or mobile browser with Web Audio, Canvas 2D, and MediaDevices support. Microphone access requires a secure context. Use `http://localhost` for local work and a top-level `https://` page in production. A plain HTTP LAN address may load Demo Mode while microphone access is blocked. Browser permissions, OS privacy settings, and embedding policies can also block access. [Media Capture and Streams](https://www.w3.org/TR/mediacapture-streams/), [Secure Contexts](https://www.w3.org/TR/secure-contexts/)

When native fullscreen is unavailable, SoundScape uses an immersive in-page view. Reduced-motion preferences select a still preview. Maximum PNG size and rendering performance depend on the browser and device.

## Microphone privacy

The app requests microphone access only after **Start Microphone** is activated. Audio is sampled and analyzed in browser memory. SoundScape does not record or upload microphone audio or play it back through the speakers. Stopping the microphone or leaving the studio releases the stream and audio context. Local storage holds visualization preferences, and PNG downloads contain only the Canvas artwork and its background.

## Screenshots

*Screenshot placeholder — Particle Bloom in Demo Mode.*

*Screenshot placeholder — Waveform Flow with the settings panel open.*

*Screenshot placeholder — Circular Spectrum in immersive view.*

## Deploy to Vercel

The app builds to static HTML, CSS, and JavaScript. The included `vercel.json` selects the Vite preset, runs `npm ci` and `npm run build`, and publishes `dist/`. No application environment variables or server functions are required. [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)

### Vercel CLI

From the directory containing `vercel.json`, run:

```sh
npm ci
npm run typecheck
npm test
npm run build
npx vercel login
npx vercel link
npx vercel deploy --prod
```

Choose the intended team and project when prompted. Open the HTTPS production URL printed by the CLI and repeat the local microphone check. Also verify mode switching and a PNG download on that URL. [Vercel CLI deployment](https://vercel.com/docs/projects/deploy-from-cli)

### Vercel dashboard

Import the Git repository, set **Root Directory** to the folder containing `vercel.json`, and deploy. If asked for build settings, use **Vite** as the framework, `npm ci` as the install command, `npm run build` as the build command, and `dist` as the output directory. Leave environment variables empty. [Vercel build settings](https://vercel.com/docs/builds/configure-a-build)

## Future enhancements

- Add automated browser tests with a synthetic microphone across Chromium, Firefox, and WebKit.
- Profile sustained frame rates and adapt rendering quality on lower-powered devices.
- Explore local artwork presets, additional visualizers, and optional video export.
