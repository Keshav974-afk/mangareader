import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Settings2,
  List,
  Type,
  Maximize2,
  Minimize2,
  X,
  Loader2,
  Bookmark,
  Check
} from 'lucide-react';
import { Chapter, MangaPageInfo } from '../types/atsu';
import { api } from '../services/api';
import { useReadingHistory } from '../hooks/useReadingHistory';

interface NovelReaderProps {
  mangaId: string;
  chapterId: string;
  mangaInfo?: MangaPageInfo;
  allChapters: Chapter[];
  onNavigate: (route: string) => void;
}

export const NovelReader: React.FC<NovelReaderProps> = ({
  mangaId,
  chapterId,
  mangaInfo,
  allChapters,
  onNavigate
}) => {
  const [paragraphs, setParagraphs] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reader Settings
  const [theme, setTheme] = useState<'dark' | 'oled' | 'sepia' | 'light' | 'navy'>(
    (localStorage.getItem('atsu_novel_theme') as any) || 'dark'
  );
  const [fontFamily, setFontFamily] = useState<'sans' | 'serif' | 'mono'>(
    (localStorage.getItem('atsu_novel_font') as any) || 'serif'
  );
  const [fontSize, setFontSize] = useState<number>(
    Number(localStorage.getItem('atsu_novel_size')) || 18
  );
  const [lineHeight, setLineHeight] = useState<number>(
    Number(localStorage.getItem('atsu_novel_lh')) || 1.85
  );
  const [maxWidth, setMaxWidth] = useState<string>(
    localStorage.getItem('atsu_novel_width') || 'max-w-3xl'
  );

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [readProgress, setReadProgress] = useState(0);

  const { saveProgress, getProgress } = useReadingHistory();

  // Sort chapters
  const sortedChapters = [...allChapters].sort((a, b) => Number(a.number) - Number(b.number));
  const currentChapterIndex = sortedChapters.findIndex(c => String(c.id) === String(chapterId));
  const currentChapter = sortedChapters[currentChapterIndex] || null;
  const prevChapter = currentChapterIndex > 0 ? sortedChapters[currentChapterIndex - 1] : null;
  const nextChapter = currentChapterIndex < sortedChapters.length - 1 ? sortedChapters[currentChapterIndex + 1] : null;

  // Fetch novel text
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    api.getNovelChapter(mangaId, chapterId)
      .then(data => {
        if (!isMounted) return;
        setParagraphs(data.paragraphs || []);
        setTitle(data.title || currentChapter?.title || `Chapter ${currentChapter?.number || ''}`);
        setIsLoading(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch(err => {
        if (!isMounted) return;
        setError(err.message || 'Failed to load novel chapter');
        setIsLoading(false);
      });

    return () => { isMounted = false; };
  }, [mangaId, chapterId]);

  // Track scroll progress
  useEffect(() => {
    const handleScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      if (total <= 0) return;
      const progress = Math.min(100, Math.max(0, Math.round((window.scrollY / total) * 100)));
      setReadProgress(progress);

      if (currentChapter && paragraphs.length > 0) {
        saveProgress({
          mangaId,
          chapterId,
          mangaTitle: mangaInfo?.title || 'Light Novel',
          chapterTitle: title || currentChapter.title || `Chapter ${currentChapter.number}`,
          chapterNumber: currentChapter.number,
          medium: 'Novel',
          cover: api.getPosterUrl(mangaInfo, 'small'),
          progressPercent: progress,
          totalParagraphs: paragraphs.length,
          timestamp: Date.now()
        });
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [paragraphs.length, currentChapter, title]);

  // Save preference changes
  const changeTheme = (t: 'dark' | 'oled' | 'sepia' | 'light' | 'navy') => {
    setTheme(t);
    localStorage.setItem('atsu_novel_theme', t);
  };
  const changeFont = (f: 'sans' | 'serif' | 'mono') => {
    setFontFamily(f);
    localStorage.setItem('atsu_novel_font', f);
  };
  const changeSize = (s: number) => {
    setFontSize(s);
    localStorage.setItem('atsu_novel_size', String(s));
  };
  const changeLineHeight = (lh: number) => {
    setLineHeight(lh);
    localStorage.setItem('atsu_novel_lh', String(lh));
  };
  const changeWidth = (w: string) => {
    setMaxWidth(w);
    localStorage.setItem('atsu_novel_width', w);
  };

  const getThemeClasses = () => {
    switch (theme) {
      case 'oled': return 'theme-oled';
      case 'sepia': return 'theme-sepia';
      case 'light': return 'theme-light';
      case 'navy': return 'theme-navy';
      default: return 'theme-dark';
    }
  };

  const getFontFamilyClass = () => {
    switch (fontFamily) {
      case 'serif': return 'font-serif';
      case 'mono': return 'font-mono';
      default: return 'font-sans';
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-carbon-950 flex flex-col items-center justify-center text-white z-50">
        <Loader2 className="w-10 h-10 text-brand-400 animate-spin mb-4" />
        <p className="text-sm font-semibold text-gray-300">Loading novel chapter...</p>
      </div>
    );
  }

  if (error || paragraphs.length === 0) {
    return (
      <div className="fixed inset-0 bg-carbon-950 flex flex-col items-center justify-center p-6 text-center text-white z-50">
        <h2 className="text-xl font-bold mb-2">Could Not Load Novel Chapter</h2>
        <p className="text-sm text-gray-400 max-w-md mb-6">{error || 'No paragraphs found for this chapter.'}</p>
        <button
          onClick={() => onNavigate(`#/manga/${mangaId}`)}
          className="px-6 py-2.5 rounded-xl bg-brand-500 font-bold text-sm"
        >
          Back to Novel Details
        </button>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-200 ${getThemeClasses()} ${getFontFamilyClass()}`}>
      
      {/* Top Reading Progress Bar */}
      <div className="fixed top-0 inset-x-0 h-1 z-50 bg-black/10">
        <div
          className="h-full bg-brand-500 transition-all duration-150"
          style={{ width: `${readProgress}%` }}
        />
      </div>

      {/* Floating Reader Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-inherit/90 border-b border-black/10 dark:border-white/10 px-3 sm:px-4 py-2.5 sm:py-3 pt-[max(0.6rem,env(safe-area-inset-top))] transition-colors">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => onNavigate(`#/manga/${mangaId}`)}
              className="p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition active:scale-95 shrink-0"
              title="Back to Series"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold truncate">
                {mangaInfo?.title || 'Light Novel'}
              </h2>
              <p className="text-[11px] opacity-70 truncate">{title}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-xs font-semibold opacity-70 hidden sm:inline mr-2">
              {readProgress}% read
            </span>

            {/* Typography / Settings button */}
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className={`p-2 rounded-xl transition ${
                settingsOpen ? 'bg-brand-500 text-white' : 'hover:bg-black/10 dark:hover:bg-white/10'
              }`}
              title="Appearance & Typography"
            >
              <Type className="w-5 h-5" />
            </button>

            {/* Chapters list */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition"
              title="All Chapters"
            >
              <List className="w-5 h-5" />
            </button>
          </div>

        </div>
      </header>

      {/* Settings Drawer / Flyout */}
      {settingsOpen && (
        <div className="sticky top-16 z-30 max-w-xl mx-auto px-4 mb-4 fade-enter">
          <div className="p-4 sm:p-5 rounded-2xl shadow-2xl border border-black/10 dark:border-white/15 bg-carbon-850 text-white space-y-4">
            
            {/* Theme Picker */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 block">Theme</label>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { id: 'dark', label: 'Dark', bg: '#0f1015', text: '#e2e8f0' },
                  { id: 'oled', label: 'OLED', bg: '#000000', text: '#ffffff' },
                  { id: 'sepia', label: 'Sepia', bg: '#f7f1e3', text: '#3b3024' },
                  { id: 'light', label: 'Light', bg: '#ffffff', text: '#1e293b' },
                  { id: 'navy', label: 'Navy', bg: '#0f172a', text: '#e2e8f0' }
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => changeTheme(t.id as any)}
                    style={{ backgroundColor: t.bg, color: t.text }}
                    className={`h-10 rounded-xl font-bold text-xs flex items-center justify-center border transition-all ${
                      theme === t.id ? 'ring-2 ring-brand-500 scale-105 border-brand-500 font-extrabold' : 'border-white/10 opacity-80'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Font Family */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 block">Font Family</label>
              <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
                <button
                  onClick={() => changeFont('serif')}
                  className={`py-2 rounded-xl font-serif border transition ${
                    fontFamily === 'serif' ? 'bg-brand-500 text-white border-brand-500' : 'bg-white/5 border-white/10 text-gray-300'
                  }`}
                >
                  Merriweather (Serif)
                </button>
                <button
                  onClick={() => changeFont('sans')}
                  className={`py-2 rounded-xl font-sans border transition ${
                    fontFamily === 'sans' ? 'bg-brand-500 text-white border-brand-500' : 'bg-white/5 border-white/10 text-gray-300'
                  }`}
                >
                  Jakarta (Sans)
                </button>
                <button
                  onClick={() => changeFont('mono')}
                  className={`py-2 rounded-xl font-mono border transition ${
                    fontFamily === 'mono' ? 'bg-brand-500 text-white border-brand-500' : 'bg-white/5 border-white/10 text-gray-300'
                  }`}
                >
                  JetBrains (Mono)
                </button>
              </div>
            </div>

            {/* Sliders: Size & Line Height */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span className="text-gray-400">Font Size</span>
                  <span className="text-brand-400">{fontSize}px</span>
                </div>
                <input
                  type="range"
                  min="14"
                  max="28"
                  value={fontSize}
                  onChange={e => changeSize(Number(e.target.value))}
                  className="w-full h-1.5 rounded-lg bg-white/20 accent-brand-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span className="text-gray-400">Line Spacing</span>
                  <span className="text-brand-400">{lineHeight}</span>
                </div>
                <input
                  type="range"
                  min="1.5"
                  max="2.3"
                  step="0.05"
                  value={lineHeight}
                  onChange={e => changeLineHeight(Number(e.target.value))}
                  className="w-full h-1.5 rounded-lg bg-white/20 accent-brand-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Max Reading Width */}
            <div>
              <div className="flex justify-between text-xs font-bold mb-1.5">
                <span className="text-gray-400">Reading Column Width</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs font-semibold">
                {[
                  { id: 'max-w-2xl', label: 'Narrow' },
                  { id: 'max-w-3xl', label: 'Standard' },
                  { id: 'max-w-4xl', label: 'Wide' },
                  { id: 'max-w-5xl', label: 'Full' }
                ].map(w => (
                  <button
                    key={w.id}
                    onClick={() => changeWidth(w.id)}
                    className={`py-1.5 rounded-lg border transition ${
                      maxWidth === w.id ? 'bg-brand-500 text-white border-brand-500' : 'bg-white/5 border-white/10 text-gray-300'
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Main Reading Canvas */}
      <main className={`mx-auto px-5 sm:px-8 py-10 sm:py-16 ${maxWidth}`}>
        
        {/* Chapter Title & Header */}
        <div className="mb-10 text-center pb-8 border-b border-black/10 dark:border-white/10">
          <span className="text-xs uppercase tracking-widest font-extrabold text-brand-500 mb-2 block">
            {mangaInfo?.title || 'Light Novel'}
          </span>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight mb-3">
            {title}
          </h1>
          <p className="text-xs opacity-60">
            {paragraphs.length} paragraphs • ~{paragraphs.reduce((acc, p) => acc + p.split(' ').length, 0).toLocaleString()} words
          </p>
        </div>

        {/* Paragraphs Flow */}
        <article
          style={{
            fontSize: `${fontSize}px`,
            lineHeight: lineHeight
          }}
          className="space-y-6 select-text transition-all duration-200"
        >
          {paragraphs.map((p, idx) => (
            <p key={idx} className="novel-para tracking-normal leading-relaxed">
              {p}
            </p>
          ))}
        </article>

        {/* Bottom Chapter Switcher */}
        <div className="mt-16 pt-8 border-t border-black/10 dark:border-white/10 flex items-center justify-between gap-4">
          <button
            onClick={() => prevChapter && onNavigate(`#/read/${mangaId}/${prevChapter.id}`)}
            disabled={!prevChapter}
            className={`px-4 py-2.5 rounded-xl border border-black/10 dark:border-white/15 flex items-center gap-2 font-bold text-sm transition ${
              !prevChapter ? 'opacity-30 cursor-not-allowed' : 'hover:bg-black/10 dark:hover:bg-white/10 active:scale-95'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous Chapter</span>
          </button>

          <button
            onClick={() => nextChapter && onNavigate(`#/read/${mangaId}/${nextChapter.id}`)}
            disabled={!nextChapter}
            className={`px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-white flex items-center gap-2 font-bold text-sm transition ${
              !nextChapter ? 'opacity-30 cursor-not-allowed' : 'active:scale-95'
            }`}
          >
            <span>Next Chapter</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

      </main>

      {/* Chapter Drawer */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex justify-end"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md bg-carbon-900 text-white h-full p-4 sm:p-6 flex flex-col shadow-2xl border-l border-white/10"
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
