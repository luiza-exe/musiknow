# musiknow

> A web-based studio for guitarists combining Spotify integration with real-time DSP audio tools and AI assistance.

Live App: [musiknow.netlify.app](https://musiknow.netlify.app/)

---

## ⚡ Features

- **Virtual Pedalboard**: 24 audio effect pedals powered by Web Audio API DSP.
- **Chromatic Tuner**: Low-latency pitch detection via autocorrelation algorithm.
- **Persistent Metronome**: Sample-accurate audio clock synchronization.
- **In-Browser Recording**: Direct capture, WAV conversion, and offline storage via IndexedDB.
- **AI Song Assistant**: Contextual song analysis, chord/tuning suggestions, and settings recommendation (powered by Groq).
- **Spotify Integration**: Track search, library sync, and custom collections via OAuth 2.0 (PKCE).
- **Zero-Latency Monitoring**: Direct signal bypass mode for lag-free practice.

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla JS (ES6+), HTML5, CSS3 (Multi-Page Architecture)
- **Audio Engine**: Native Web Audio API, MediaRecorder API
- **Storage**: IndexedDB (Blob/Audio/Playlists), `localStorage`, `sessionStorage`
- **APIs & AI**: Spotify Web API, Groq AI (via Cloudflare Worker), Songsterr API, iTunes API
- **Security**: Content Security Policy (CSP), Strict DOM XSS escaping, OAuth 2.0 PKCE

---

## 📁 Architecture Overview

```
├── index.html        # Auth & Landing page
├── library.html      # Saved track library with dynamic filtering
├── search.html       # Global multi-variant search engine
├── song.html         # Track details, tuning info, & AI chat
├── pedalboard.html   # Virtual pedalboard, metronome, & recorder
├── tuner.html        # Standalone chromatic tuner
├── signal.html       # Audio input diagnostic tool
├── profile.html      # Spotify user profile & stats
└── playlists.html    # Local collections & playlist editor
```

---

## 🚀 Getting Started

No installation required. `musiknow` runs natively in any modern web browser supporting the Web Audio API.

1. Open [https://musiknow.netlify.app/](https://musiknow.netlify.app/)
2. Connect your **Spotify** account or select **Demo Mode**.
3. Plug in your guitar via an audio interface or microphone and start playing.

---

## 🔒 Security & Privacy

- **Local Data First**: All audio recordings, playlists, and user configurations are stored locally on-device using IndexedDB.
- **Secure Credentials**: API calls to Groq pass through a Cloudflare Worker proxy to protect credentials.
- **Defense in Depth**: Strict CSP policies and input sanitization (`escapeHtml`) on all external responses.
