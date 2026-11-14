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

> **Edge Functions**: The `functions/` folder forwards `/api/*` and `/cdn/*` through a residential proxy using Cloudflare TCP sockets. Proxy credentials are configured as Cloudflare Pages secrets. Same-origin routes avoid browser CORS restrictions; they cannot override an access denial from Atsu.

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

## Cloudflare proxy access and performance

Cloudflare Pages connects directly to the residential proxy using `cloudflare:sockets`, sends HTTP CONNECT for Atsu, then upgrades the tunnel to TLS with Atsu hostname verification. Both `/api/*` and `/cdn/*` use this path. No Railway relay or `ATSU_RELAY_URL` is used.

In **Cloudflare Pages → Settings → Variables and Secrets**, configure the production environment (and preview environment if needed):

- `PROXY_HOST`: `gate-us.vaultproxies.com` (default).
- `PROXY_PORT`: `80` (default).
- `PROXY_AUTH`: secret containing the provider's `username:password`. Never put it in a `VITE_` variable, source file, or Git commit.

Redeploy Pages after saving settings. The proxy provider must accept Cloudflare TCP connections. A proxy authentication failure reports `PROXY_AUTH`; missing configuration reports `PROXY_CONFIG`. Timeouts and connection failures remain errors, never empty catalogs. Live catalog and chapter-image checks are required after deployment; local mock tests and a successful Functions bundle do not establish provider connectivity.

The standalone Node and Vercel handlers also support `PROXY_HOST`, `PROXY_PORT`, and `PROXY_AUTH`. Without credentials they use direct Atsu access, which may be denied.

TLS verification remains enabled. Shared transport has a 12-second deadline, deduplicates concurrent requests, caches successful discovery responses for five minutes and chapter/images for one day, and bounds RAM caching to 32 MiB / 500 entries. Socket responses are limited to 32 MiB. Failed requests are not cached. Reader, search and secondary pages load on demand, and homepage shelves render independently.

Run `npm run build`, `node --test tests/*.test.js`, and `npx wrangler pages functions build --outfile /tmp/mangareader-worker.js`. After deployment, verify `/api/home2/popular?timeframe=daily&offset=0&limit=1` returns HTTP 200 with an `items` array and a returned cover loads via `/cdn/static/…`.
