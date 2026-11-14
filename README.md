# Voidflix Manga 📖✨

> A blazing fast, mobile-friendly **Progressive Web App (PWA)** to read thousands of **Manga, Manhwa, Webtoons**, and **Light Novels / Web Novels** online. Built with **React 18 + TypeScript (TSX)**, **Vite**, and **Tailwind CSS**.

[![Deploy to Cloudflare Pages](https://deploy.workers.cloudflare.com/button)](https://dash.cloudflare.com/)

---

## 📱 Features & Highlights

### ⚡ Progressive Web App (PWA)
- **Installable on Any Device**: One-tap "Install App" button in the navigation bar for Android, iOS, Windows, and macOS.
- **Standalone App Experience**: Custom splash screen, brand theme colors (`#07070a`), no browser address bar clutter, and high-resolution maskable app icons.
- **Offline Shell & Fast Caching**: Powered by a custom Service Worker (`/sw.js`) with stale-while-revalidate for assets and dynamic caching for read content.

### 📱 100% Mobile Optimized
- **Floating Thumb Navigation**: Fixed glassmorphic bottom navigation bar on mobile phones (Home, Manga, Search, Novels, Library).
- **Edge-to-Edge Webtoon Strip**: Smooth touch scroll, swipe gestures, and safe-area notch / home indicator support.
- **Touch-Friendly Hit Targets**: Minimum 44px tap areas with tactile active scale animations.

### 📚 Multiple Curated Discovery Shelves + Endless Explore Grid
1. **Trending Today**: Daily top hits.
2. **Weekly Chart Toppers**: Highest-rated titles over the last 7 days.
3. **Hot New Chapters**: Real-time chapter drops from scanlation groups.
4. **Top Light & Web Novels**: High-rated translated fantasy, cultivation, and isekai novels.
5. **Top Manga & Manhwa**: Action, martial arts, romance, and fantasy comics.
6. **All-Time Hall of Fame**: Legendary series with millions of reads.
7. **Recently Added**: Newly archived titles and series.
8. **Endless Explore Grid**: Filter by `All`, `Comics`, or `Novels` with an active **"Load More Titles"** button that dynamically pulls 24 new unique titles each time.

### 📖 Dual Specialized Readers
- **Comic & Webtoon Reader**:
  - Vertical continuous strip mode + Single-page horizontal flip.
  - Page jumper & live thumbnail scrubber.
  - Fit Width, Fit Height, and Fullscreen toggle (`F`).
  - Hotkeys: `A` / `D` or `←` / `→` for page turning, `M` for reading mode.
- **Light Novel Reader**:
  - 5 Reading Themes: `Dark`, `OLED` (true #000000 black), `Sepia`, `Light`, `Navy`.
  - 3 Font Families: Serif (*Merriweather*), Sans-Serif (*Plus Jakarta Sans*), Monospace (*JetBrains Mono*).
  - Custom typography slider (14px – 28px font sizes, line heights, column widths).
  - Real-time reading progress percentage and auto-scroll save.

---

## ☁️ Deploy to Cloudflare Pages

This project is 100% ready for **Cloudflare Pages** deployment with zero extra configuration:

### Method 1: Git Integration (Recommended)
1. Push this repository to GitHub: `https://github.com/Keshav974-afk/mangareader`.
2. In the [Cloudflare Dashboard](https://dash.cloudflare.com/), go to **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
3. Select `Keshav974-afk/mangareader`.
4. Configure Build Settings:
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. Click **Save and Deploy**!

> **Edge Functions**: The `functions/` folder forwards `/api/*` and `/cdn/*` directly to Atsu. No residential proxy, scraper service, R2 cache, or third-party image mirror is required. Same-origin routes avoid browser CORS restrictions; they cannot override an access denial from Atsu.

### Method 2: Direct Wrangler CLI Deploy
```bash
npm run build
npx wrangler pages deploy dist --project-name voidflix-manga
```

---

## 🛠️ Local Development & Running

### 1. Prerequisites
- Node.js 18+

### 2. Development Server (Vite)
```bash
npm install
npm run dev
```
Open **`http://localhost:5173`** in your browser.

### 3. Production Node Server
```bash
npm run build
npm run server
```
Open **`http://localhost:3300`** in your browser.

---

## 📁 Architecture & File Layout

```
├── functions/
│   ├── api/[[path]].js        # Cloudflare Pages API proxy
│   └── cdn/[[path]].js        # Cloudflare Pages CDN image proxy
├── public/
│   ├── icons/                 # PWA icons (192x192, 512x512, SVG)
│   ├── _headers               # Security & caching headers
│   ├── _routes.json           # Cloudflare Pages routing configuration
│   ├── manifest.json          # PWA Manifest
│   └── sw.js                  # Service Worker for offline shell & caching
├── src/
│   ├── components/
│   │   ├── HeroBanner.tsx     # Featured title carousel with touch swipe
│   │   ├── MangaCard.tsx      # Media card with AVIF/JPG fallback
│   │   ├── MangaReader.tsx    # Webtoon & Comic viewer
│   │   ├── MediaShelf.tsx     # Touch-snap horizontal shelf
│   │   ├── Navbar.tsx         # Top bar + mobile fixed bottom navigation
│   │   ├── NovelReader.tsx    # Typography light novel reader
│   │   └── SearchModal.tsx    # Typesense instant search
│   ├── pages/
│   │   ├── BrowsePage.tsx     # Filter directory with pagination
│   │   ├── DetailsPage.tsx    # Series page & chapter list
│   │   ├── HomePage.tsx       # Discovery hub & endless explore grid
│   │   ├── LibraryPage.tsx    # Reading history & bookmarks
│   │   └── ReaderPage.tsx     # Reader coordinator
│   └── services/
│       └── api.ts             # Atsu.moe API & CDN client
├── server.js                  # Standalone zero-dependency Node proxy & server
├── vite.config.ts             # Vite configuration & dev proxy
└── wrangler.toml              # Cloudflare Pages configuration
```

## Direct Atsu access and performance

The Node, Cloudflare Pages, and Vercel handlers use `lib/atsu.js` to request only `atsu.moe` and `cdn.atsu.moe`. No proxy credentials are needed. The browser uses same-origin `/api` and `/cdn` routes because cross-origin browser access depends on Atsu's CORS policy. The Vite development server also forwards directly to Atsu.

Production handlers use a 12-second upstream deadline, share concurrent identical requests, and bound successful response caching to 32 MiB / 500 entries. Discovery responses cache for five minutes; chapter and image responses for one day. Failed requests are never cached or retried automatically. Atsu 403 responses remain failures with an explanatory message; network failures return 502. Allow outbound HTTPS to `atsu.moe` and `cdn.atsu.moe`. If Atsu denies the deployment IP, direct access remains unavailable; this application does not bypass that restriction.

Reader, search, and secondary routes load on demand. Homepage shelves render independently, covers decode asynchronously, and browser requests share in-flight work. The service worker leaves API freshness to the API client and HTTP cache.

Validate with `npm run build` and `node --test tests/atsu.test.js`. After `npm run server`, verify `/api/health`, `/`, and `/api/home2/popular?timeframe=daily&offset=0&limit=1`. The health endpoint checks the server only; live catalog readiness requires HTTP 200 with an `items` array from the catalog endpoint.
