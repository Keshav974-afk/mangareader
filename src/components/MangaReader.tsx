import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  List,
  ArrowLeft,
  Columns,
  Scroll,
  X,
  Loader2,
  Settings
} from 'lucide-react';
import { Chapter, MangaPageInfo, Page } from '../types/atsu';
import { api } from '../services/api';
import { useReadingHistory } from '../hooks/useReadingHistory';

interface MangaReaderProps {
  mangaId: string;
  chapterId: string;
  mangaInfo?: MangaPageInfo;
  allChapters: Chapter[];
  onNavigate: (route: string) => void;
}

export const MangaReader: React.FC<MangaReaderProps> = ({
  mangaId,
  chapterId,
  mangaInfo,
  allChapters,
  onNavigate
}) => {
  const [pages, setPages] = useState<Page[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'webtoon' | 'single'>(
    (localStorage.getItem('atsu_manga_mode') as any) || 'webtoon'
  );
  const [fit, setFit] = useState<'width' | 'height' | 'original'>(
    (localStorage.getItem('atsu_manga_fit') as any) || 'width'
  );
  const [controlsVisible, setControlsVisible] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const controlsTimeoutRef = useRef<any>(null);
  const { saveProgress, getProgress } = useReadingHistory();

  // Sort chapters
  const sortedChapters = [...allChapters].sort((a, b) => Number(a.number) - Number(b.number));
  const currentChapterIndex = sortedChapters.findIndex(c => String(c.id) === String(chapterId));
  const currentChapter = sortedChapters[currentChapterIndex] || null;
  const prevChapter = currentChapterIndex > 0 ? sortedChapters[currentChapterIndex - 1] : null;
  const nextChapter = currentChapterIndex < sortedChapters.length - 1 ? sortedChapters[currentChapterIndex + 1] : null;

  // Load chapter pages
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    api.getChapterPages(mangaId, chapterId)
      .then(data => {
        if (!isMounted) return;
        const pageList = data.pages || [];
        setPages(pageList);

        // Resume saved page
        const saved = getProgress(mangaId);
        if (saved && String(saved.chapterId) === String(chapterId) && saved.pageIndex) {
          setCurrentPage(Math.min(saved.pageIndex, pageList.length - 1));
        } else {
          setCurrentPage(0);
        }
        setIsLoading(false);
      })
      .catch(err => {
        if (!isMounted) return;
        setError(err.message || 'Failed to load chapter pages');
        setIsLoading(false);
      });

    return () => { isMounted = false; };
  }, [mangaId, chapterId]);

  // Auto-hide controls
  const scheduleHideControls = () => {
    clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, 4000);
  };

  useEffect(() => {
    scheduleHideControls();
    return () => clearTimeout(controlsTimeoutRef.current);
  }, [currentPage, mode]);

  // Save progress
  useEffect(() => {
    if (pages.length > 0 && currentChapter) {
      saveProgress({
        mangaId,
        chapterId,
        mangaTitle: mangaInfo?.title || 'Manga',
        chapterTitle: currentChapter.title || `Chapter ${currentChapter.number}`,
        chapterNumber: currentChapter.number,
        medium: 'Comic',
        cover: api.getPosterUrl(mangaInfo, 'small'),
        pageIndex: currentPage,
        totalPages: pages.length,
        progressPercent: Math.round(((currentPage + 1) / pages.length) * 100),
        timestamp: Date.now()
      });
    }
  }, [currentPage, pages.length, chapterId]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === ' ') {
        nextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'a') {
        prevPage();
      } else if (e.key === 'f') {
        toggleFullscreen();
      } else if (e.key === 'Escape') {
        setDrawerOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, pages.length, currentChapterIndex]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const jumpToPage = (idx: number) => {
    const clamped = Math.max(0, Math.min(pages.length - 1, idx));
    setCurrentPage(clamped);
    if (mode === 'webtoon') {
      const el = document.getElementById(`manga-page-${clamped}`);
      el?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const nextPage = () => {
    if (currentPage < pages.length - 1) {
      jumpToPage(currentPage + 1);
    } else if (nextChapter) {
      onNavigate(`#/read/${mangaId}/${nextChapter.id}`);
    }
  };

  const prevPage = () => {
    if (currentPage > 0) {
      jumpToPage(currentPage - 1);
    } else if (prevChapter) {
      onNavigate(`#/read/${mangaId}/${prevChapter.id}`);
    }
  };

  const setReadingMode = (m: 'webtoon' | 'single') => {
    setMode(m);
    localStorage.setItem('atsu_manga_mode', m);
  };

  const setFitMode = (f: 'width' | 'height' | 'original') => {
    setFit(f);
    localStorage.setItem('atsu_manga_fit', f);
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-carbon-950 flex flex-col items-center justify-center text-white z-50">
        <Loader2 className="w-10 h-10 text-brand-400 animate-spin mb-4" />
        <p className="text-sm font-semibold text-gray-300">Loading chapter pages...</p>
      </div>
    );
  }

  if (error || pages.length === 0) {
    return (
      <div className="fixed inset-0 bg-carbon-950 flex flex-col items-center justify-center p-6 text-center text-white z-50">
        <h2 className="text-xl font-bold mb-2">Could Not Load Chapter</h2>
        <p className="text-sm text-gray-400 max-w-md mb-6">{error || 'No pages available'}</p>
        <button
          onClick={() => onNavigate(`#/manga/${mangaId}`)}
          className="px-6 py-2.5 rounded-xl bg-brand-500 font-bold text-sm"
        >
          Back to Series
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full min-h-screen bg-[#07070a] text-white select-none">
      
      {/* Top Floating Bar */}
      <header
        className={`fixed top-0 inset-x-0 z-40 bg-gradient-to-b from-black/95 via-black/80 to-transparent p-3 sm:p-4 pt-[max(0.75rem,env(safe-area-inset-top))] transition-transform duration-300 ${
          controlsVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => onNavigate(`#/manga/${mangaId}`)}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition active:scale-95 shrink-0"
              title="Back to Series Details"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
                {mangaInfo?.title || 'Manga'}
              </h2>
              <p className="text-[11px] text-gray-400 truncate">
                {currentChapter?.title || `Chapter ${currentChapter?.number}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Switcher */}
            <div className="flex bg-white/10 p-0.5 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setReadingMode('webtoon')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  mode === 'webtoon' ? 'bg-brand-500 text-white font-bold' : 'text-gray-300 hover:text-white'
                }`}
              >
                <Scroll className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Webtoon</span>
              </button>
              <button
                onClick={() => setReadingMode('single')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  mode === 'single' ? 'bg-brand-500 text-white font-bold' : 'text-gray-300 hover:text-white'
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Single</span>
              </button>
            </div>

            {/* Chapters Drawer */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-300 hover:text-white transition"
              title="All Chapters"
            >
              <List className="w-5 h-5" />
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-300 hover:text-white transition"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Canvas Area */}
      <main
        onClick={() => {
          setControlsVisible(!controlsVisible);
          scheduleHideControls();
        }}
        className={`w-full flex justify-center py-12 ${
          mode === 'webtoon' ? 'flex-col items-center' : 'items-center min-h-screen'
        }`}
      >
        {mode === 'webtoon' ? (
          <div className="flex flex-col items-center w-full max-w-4xl">
            {pages.map((p, idx) => (
              <div
                key={p.id || idx}
                id={`manga-page-${idx}`}
                className="relative w-full flex justify-center bg-[#0d0d12] min-h-[300px]"
              >
                <img
                  src={api.getImageUrl(p.image)}
                  alt={`Page ${idx + 1}`}
                  loading={idx < 4 ? 'eager' : 'lazy'}
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.dataset.retried) {
                      target.dataset.retried = '1';
                      setTimeout(() => {
                        target.src = api.getImageUrl(p.image) + (p.image.includes('?') ? '&' : '?') + 'retry=' + Date.now();
                      }, 1500);
                    }
                  }}
                  className={`block select-none transition-all ${
                    fit === 'width' ? 'w-full max-w-4xl' : fit === 'height' ? 'max-h-[95vh] w-auto' : 'max-w-full'
                  }`}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="relative flex items-center justify-center max-w-5xl mx-auto w-full min-h-[75vh]">
            {/* Click Left for Prev */}
            <div
              onClick={e => { e.stopPropagation(); prevPage(); }}
              className="absolute left-0 inset-y-0 w-1/3 z-20 cursor-w-resize"
              title="Previous Page"
            />
            
            <img
              src={api.getImageUrl(pages[currentPage]?.image)}
              alt={`Page ${currentPage + 1}`}
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.dataset.retried) {
                  target.dataset.retried = '1';
                  setTimeout(() => {
                    const base = api.getImageUrl(pages[currentPage]?.image);
                    target.src = base + (base.includes('?') ? '&' : '?') + 'retry=' + Date.now();
                  }, 1500);
                }
              }}
              className={`select-none shadow-2xl rounded-sm ${
                fit === 'height' ? 'max-h-[92vh] w-auto object-contain' : 'w-full max-w-4xl'
              }`}
            />

            {/* Click Right for Next */}
            <div
              onClick={e => { e.stopPropagation(); nextPage(); }}
              className="absolute right-0 inset-y-0 w-1/3 z-20 cursor-e-resize"
              title="Next Page"
            />
          </div>
        )}
      </main>

      {/* Bottom Floating Bar */}
      <footer
        className={`fixed bottom-0 inset-x-0 z-40 bg-gradient-to-t from-black/95 via-black/85 to-transparent pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] px-3 sm:px-6 transition-transform duration-300 ${
          controlsVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="max-w-3xl mx-auto flex flex-col gap-2.5">
          {/* Page Scrubber */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-gray-300 min-w-[55px] tabular-nums">
              {currentPage + 1} / {pages.length}
            </span>
            <input
              type="range"
              min="1"
              max={pages.length}
              value={currentPage + 1}
              onChange={e => jumpToPage(Number(e.target.value) - 1)}
              className="flex-1 h-1.5 bg-white/20 rounded-lg cursor-pointer accent-brand-500"
            />
          </div>

          {/* Chapter Buttons & Fit */}
          <div className="flex items-center justify-between text-xs font-semibold">
            <button
              onClick={() => prevChapter && onNavigate(`#/read/${mangaId}/${prevChapter.id}`)}
              disabled={!prevChapter}
              className={`px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition flex items-center gap-1.5 ${
                !prevChapter ? 'opacity-30 cursor-not-allowed' : 'active:scale-95'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Prev Chapter</span>
            </button>

            {/* Fit Options */}
            <div className="flex bg-white/10 p-0.5 rounded-lg text-[11px]">
              <button
                onClick={() => setFitMode('width')}
                className={`px-2 py-0.5 rounded ${fit === 'width' ? 'bg-brand-500 text-white font-bold' : 'text-gray-400 hover:text-white'}`}
              >
                Fit Width
              </button>
              <button
                onClick={() => setFitMode('height')}
                className={`px-2 py-0.5 rounded ${fit === 'height' ? 'bg-brand-500 text-white font-bold' : 'text-gray-400 hover:text-white'}`}
              >
                Fit Height
              </button>
            </div>

            <button
              onClick={() => nextChapter && onNavigate(`#/read/${mangaId}/${nextChapter.id}`)}
              disabled={!nextChapter}
              className={`px-3.5 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-white transition flex items-center gap-1.5 shadow-md shadow-brand-500/20 ${
                !nextChapter ? 'opacity-30 cursor-not-allowed' : 'active:scale-95'
              }`}
            >
              <span>Next Chapter</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </footer>

      {/* Chapters Drawer */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex justify-end"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md bg-carbon-900 h-full p-4 sm:p-6 flex flex-col shadow-2xl border-l border-white/10"
          >
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <h3 className="font-bold text-base text-white">All Chapters ({sortedChapters.length})</h3>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar py-3 space-y-1">
              {[...sortedChapters].reverse().map(ch => {
                const isActive = String(ch.id) === String(chapterId);
                return (
                  <button
                    key={ch.id}
                    onClick={() => {
                      setDrawerOpen(false);
                      onNavigate(`#/read/${mangaId}/${ch.id}`);
                    }}
                    className={`w-full text-left p-3 rounded-xl flex items-center justify-between transition ${
                      isActive
                        ? 'bg-brand-500/20 text-brand-400 font-bold border border-brand-500/30'
                        : 'hover:bg-white/5 text-gray-300'
                    }`}
                  >
                    <span className="truncate pr-2">{ch.title || `Chapter ${ch.number}`}</span>
                    <span className="text-xs text-gray-500 shrink-0">Ch. {ch.number}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
