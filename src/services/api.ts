import {
  MangaItem,
  MangaPageInfo,
  Chapter,
  ReadChapterData,
  ReadNovelChapterData,
  PosterObject,
  BannerObject,
  SearchResponse,
  MediumType
} from '../types/atsu';

const CDN_BASE = 'https://cdn.atsu.moe';

const API_PROXY_URL = (import.meta as any).env?.VITE_API_PROXY_URL || '';
const API_BASE = API_PROXY_URL ? `${API_PROXY_URL}/api` : '/api';
const CDN_PREFIX = API_PROXY_URL ? `${API_PROXY_URL}/cdn` : '/cdn';

// 1 Day Cache TTL (86,400,000 ms = 24 Hours)
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

class AtsuApiService {
  private pending = new Map<string, Promise<any>>();
  private memoryCache = new Map<string, { time: number; data: any }>();
  private cacheTtl = ONE_DAY_MS;

  private getCachedData<T>(key: string, maxAgeMs: number): T | null {
    // 1. Check in-memory RAM cache first
    const mem = this.memoryCache.get(key);
    if (mem && Date.now() - mem.time < maxAgeMs) {
      return mem.data as T;
    }

    // 2. Check localStorage for persistence across reloads / offline
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem(`atsu_cache_${key}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.time && Date.now() - parsed.time < maxAgeMs) {
            // Restore into memory cache for sub-millisecond future reads
            this.memoryCache.set(key, parsed);
            return parsed.data as T;
          } else {
            localStorage.removeItem(`atsu_cache_${key}`);
          }
        }
      } catch {
        // LocalStorage parse error or quota
      }
    }

    return null;
  }

  private setCachedData(key: string, data: any): void {
    const entry = { time: Date.now(), data };
    if (this.memoryCache.size >= 200) this.memoryCache.delete(this.memoryCache.keys().next().value);
    this.memoryCache.set(key, entry);

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(`atsu_cache_${key}`, JSON.stringify(entry));
      } catch (e) {
        // Quota exceeded: clean up old cached entries
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('atsu_cache_')) {
              localStorage.removeItem(k);
            }
          }
        } catch {}
      }
    }
  }

  private fetchJson<T>(endpoint: string, cacheDuration = 5 * 60 * 1000): Promise<T> {
    const existing = this.pending.get(endpoint);
    if (existing) return existing;
    const request = this.fetchUnshared<T>(endpoint, Math.min(cacheDuration, endpoint.startsWith('/read/') ? ONE_DAY_MS : 5 * 60 * 1000))
      .finally(() => this.pending.delete(endpoint));
    this.pending.set(endpoint, request);
    return request;
  }

  private async fetchUnshared<T>(endpoint: string, cacheDuration: number): Promise<T> {
    const fullUrl = `${API_BASE}${endpoint}`;

    if (cacheDuration > 0) {
      const cached = this.getCachedData<T>(fullUrl, cacheDuration);
      if (cached !== null) {
        return cached;
      }
    }

    try {
      const res = await fetch(fullUrl, {
        signal: AbortSignal.timeout(15000),
        headers: {
          Accept: 'application/json'
        }
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        if (typeof detail?.error === 'string') throw new Error(detail.error + (detail.code ? ` (${detail.code})` : ''));
        throw new Error(res.status === 403 ? 'Atsu denied access from this server. Please try again later.' : `Unable to load from Atsu (HTTP ${res.status}). Please try again.`);
      }

      const data = await res.json();
      if (cacheDuration > 0) {
        this.setCachedData(fullUrl, data);
      }
      return data as T;
    } catch (err: any) {
      // If network fails, try stale cache before failing
      const stale = this.getCachedData<T>(fullUrl, Infinity);
      if (stale !== null) {
        console.warn(`[API] Network failed for ${endpoint}, using stale 1-day cache`);
        return stale;
      }
      console.error(`Request to ${endpoint} failed:`, err);
      throw err;
    }
  }

  // ---- Home / Popular / Updates (Cached 1 Day) ----
  async getPopular(params?: { timeframe?: 'daily' | 'weekly' | 'monthly' | 'all'; offset?: number; limit?: number; mediums?: string }): Promise<{ items: MangaItem[] }> {
    const tf = params?.timeframe || 'daily';
    const offset = params?.offset ?? 0;
    const limit = params?.limit ?? 24;
    const mediums = params?.mediums ?? 'Comic,Novel';
    return this.fetchJson<{ items: MangaItem[] }>(
      `/home2/popular?timeframe=${tf}&offset=${offset}&limit=${limit}&mediums=${encodeURIComponent(mediums)}`,
      ONE_DAY_MS
    );
  }

  async getHotUpdates(params?: { offset?: number; limit?: number; mediums?: string }): Promise<{ items: MangaItem[] }> {
    const offset = params?.offset ?? 0;
    const limit = params?.limit ?? 24;
    const mediums = params?.mediums ?? 'Comic,Novel';
    return this.fetchJson<{ items: MangaItem[] }>(
      `/home2/hotUpdates?offset=${offset}&limit=${limit}&types=Manga,Manwha,Manhua,OEL,Other&mediums=${encodeURIComponent(mediums)}&contentRatings=Safe,Suggestive,Erotica`,
      ONE_DAY_MS
    );
  }

  async getRecentlyUpdated(params?: { offset?: number; limit?: number; mediums?: string }): Promise<{ items: MangaItem[] }> {
    const offset = params?.offset ?? 0;
    const limit = params?.limit ?? 24;
    const mediumsQuery = params?.mediums ? `&mediums=${encodeURIComponent(params.mediums)}` : '';
    return this.fetchJson<{ items: MangaItem[] }>(
      `/home2/recentlyUpdated?offset=${offset}&limit=${limit}${mediumsQuery}`,
      ONE_DAY_MS
    );
  }

  async getPopularNovels(limit = 24): Promise<{ items: MangaItem[] }> {
    return this.fetchJson<{ items: MangaItem[] }>(
      `/home2/popular?timeframe=daily&offset=0&limit=${limit}&mediums=Novel`,
      ONE_DAY_MS
    );
  }

  async getPopularComics(limit = 24): Promise<{ items: MangaItem[] }> {
    return this.fetchJson<{ items: MangaItem[] }>(
      `/home2/popular?timeframe=daily&offset=0&limit=${limit}&mediums=Comic`,
      ONE_DAY_MS
    );
  }

  // ---- Search (Cached 1 Day) ----
  async search(params: { query: string; page?: number; perPage?: number; medium?: 'all' | MediumType }): Promise<SearchResponse> {
    const { query, page = 1, perPage = 24, medium = 'all' } = params;
    if (!query || !query.trim()) return { hits: [], items: [] };

    let ep = `/search/manga?q=${encodeURIComponent(query.trim())}&query_by=title,englishTitle,otherNames&page=${page}&per_page=${perPage}`;
    if (medium === 'Novel') ep += `&filter_by=medium:=[Novel]`;
    else if (medium === 'Comic') ep += `&filter_by=medium:=[Comic]`;

    const res = await this.fetchJson<{ hits: Array<{ document: MangaItem }> }>(ep, ONE_DAY_MS);
    const hits = res.hits || [];
    return {
      hits,
      items: hits.map(h => h.document).filter(Boolean)
    };
  }

  // ---- Manga / Novel Page (Cached 1 Day) ----
  async getMangaInfo(mangaId: string): Promise<MangaPageInfo> {
    const res = await this.fetchJson<{ mangaPage: MangaPageInfo }>(
      `/manga/page?id=${encodeURIComponent(mangaId)}`,
      ONE_DAY_MS
    );
    return res.mangaPage || (res as any);
  }

  // ---- Chapters (Cached 1 Day) ----
  async getAllChapters(mangaId: string): Promise<Chapter[]> {
    const res = await this.fetchJson<{ chapters: Chapter[] }>(
      `/manga/allChapters?mangaId=${encodeURIComponent(mangaId)}`,
      ONE_DAY_MS
    );
    return res.chapters || [];
  }

  // ---- Chapter Pages (Manga / Comic) (Cached 1 Day / Immutable) ----
  async getChapterPages(mangaId: string, chapterId: string): Promise<ReadChapterData> {
    const res = await this.fetchJson<{ readChapter: ReadChapterData }>(
      `/read/chapter?mangaId=${encodeURIComponent(mangaId)}&chapterId=${encodeURIComponent(chapterId)}`,
      ONE_DAY_MS
    );
    return res.readChapter;
  }

  // ---- Novel Chapter (Text Paragraphs) (Cached 1 Day / Immutable) ----
  async getNovelChapter(mangaId: string, chapterId: string): Promise<ReadNovelChapterData> {
    const res = await this.fetchJson<{ readNovelChapter: ReadNovelChapterData }>(
      `/read/novelChapter?mangaId=${encodeURIComponent(mangaId)}&chapterId=${encodeURIComponent(chapterId)}`,
      ONE_DAY_MS
    );
    return res.readNovelChapter;
  }

  // ---- CDN Image Helpers ----
  // Same-origin CDN route fetches directly from Atsu.
  getImageUrl(imagePath?: string): string {
    if (!imagePath) return '';
    
    // External full URLs
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      if (imagePath.includes('cdn.atsu.moe/')) {
        const pathPart = imagePath.replace(/^https?:\/\/cdn\.atsu\.moe\//, '');
        const cleanPath = pathPart.startsWith('/') ? pathPart : '/' + pathPart;
        const normalized = cleanPath.startsWith('/static/') ? cleanPath : `/static${cleanPath}`;
        return `${CDN_PREFIX}${normalized}`;
      }
      return imagePath;
    }

    const clean = imagePath.startsWith('/') ? imagePath : '/' + imagePath;
    const normalized = clean.startsWith('/static/') ? clean : `/static${clean}`;

    return `${CDN_PREFIX}${normalized}`;
  }

  getPosterUrl(item?: any, preferredSize: 'small' | 'medium' | 'large' = 'medium'): string {
    if (!item) return '';
    if (typeof item === 'string') return this.getImageUrl(item);

    const poster = item.poster || item;
    if (typeof poster === 'string') return this.getImageUrl(poster);

    if (preferredSize === 'small' && (poster.smallImage || poster.posterSmall)) {
      return this.getImageUrl(poster.smallImage || poster.posterSmall);
    }
    if (preferredSize === 'medium' && (poster.mediumImage || poster.posterMedium)) {
      return this.getImageUrl(poster.mediumImage || poster.posterMedium);
    }
    if (preferredSize === 'large' && (poster.largeImage || poster.image)) {
      return this.getImageUrl(poster.largeImage || poster.image);
    }

    const fallback = poster.mediumImage || poster.smallImage || poster.image || poster.poster || poster.posterMedium || poster.posterSmall;
    return this.getImageUrl(fallback);
  }

  getBannerUrl(banner?: BannerObject | string): string {
    if (!banner) return '';
    if (typeof banner === 'string') return this.getImageUrl(banner);
    return this.getImageUrl(banner.url || banner.image);
  }
}

export const api = new AtsuApiService();
