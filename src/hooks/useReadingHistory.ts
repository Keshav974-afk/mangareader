import { useState, useEffect } from 'react';
import { ReadingProgress, MangaItem, MangaPageInfo } from '../types/atsu';

const HISTORY_KEY = 'atsu_reading_history';
const BOOKMARKS_KEY = 'atsu_bookmarks';

export function useReadingHistory() {
  const [history, setHistory] = useState<Record<string, ReadingProgress>>({});
  const [bookmarks, setBookmarks] = useState<Record<string, any>>({});

  useEffect(() => {
    try {
      const savedHist = localStorage.getItem(HISTORY_KEY);
      if (savedHist) setHistory(JSON.parse(savedHist));

      const savedBooks = localStorage.getItem(BOOKMARKS_KEY);
      if (savedBooks) setBookmarks(JSON.parse(savedBooks));
    } catch (e) {
      console.warn('Could not read from localStorage:', e);
    }
  }, []);

  const saveProgress = (progress: ReadingProgress) => {
    setHistory(prev => {
      const next = { ...prev, [progress.mangaId]: progress };
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const getProgress = (mangaId: string): ReadingProgress | undefined => {
    return history[mangaId];
  };

  const removeHistory = (mangaId: string) => {
    setHistory(prev => {
      const next = { ...prev };
      delete next[mangaId];
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const toggleBookmark = (manga: MangaItem | MangaPageInfo) => {
    setBookmarks(prev => {
      const next = { ...prev };
      if (next[manga.id]) {
        delete next[manga.id];
      } else {
        next[manga.id] = {
          id: manga.id,
          title: manga.title,
          cover: (manga as any).poster?.image || (manga as any).image || '',
          medium: manga.medium,
          type: manga.type,
          mbRating: (manga as any).mbRating || (manga as any).avgRating,
          timestamp: Date.now()
        };
      }
      try {
        localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const isBookmarked = (mangaId: string): boolean => {
    return !!bookmarks[mangaId];
  };

  const historyList = Object.values(history).sort((a, b) => b.timestamp - a.timestamp);
  const bookmarkList = Object.values(bookmarks).sort((a, b) => b.timestamp - a.timestamp);

  return {
    history,
    historyList,
    bookmarks,
    bookmarkList,
    saveProgress,
    getProgress,
    removeHistory,
    toggleBookmark,
    isBookmarked
  };
}
