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

class AtsuApiService {
  private cache = new Map<string, { time: number; data: any }>();
  private cacheTtl = 2 * 60 * 1000; // 2 minutes

  private async fetchJson<T>(endpoint: string, cacheDuration = 0): Promise<T> {
    const fullUrl = `${API_BASE}${endpoint}`;

    if (cacheDuration > 0 && this.cache.has(fullUrl)) {
      const entry = this.cache.get(fullUrl)!;
      if (Date.now() - entry.time < cacheDuration) {
        return entry.data as T;
      }
    }

    try {
      const res = await fetch(fullUrl, {
        headers: {
          Accept: 'application/json'
        }
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`API error ${res.status}: ${text.slice(0, 100)}`);
      }

      const data = await res.json();
      if (cacheDuration > 0) {
        this.cache.set(fullUrl, { time: Date.now(), data });
      }
      return data as T;
    } catch (err: any) {
      console.error(`Request to ${endpoint} failed:`, err);
      throw err;
    }
  }

  // ---- Home / Popular / Updates ----
  async getPopular(params?: { timeframe?: 'daily' | 'weekly' | 'monthly' | 'all'; offset?: number; limit?: number; mediums?: string }): Promise<{ items: MangaItem[] }> {
    const tf = params?.timeframe || 'daily';
    const offset = params?.offset ?? 0;
    const limit = params?.limit ?? 24;
    const mediums = params?.mediums ?? 'Comic,Novel';
    return this.fetchJson<{ items: MangaItem[] }>(
      `/home2/popular?timeframe=${tf}&offset=${offset}&limit=${limit}&mediums=${encodeURIComponent(mediums)}`,
      60000
    );
  }

  async getHotUpdates(params?: { offset?: number; limit?: number; mediums?: string }): Promise<{ items: MangaItem[] }> {
    const offset = params?.offset ?? 0;
    const limit = params?.limit ?? 24;
    const mediums = params?.mediums ?? 'Comic,Novel';
    return this.fetchJson<{ items: MangaItem[] }>(
      `/home2/hotUpdates?offset=${offset}&limit=${limit}&types=Manga,Manwha,Manhua,OEL,Other&mediums=${encodeURIComponent(mediums)}&contentRatings=Safe,Suggestive,Erotica`,
      60000
    );
  }

  async getRecentlyUpdated(params?: { offset?: number; limit?: number }): Promise<{ items: MangaItem[] }> {
    const offset = params?.offset ?? 0;
    const limit = params?.limit ?? 24;
    return this.fetchJson<{ items: MangaItem[] }>(
      `/home2/recentlyUpdated?offset=${offset}&limit=${limit}`,
      60000
    );
  }

  async getPopularNovels(limit = 24): Promise<{ items: MangaItem[] }> {
    return this.fetchJson<{ items: MangaItem[] }>(
      `/home2/popular?timeframe=daily&offset=0&limit=${limit}&mediums=Novel`,
      60000
    );
  }

  async getPopularComics(limit = 24): Promise<{ items: MangaItem[] }> {
    return this.fetchJson<{ items: MangaItem[] }>(
      `/home2/popular?timeframe=daily&offset=0&limit=${limit}&mediums=Comic`,
      60000
    );
  }

  // ---- Search ----
  async search(params: { query: string; page?: number; perPage?: number; medium?: 'all' | MediumType }): Promise<SearchResponse> {
    const { query, page = 1, perPage = 24, medium = 'all' } = params;
    if (!query || !query.trim()) return { hits: [], items: [] };

    let ep = `/search/manga?q=${encodeURIComponent(query.trim())}&query_by=title,englishTitle,otherNames&page=${page}&per_page=${perPage}`;
    if (medium === 'Novel') ep += `&filter_by=medium:=[Novel]`;
    else if (medium === 'Comic') ep += `&filter_by=medium:=[Comic]`;

    const res = await this.fetchJson<{ hits: Array<{ document: MangaItem }> }>(ep, 30000);
    const hits = res.hits || [];
    return {
      hits,
      items: hits.map(h => h.document).filter(Boolean)
    };
  }

  // ---- Manga / Novel Page ----
  async getMangaInfo(mangaId: string): Promise<MangaPageInfo> {
    const res = await this.fetchJson<{ mangaPage: MangaPageInfo }>(
      `/manga/page?id=${encodeURIComponent(mangaId)}`,
      120000
    );
    return res.mangaPage || (res as any);
  }

  // ---- Chapters ----
  async getAllChapters(mangaId: string): Promise<Chapter[]> {
    const res = await this.fetchJson<{ chapters: Chapter[] }>(
      `/manga/allChapters?mangaId=${encodeURIComponent(mangaId)}`,
      60000
    );
    return res.chapters || [];
  }

  // ---- Chapter Pages (Manga / Comic) ----
  async getChapterPages(mangaId: string, chapterId: string): Promise<ReadChapterData> {
    const res = await this.fetchJson<{ readChapter: ReadChapterData }>(
      `/read/chapter?mangaId=${encodeURIComponent(mangaId)}&chapterId=${encodeURIComponent(chapterId)}`,
      300000
    );
    return res.readChapter;
  }

  // ---- Novel Chapter (Text Paragraphs) ----
  async getNovelChapter(mangaId: string, chapterId: string): Promise<ReadNovelChapterData> {
    const res = await this.fetchJson<{ readNovelChapter: ReadNovelChapterData }>(
      `/read/novelChapter?mangaId=${encodeURIComponent(mangaId)}&chapterId=${encodeURIComponent(chapterId)}`,
      300000
    );
    return res.readNovelChapter;
  }

  // ---- CDN Image Helpers ----
  // Points directly to https://cdn.atsu.moe (paired with <meta name="referrer" content="no-referrer"> to load images at max speed with 0 proxy credits)
  getImageUrl(imagePath?: string): string {
    if (!imagePath) return '';
    
    // External full URLs
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }

    const clean = imagePath.startsWith('/') ? imagePath : '/' + imagePath;
    if (clean.startsWith('/static/')) {
      return `${CDN_BASE}${clean}`;
    }
    return `${CDN_BASE}/static${clean}`;
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
