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
  const [isLoadingShelves, setIsLoadingShelves] = useState(true);

  // Explore grid state (with Load More)
  const [exploreMedium, setExploreMedium] = useState<'All' | 'Comic' | 'Novel'>('All');
  const [exploreItems, setExploreItems] = useState<MangaItem[]>([]);
  const [exploreOffset, setExploreOffset] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const { historyList, removeHistory, toggleBookmark, isBookmarked } = useReadingHistory();

  // Load all initial curated shelves
  useEffect(() => {
    let isMounted = true;
    setIsLoadingShelves(true);

    Promise.all([
      api.getPopular({ timeframe: 'daily', limit: 20 }).catch(() => ({ items: [] })),
      api.getPopular({ timeframe: 'weekly', limit: 20 }).catch(() => ({ items: [] })),
      api.getPopular({ timeframe: 'all', limit: 20 }).catch(() => ({ items: [] })),
      api.getHotUpdates({ limit: 20 }).catch(() => ({ items: [] })),
      api.getPopularNovels(20).catch(() => ({ items: [] })),
      api.getPopularComics(20).catch(() => ({ items: [] })),
      api.getRecentlyUpdated({ limit: 20 }).catch(() => ({ items: [] }))
    ]).then(([popDay, popWk, popAll, hot, nov, com, rec]) => {
      if (!isMounted) return;
      setPopularDaily(popDay.items || []);
      setPopularWeekly(popWk.items || []);
      setPopularAllTime(popAll.items || []);
      setHotUpdates(hot.items || []);
      setNovels(nov.items || []);
      setComics(com.items || []);
      setRecentlyUpdated(rec.items || []);
      setIsLoadingShelves(false);
    });

    return () => { isMounted = false; };
  }, []);

  // Fetch explore grid batch with pagination
  const fetchExploreBatch = async (offsetToFetch: number, reset = false) => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);

    try {
      let mediums = 'Comic,Novel';
      if (exploreMedium === 'Comic') mediums = 'Comic';
      if (exploreMedium === 'Novel') mediums = 'Novel';

      const res = await api.getHotUpdates({
        offset: offsetToFetch,
        limit: 24,
        mediums
      });

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

  // Re-fetch explore items when medium tab changes
  useEffect(() => {
    setExploreOffset(0);
    setHasMore(true);
    fetchExploreBatch(0, true);
  }, [exploreMedium]);

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
      
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
        isLoading={isLoadingShelves}
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
        isLoading={isLoadingShelves}
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
        isLoading={isLoadingShelves}
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
        isLoading={isLoadingShelves}
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
        isLoading={isLoadingShelves}
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
        isLoading={isLoadingShelves}
        onNavigate={onNavigate}
        exploreRoute="#/browse/trending"
      />

      {/* 9. Recently Added Titles Shelf */}
      <MediaShelf
        id="shelf-recent"
        title="Recently Added & Updated"
        subtitle="Fresh additions & new series cataloged in the archive"
        icon={Clock}
        items={recentlyUpdated}
        isLoading={isLoadingShelves}
        onNavigate={onNavigate}
        exploreRoute="#/browse/recent"
      />

      {/* 10. Endless Explore Grid with "Load More" Button */}
      <section className="mt-12 sm:mt-16 pt-8 border-t border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 px-1">
          <div>
            <div className="flex items-center gap-2 text-brand-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Layers className="w-4 h-4" />
              <span>Archive Discovery</span>
            </div>
            <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight">
              Explore More Releases
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Continuously discover newly added chapters and titles
            </p>
          </div>

          {/* Medium Filter Pills */}
          <div className="flex items-center gap-1.5 bg-carbon-850 p-1 rounded-xl border border-white/10 shrink-0 self-start sm:self-auto">
            {(['All', 'Comic', 'Novel'] as const).map(m => (
              <button
                key={m}
                onClick={() => setExploreMedium(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  exploreMedium === m
                    ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {m === 'All' ? 'All Releases' : m === 'Comic' ? 'Comics & Manga' : 'Light Novels'}
              </button>
            ))}
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
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-brand-600 to-emerald-500 hover:from-brand-500 hover:to-emerald-400 text-white font-extrabold text-sm shadow-xl shadow-brand-500/25 flex items-center gap-2.5 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group"
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
