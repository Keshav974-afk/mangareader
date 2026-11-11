// TypeScript type definitions for Atsu.moe API

export type MediumType = 'Comic' | 'Novel';
export type MangaType = 'Manga' | 'Manwha' | 'Manhua' | 'OEL' | 'Other';

export interface PosterObject {
  id?: string;
  image?: string;
  smallImage?: string;
  mediumImage?: string;
  largeImage?: string;
  poster?: string;
  posterMedium?: string;
  posterSmall?: string;
}

export interface BannerObject {
  url?: string;
  aspectRatio?: number;
  image?: string;
}

export interface MangaItem {
  id: string;
  title: string;
  englishTitle?: string;
  otherNames?: string[];
  type?: MangaType | string;
  medium?: MediumType | string;
  image?: string;
  smallImage?: string;
  mediumImage?: string;
  largeImage?: string;
  poster?: PosterObject | string;
  posterMedium?: string;
  posterSmall?: string;
  banner?: BannerObject | string;
  isAdult?: boolean;
  mbRating?: number;
  views?: number;
  chapterCount?: number;
  status?: string;
  synopsis?: string;
  genres?: Array<{ id: string; name: string; weight?: string }>;
  tags?: string[];
  authors?: string[] | Array<{ id: string; name: string; type?: string }>;
  createdAt?: number;
  updatedAt?: number;
}

export interface MangaPageInfo {
  id: string;
  title: string;
  englishTitle?: string;
  otherNames?: string[];
  synopsis?: string;
  type?: MangaType | string;
  medium: MediumType | string;
  status?: string;
  released?: number | string;
  views?: number;
  avgRating?: number;
  totalChapterCount?: number;
  isAdult?: boolean;
  poster?: PosterObject;
  banner?: BannerObject;
  genres?: Array<{ id: string; name: string; weight?: string }>;
  tags?: string[];
  authors?: Array<{ id: string; name: string; slug?: string; type?: string }>;
  artists?: Array<{ id: string; name: string; slug?: string; type?: string }>;
  recommendations?: any[];
  similarManga?: any[];
  chapters?: Chapter[];
}

export interface Chapter {
  id: string;
  title?: string;
  number: number;
  createdAt?: number;
  index?: number;
  pageCount?: number;
  scanlationMangaId?: string;
}

export interface Page {
  id: string;
  image: string;
  number: number;
  width?: number;
  height?: number;
  aspectRatio?: number;
  spreadStart?: boolean;
}

export interface ReadChapterData {
  id: string;
  title?: string;
  number: number;
  scanlationMangaId?: string;
  pages: Page[];
}

export interface ReadNovelChapterData {
  id: string;
  title?: string;
  number: number;
  scanlationMangaId?: string;
  paragraphs: string[];
  wordCount?: number;
}

export interface ReadingProgress {
  mangaId: string;
  chapterId: string;
  mangaTitle: string;
  chapterTitle: string;
  chapterNumber: number;
  medium: MediumType;
  cover: string;
  pageIndex?: number;
  paragraphIndex?: number;
  totalPages?: number;
  totalParagraphs?: number;
  progressPercent: number;
  timestamp: number;
}

export interface SearchResponse {
  hits: Array<{ document: MangaItem }>;
  items: MangaItem[];
}
