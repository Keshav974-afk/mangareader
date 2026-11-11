import React, { useState, useEffect } from 'react';
import { Filter, Search, Loader2, ArrowDown, Sparkles, Clock, Flame } from 'lucide-react';
import { MangaItem, MediumType } from '../types/atsu';
import { api } from '../services/api';
import { MangaCard } from '../components/MangaCard';

interface BrowsePageProps {
  category: string;
  onNavigate: (route: string) => void;
}

export const BrowsePage: React.FC<BrowsePageProps> = ({ category, onNavigate }) => {
  const [items, setItems] = useState<MangaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const [filterMedium, setFilterMedium] = useState<'all' | MediumType>(
    category === 'novels' ? 'Novel' : category === 'comics' ? 'Comic' : 'all'
  );
  const [query, setQuery] = useState('');

  const fetchBatch = async (offsetToFetch: number, reset = false) => {
    if (reset) setIsLoading(true);
    else setIsLoadingMore(true);

    try {
      let resItems: MangaItem[] = [];
      const limit = 24;

      if (category === 'latest' || category === 'recent') {
        const res = await api.getRecentlyUpdated({ 
          offset: offsetToFetch, 
          limit, 
          mediums: filterMedium === 'all' ? undefined : filterMedium 
        });
        resItems = res.items || [];
      } else if (category === 'novels') {
        const res = await api.getPopular({ timeframe: 'daily', offset: offsetToFetch, limit, mediums: 'Novel' });
        resItems = res.items || [];
      } else if (category === 'comics') {
        const res = await api.getPopular({ timeframe: 'daily', offset: offsetToFetch, limit, mediums: 'Comic' });
        resItems = res.items || [];
      } else if (category === 'hot') {
        const res = await api.getHotUpdates({ offset: offsetToFetch, limit });
        resItems = res.items || [];
      } else {
        // Trending or all
        const res = await api.getPopular({ timeframe: 'daily', offset: offsetToFetch, limit });
        resItems = res.items || [];
      }

      if (resItems.length === 0) {
        setHasMore(false);
      } else {
        setItems(prev => {
          if (reset) return resItems;
          const existingIds = new Set(prev.map(i => i.id));
          const filtered = resItems.filter(i => !existingIds.has(i.id));
          return [...prev, ...filtered];
        });
        setOffset(offsetToFetch + resItems.length);
        if (resItems.length < limit) setHasMore(false);
      }
    } catch (err) {
      console.error('Failed to load browse items:', err);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    fetchBatch(0, true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [category, filterMedium]);

  const getTitle = () => {
    switch (category) {
      case 'latest': return 'Latest Chapter Releases';
      case 'novels': return 'Popular Light Novels & Web Novels';
      case 'comics': return 'Top Manga, Manhwa & Comics';
      case 'hot': return 'Hot Chapters & New Drops';
      case 'recent': return 'Recently Updated Series';
      default: return 'Explore All Titles';
    }
  };

  const getSubtitle = () => {
    switch (category) {
      case 'latest': return 'All manga & novels sorted in real-time by newest released chapter';
      case 'novels': return 'Popular light novels and web novels from around the globe';
      case 'comics': return 'Top-rated manga, manhwa, and comics ranked by reader popularity';
      case 'hot': return 'Trending chapters with high reader engagement';
      case 'recent': return 'Recently updated series and fresh chapter additions';
      default: return 'Showing titles from Atsu catalog';
    }
  };

  const filteredItems = items.filter(it => {
    if (filterMedium !== 'all' && it.medium !== filterMedium) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const title = (it.title || '').toLowerCase();
      const eng = (it.englishTitle || '').toLowerCase();
      return title.includes(q) || eng.includes(q);
    }
    return true;
  });

  return (
    <div className="pb-16 space-y-6">
      
      {/* Header & Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-white/10">
        <div>
          {category === 'latest' && (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-200 text-[11px] font-bold uppercase tracking-wider w-fit mb-2">
              <Sparkles className="w-3.5 h-3.5 text-brand-400" />
              <span>Real-Time Chapter Updates</span>
            </div>
          )}
          <h1 className="text-xl sm:text-3xl font-black text-white tracking-tight">
            {getTitle()}
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            {getSubtitle()} ({filteredItems.length} titles loaded)
          </p>
        </div>

        {/* Medium Filter Pills & Quick Filter */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-48">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter list..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-brand-500"
            />
          </div>

          {/* Medium Pills */}
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 text-xs font-semibold">
            {(['all', 'Comic', 'Novel'] as const).map(m => (
              <button
                key={m}
                onClick={() => setFilterMedium(m)}
                className={`px-3 py-1.5 rounded-lg transition ${
                  filterMedium === m ? 'bg-brand-500 text-white font-bold shadow-sm' : 'text-gray-400 hover:text-white'
                }`}
              >
                {m === 'all' ? 'All' : m === 'Comic' ? 'Comics' : 'Novels'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {Array.from({ length: 18 }).map((_, idx) => (
            <div key={idx} className="w-full">
              <div className="aspect-[2/3] rounded-xl shimmer-box" />
              <div className="h-4 w-3/4 rounded shimmer-box mt-2" />
              <div className="h-3 w-1/2 rounded shimmer-box mt-1" />
            </div>
          ))}
        </div>
      ) : filteredItems.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {filteredItems.map(item => (
              <MangaCard key={item.id} item={item} onNavigate={onNavigate} width="w-full" />
            ))}

            {isLoadingMore && (
              Array.from({ length: 6 }).map((_, idx) => (
                <div key={`skel-more-${idx}`} className="w-full">
                  <div className="aspect-[2/3] rounded-xl shimmer-box" />
                  <div className="h-3.5 w-3/4 rounded shimmer-box mt-2" />
                  <div className="h-3 w-1/2 rounded shimmer-box mt-1" />
                </div>
              ))
            )}
          </div>

          {/* Load More Button */}
          {hasMore && !query.trim() && (
            <div className="pt-8 pb-4 flex flex-col items-center justify-center gap-2">
              <button
                onClick={() => fetchBatch(offset, false)}
                disabled={isLoadingMore}
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-brand-600 to-emerald-600 hover:from-brand-500 hover:to-emerald-500 text-white font-extrabold text-sm border border-white/10 flex items-center gap-2.5 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Loading more titles...</span>
                  </>
                ) : (
                  <>
                    <ArrowDown className="w-4 h-4" />
                    <span>Load More Titles</span>
                  </>
                )}
              </button>
              <span className="text-[11px] font-medium text-gray-500">
                Loaded {items.length} titles
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="py-24 text-center text-gray-500">
          <p className="text-base font-bold text-gray-300">No titles match your filter</p>
          <p className="text-xs text-gray-500 mt-1">Try switching medium or clearing your search filter</p>
        </div>
      )}

    </div>
  );
};
