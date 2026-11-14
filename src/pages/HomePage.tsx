import React, { useState, useEffect } from 'react';
import {
  Flame,
  Sparkles,
  BookText,
  BookOpen,
  Clock,
  Play,
  Trash2,
  Trophy,
  Crown,
  Layers,
  ArrowDown,
  Loader2,
  Filter
} from 'lucide-react';
import { MangaItem } from '../types/atsu';
import { api } from '../services/api';
import { HeroBanner } from '../components/HeroBanner';
import { MediaShelf } from '../components/MediaShelf';
import { MangaCard } from '../components/MangaCard';
import { useReadingHistory } from '../hooks/useReadingHistory';

interface HomePageProps {
  onNavigate: (route: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  // Shelves state
  const [popularDaily, setPopularDaily] = useState<MangaItem[]>([]);
  const [popularWeekly, setPopularWeekly] = useState<MangaItem[]>([]);
  const [popularAllTime, setPopularAllTime] = useState<MangaItem[]>([]);
  const [hotUpdates, setHotUpdates] = useState<MangaItem[]>([]);
  const [novels, setNovels] = useState<MangaItem[]>([]);
  const [comics, setComics] = useState<MangaItem[]>([]);
  const [recentlyUpdated, setRecentlyUpdated] = useState<MangaItem[]>([]);
  const [shelfLoading, setShelfLoading] = useState<Record<string, boolean>>({ daily: true, weekly: true, all: true, hot: true, novels: true, comics: true, recent: true });
  const [loadError, setLoadError] = useState('');

  // Explore grid state (with Load More and Sort)
  const [exploreSort, setExploreSort] = useState<'latest' | 'hot' | 'popular'>('latest');
  const [exploreMedium, setExploreMedium] = useState<'All' | 'Comic' | 'Novel'>('All');
  const [exploreItems, setExploreItems] = useState<MangaItem[]>([]);
  const [exploreOffset, setExploreOffset] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const { historyList, removeHistory, toggleBookmark, isBookmarked } = useReadingHistory();

  // Load all initial curated shelves
  useEffect(() => {
    let isMounted = true;
    const load = async (key: string, request: Promise<{ items: MangaItem[] }>, setter: (items: MangaItem[]) => void) => {
      try { const result = await request; if (isMounted) setter(result.items || []); }
      catch (error) { if (isMounted) setLoadError(error instanceof Error ? error.message : 'Unable to load Atsu.'); }
      finally { if (isMounted) setShelfLoading(prev => ({ ...prev, [key]: false })); }
    };
    load('daily', api.getPopular({ timeframe: 'daily', limit: 20 }), setPopularDaily);
    load('weekly', api.getPopular({ timeframe: 'weekly', limit: 20 }), setPopularWeekly);
    load('all', api.getPopular({ timeframe: 'all', limit: 20 }), setPopularAllTime);
    load('hot', api.getHotUpdates({ limit: 20 }), setHotUpdates);
    load('novels', api.getPopularNovels(20), setNovels);
    load('comics', api.getPopularComics(20), setComics);
    load('recent', api.getRecentlyUpdated({ limit: 20 }), setRecentlyUpdated);

    return () => { isMounted = false; };
  }, []);

  // Fetch explore grid batch with pagination based on sort & medium
  const fetchExploreBatch = async (offsetToFetch: number, reset = false) => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);

    try {
      const mediumsParam = exploreMedium === 'All' ? undefined : exploreMedium;
      let res: { items: MangaItem[] };

      if (exploreSort === 'latest') {
        res = await api.getRecentlyUpdated({
          offset: offsetToFetch,
          limit: 24,
          mediums: mediumsParam
        });
      } else if (exploreSort === 'popular') {
        res = await api.getPopular({
          timeframe: 'daily',
          offset: offsetToFetch,
          limit: 24,
          mediums: mediumsParam || 'Comic,Novel'
        });
      } else {
        res = await api.getHotUpdates({
          offset: offsetToFetch,
          limit: 24,
          mediums: mediumsParam || 'Comic,Novel'
        });
      }

      const newItems = res.items || [];
      if (newItems.length === 0) {
        setHasMore(false);
      } else {
        setExploreItems(prev => {
          if (reset) return newItems;
          const existingIds = new Set(prev.map(i => i.id));
          const filteredNew = newItems.filter(i => !existingIds.has(i.id));
          return [...prev, ...filteredNew];
        });
        setExploreOffset(offsetToFetch + newItems.length);
        if (newItems.length < 24) {
          setHasMore(false);
        }
      }
    } catch (err) {
      console.error('Failed to load explore items:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Re-fetch explore items when sort or medium tab changes
  useEffect(() => {
    setExploreOffset(0);
    setHasMore(true);
    fetchExploreBatch(0, true);
  }, [exploreMedium, exploreSort]);

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
      
      {loadError && <div role="alert" className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100 flex items-center justify-between gap-4">
        <span>{loadError}</span><button className="shrink-0 underline" onClick={() => window.location.reload()}>Try again</button>
      </div>}
      {/* 1. Hero Carousel */}
      <HeroBanner
        items={popularDaily.slice(0, 6)}
        onNavigate={onNavigate}
        onToggleBookmark={toggleBookmark}
        isBookmarked={isBookmarked}
      />

      {/* 2. Continue Reading Section (if user has active history) */}
      {historyList.length > 0 && (
        <section className="mb-8 px-1 sm:px-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-extrabold text-sm sm:text-lg text-white tracking-tight flex items-center gap-2">
              <Play className="w-4 h-4 text-brand-400 fill-brand-400" />
              <span>Continue Reading</span>
            </h2>
            <button
              onClick={() => onNavigate('#/library')}
              className="text-[11px] sm:text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors"
            >
              View All ({historyList.length}) ›
            </button>
          </div>

          <div className="flex gap-2.5 sm:gap-4 overflow-x-auto pb-3 pt-1 px-1 no-scrollbar scroll-smooth touch-pan-x snap-x snap-proximity">
            {historyList.slice(0, 8).map(item => (
              <div
                key={item.mangaId}
                onClick={() => onNavigate(`#/read/${item.mangaId}/${item.chapterId}`)}
                className="w-52 sm:w-64 rounded-xl bg-carbon-850 border border-white/10 hover:border-brand-500/40 p-2.5 sm:p-3 shrink-0 cursor-pointer transition-all hover:-translate-y-1 group relative shadow-md snap-start active:scale-95"
              >
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="w-11 h-14 sm:w-12 sm:h-16 rounded-lg bg-carbon-800 overflow-hidden shrink-0">
                    <img src={item.cover} alt={item.mangaTitle} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400">
                      {item.medium}
                    </span>
                    <h4 className="font-bold text-xs text-white truncate mt-1 group-hover:text-brand-400 transition-colors">
                      {item.mangaTitle}
                    </h4>
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">
                      {item.chapterTitle}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeHistory(item.mangaId);
                    }}
                    className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-white/5 transition"
                    title="Remove from history"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1 bg-white/10 rounded-full mt-2.5 overflow-hidden">
                  <div
                    className="h-full bg-brand-500 rounded-full transition-all"
                    style={{ width: `${Math.max(5, item.progressPercent || 0)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. Trending Today Shelf */}
      <MediaShelf
        id="shelf-trending"
        title="Trending Today"
        subtitle="Most read across all comics & light novels right now"
        icon={Flame}
        items={popularDaily}
        isLoading={shelfLoading.daily}
        onNavigate={onNavigate}
        exploreRoute="#/browse/trending"
      />

      {/* 4. Weekly Chart Toppers Shelf */}
      <MediaShelf
        id="shelf-weekly"
        title="Weekly Chart Toppers"
        subtitle="Top ranking series over the past 7 days"
        icon={Trophy}
        items={popularWeekly}
        isLoading={shelfLoading.weekly}
        onNavigate={onNavigate}
        exploreRoute="#/browse/trending"
      />

      {/* 5. Hot Chapter Drops Shelf */}
      <MediaShelf
        id="shelf-hot-updates"
        title="Hot New Chapters"
        subtitle="Fresh chapter releases from leading scanlation teams"
        icon={Sparkles}
        items={hotUpdates}
        isLoading={shelfLoading.hot}
        onNavigate={onNavigate}
        exploreRoute="#/browse/hot"
      />

      {/* 6. Popular Light & Web Novels Shelf */}
      <MediaShelf
        id="shelf-novels"
        title="Popular Light Novels & Web Novels"
        subtitle="Translated fantasy, cultivation, isekai & sci-fi web novels"
        icon={BookText}
        items={novels}
        isLoading={shelfLoading.novels}
        onNavigate={onNavigate}
        exploreRoute="#/browse/novels"
      />

      {/* 7. Top Manga & Manhwa Shelf */}
      <MediaShelf
        id="shelf-comics"
        title="Top Manga & Manhwa"
        subtitle="Must-read action, fantasy, martial arts, and drama comics"
        icon={BookOpen}
        items={comics}
        isLoading={shelfLoading.comics}
        onNavigate={onNavigate}
        exploreRoute="#/browse/comics"
      />

      {/* 8. All-Time Hall of Fame Shelf */}
      <MediaShelf
        id="shelf-all-time"
        title="All-Time Hall of Fame"
        subtitle="Legendary series with millions of lifetime readers"
        icon={Crown}
        items={popularAllTime}
        isLoading={shelfLoading.all}
        onNavigate={onNavigate}
        exploreRoute="#/browse/trending"
      />

      {/* 9. Recently Added & Updated Titles Shelf */}
      <MediaShelf
        id="shelf-recent"
        title="Recently Added & Updated"
        subtitle="Fresh additions & new series cataloged in real-time"
        icon={Clock}
        items={recentlyUpdated}
        isLoading={shelfLoading.recent}
        onNavigate={onNavigate}
        exploreRoute="#/latest"
      />

      {/* 10. Endless Explore Grid with Sort Tabs & Load More */}
      <section className="mt-12 sm:mt-16 pt-8 border-t border-white/10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6 px-1">
          <div>
            <div className="flex items-center gap-2 text-brand-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Layers className="w-4 h-4" />
              <span>Archive Discovery</span>
            </div>
            <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight">
              Explore All Titles
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Browse manga, manhwa & light novels sorted by latest updates or popularity
            </p>
          </div>

          {/* Controls: Sort Tabs + Medium Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            {/* Sort Switcher Tabs */}
            <div className="flex items-center gap-1 bg-carbon-850 p-1 rounded-xl border border-white/10">
              <button
                onClick={() => setExploreSort('latest')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  exploreSort === 'latest'
                    ? 'bg-brand-500 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Latest Chapters</span>
              </button>
              <button
                onClick={() => setExploreSort('hot')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  exploreSort === 'hot'
                    ? 'bg-brand-500 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Hot Updates</span>
              </button>
              <button
                onClick={() => setExploreSort('popular')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  exploreSort === 'popular'
                    ? 'bg-brand-500 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Popular</span>
              </button>
            </div>

            {/* Medium Filter Pills */}
            <div className="flex items-center gap-1 bg-carbon-850 p-1 rounded-xl border border-white/10">
              {(['All', 'Comic', 'Novel'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setExploreMedium(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    exploreMedium === m
                      ? 'bg-white/15 text-white shadow-sm'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {m === 'All' ? 'All' : m === 'Comic' ? 'Comics' : 'Novels'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Responsive Grid: 2 columns on phones, 3 on small tablets, 4 on large tablets, 6 on desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {exploreItems.map(item => (
            <MangaCard
              key={item.id}
              item={item}
              onNavigate={onNavigate}
              width="w-full"
            />
          ))}

          {/* Loading Skeletons */}
          {isLoadingMore && (
            Array.from({ length: 6 }).map((_, idx) => (
              <div key={`skel-${idx}`} className="w-full">
                <div className="aspect-[2/3] rounded-xl shimmer-box" />
                <div className="h-3.5 w-3/4 rounded shimmer-box mt-2" />
                <div className="h-3 w-1/2 rounded shimmer-box mt-1" />
              </div>
            ))
          )}
        </div>

        {/* Load More Button & Status */}
        <div className="mt-8 sm:mt-10 flex flex-col items-center justify-center gap-2">
          {hasMore ? (
            <button
              onClick={() => fetchExploreBatch(exploreOffset, false)}
              disabled={isLoadingMore}
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-brand-600 to-emerald-600 hover:from-brand-500 hover:to-emerald-500 text-white font-extrabold text-sm border border-white/10 flex items-center gap-2.5 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading Fresh Releases...</span>
                </>
              ) : (
                <>
                  <ArrowDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                  <span>Load More Titles</span>
                </>
              )}
            </button>
          ) : (
            <div className="text-center py-4 text-xs font-semibold text-gray-500">
              🎉 You've reached the end of this catalog section!
            </div>
          )}

          {exploreItems.length > 0 && (
            <span className="text-[11px] font-medium text-gray-500 tabular-nums">
              Showing {exploreItems.length} titles
            </span>
          )}
        </div>
      </section>

    </div>
  );
};
