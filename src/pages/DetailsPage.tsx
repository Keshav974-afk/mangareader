import React, { useState, useEffect, useMemo } from 'react';
import {
  Star,
  Play,
  Bookmark,
  Share2,
  Calendar,
  Users,
  Eye,
  BookOpen,
  BookText,
  Search,
  ArrowUpDown,
  Loader2,
  ChevronDown,
  ChevronUp,
  Layers
} from 'lucide-react';
import { MangaPageInfo, Chapter } from '../types/atsu';
import { api } from '../services/api';
import { useReadingHistory } from '../hooks/useReadingHistory';

interface DetailsPageProps {
  mangaId: string;
  onNavigate: (route: string) => void;
}

export const DetailsPage: React.FC<DetailsPageProps> = ({ mangaId, onNavigate }) => {
  const [info, setInfo] = useState<MangaPageInfo | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [chapterSearch, setChapterSearch] = useState('');
  const [sortAsc, setSortAsc] = useState(false);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [selectedScanlator, setSelectedScanlator] = useState<string>('dedup');

  const { isBookmarked, toggleBookmark, getProgress } = useReadingHistory();

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    // 1. Fetch metadata first and render details immediately without waiting
    api.getMangaInfo(mangaId)
      .then(mangaInfo => {
        if (!isMounted) return;
        setInfo(mangaInfo);
        // Pre-fill initial chapters from mangaPage if available
        if (mangaInfo && Array.isArray((mangaInfo as any).chapters) && (mangaInfo as any).chapters.length > 0) {
          setChapters((mangaInfo as any).chapters);
        }
        setIsLoading(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch(err => {
        console.error('Failed to load manga details:', err);
        setIsLoading(false);
      });

    // 2. Fetch full chapter list in background in parallel
    api.getAllChapters(mangaId)
      .then(chs => {
        if (!isMounted || !chs || chs.length === 0) return;
        setChapters(chs);
      })
      .catch(err => {
        console.warn('Could not load full chapter list:', err);
      });

    return () => { isMounted = false; };
  }, [mangaId]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6 max-w-6xl mx-auto">
        {/* Banner Skeleton */}
        <div className="relative h-60 sm:h-80 md:h-96 w-full bg-carbon-850 rounded-3xl overflow-hidden border border-white/5">
          <div className="absolute inset-0 bg-gradient-to-t from-carbon-950 via-carbon-950/40 to-transparent" />
        </div>

        {/* Content Skeleton */}
        <div className="relative -mt-28 sm:-mt-36 z-10 px-4 sm:px-8">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Poster Skeleton */}
            <div className="w-44 sm:w-56 md:w-64 aspect-[2/3] rounded-2xl bg-carbon-800 border border-white/10 shrink-0 shadow-2xl" />

            {/* Info Skeleton */}
            <div className="flex-1 space-y-4 w-full pt-4">
              <div className="h-8 sm:h-10 bg-carbon-800 rounded-xl w-3/4" />
              <div className="h-5 bg-carbon-800/70 rounded-lg w-1/2" />
              <div className="flex gap-2">
                <div className="h-7 w-20 bg-carbon-800 rounded-lg" />
                <div className="h-7 w-20 bg-carbon-800 rounded-lg" />
                <div className="h-7 w-20 bg-carbon-800 rounded-lg" />
              </div>
              <div className="space-y-2 pt-2">
                <div className="h-4 bg-carbon-800/80 rounded w-full" />
                <div className="h-4 bg-carbon-800/80 rounded w-5/6" />
                <div className="h-4 bg-carbon-800/80 rounded w-4/6" />
              </div>
              <div className="flex gap-4 pt-4">
                <div className="h-12 w-44 bg-carbon-800 rounded-xl" />
                <div className="h-12 w-32 bg-carbon-800 rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="py-20 text-center text-white">
        <h2 className="text-xl font-bold mb-2">Series Not Found</h2>
        <p className="text-sm text-gray-400 mb-6">Could not retrieve metadata from Atsu API.</p>
        <button
          onClick={() => onNavigate('#/')}
          className="px-6 py-2.5 rounded-xl bg-brand-500 font-bold text-sm"
        >
          Return Home
        </button>
      </div>
    );
  }

  const isNovel = info.medium === 'Novel';
  const posterUrl = api.getPosterUrl(info, 'large');
  const bannerUrl = api.getBannerUrl(info.banner);
  const bookmarked = isBookmarked(info.id);
  const rating = info.avgRating ? info.avgRating.toFixed(1) : null;
  const progress = getProgress(info.id);

  // Build scanlator dictionary from info
  const scanlatorMap = useMemo(() => {
    const map = new Map<string, string>();
    if (info?.scanlators) {
      info.scanlators.forEach(s => map.set(s.id, s.name));
    }
    return map;
  }, [info?.scanlators]);

  // Identify distinct scanlators present in chapters and count their releases
  const availableScanlators = useMemo(() => {
    const counts = new Map<string, number>();
    chapters.forEach(c => {
      const gid = c.scanlationMangaId || 'default';
      counts.set(gid, (counts.get(gid) || 0) + 1);
    });

    const list: Array<{ id: string; name: string; count: number; score?: number }> = [];
    counts.forEach((count, id) => {
      const name = scanlatorMap.get(id) || (id === 'default' ? 'Main Release' : `Group ${id.slice(0, 8)}`);
      const score = info?.scanlators?.find(s => s.id === id)?.score ?? 0;
      list.push({ id, name, count, score });
    });

    return list.sort((a, b) => b.count - a.count);
  }, [chapters, scanlatorMap, info?.scanlators]);

  const hasMultipleGroups = availableScanlators.length > 1;
  const primaryGroupId = availableScanlators[0]?.id;

  // Filter and deduplicate chapters
  const filteredChapters = useMemo(() => {
    let list = chapters;

    if (selectedScanlator === 'dedup') {
      // Smart deduplication: keep only one version per chapter number, prioritizing primary group / high page count / latest
      const map = new Map<number, Chapter>();
      const sortedCandidates = [...chapters].sort((a, b) => {
        if (primaryGroupId) {
          if (a.scanlationMangaId === primaryGroupId && b.scanlationMangaId !== primaryGroupId) return -1;
          if (b.scanlationMangaId === primaryGroupId && a.scanlationMangaId !== primaryGroupId) return 1;
        }
        const pageDiff = (b.pageCount || 0) - (a.pageCount || 0);
        if (pageDiff !== 0) return pageDiff;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });

      for (const ch of sortedCandidates) {
        if (!map.has(ch.number)) {
          map.set(ch.number, ch);
        }
      }
      list = Array.from(map.values());
    } else if (selectedScanlator !== 'all') {
      list = chapters.filter(c => (c.scanlationMangaId || 'default') === selectedScanlator);
    }

    if (chapterSearch.trim()) {
      const q = chapterSearch.toLowerCase();
      list = list.filter(ch =>
        String(ch.number).includes(q) ||
        (ch.title && ch.title.toLowerCase().includes(q))
      );
    }

    return [...list].sort((a, b) => {
      const diff = Number(a.number) - Number(b.number);
      return sortAsc ? diff : -diff;
    });
  }, [chapters, selectedScanlator, primaryGroupId, chapterSearch, sortAsc]);

  const firstChapter = [...chapters].sort((a, b) => Number(a.number) - Number(b.number))[0];
  const resumeChapter = progress
    ? chapters.find(c => String(c.id) === String(progress.chapterId)) || firstChapter
    : firstChapter;

  return (
    <div className="pb-20 space-y-8 fade-enter">
      
      {/* Banner & Header Card */}
      <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-carbon-900 border border-white/10 shadow-2xl">
        
        {/* Banner Backdrop */}
        <div className="relative h-48 sm:h-72 md:h-80 w-full overflow-hidden bg-carbon-850">
          {bannerUrl || posterUrl ? (
            <img
              src={bannerUrl || posterUrl}
              alt={info.title}
              className="w-full h-full object-cover filter brightness-[0.45] scale-105"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-carbon-900 via-carbon-900/40 to-transparent" />
        </div>

        {/* Content Row */}
        <div className="relative z-10 px-4 sm:px-8 pb-8 -mt-20 sm:-mt-28 flex flex-col md:flex-row gap-6 sm:gap-8 items-start">
          
          {/* Poster Card */}
          <div className="w-36 sm:w-48 md:w-56 aspect-[2/3] rounded-2xl overflow-hidden bg-carbon-800 border-2 border-white/15 shadow-2xl shrink-0 mx-auto md:mx-0">
            <img
              src={posterUrl}
              alt={info.title}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Details Column */}
          <div className="flex-1 min-w-0 space-y-4">
            
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-xs font-black uppercase px-2.5 py-1 rounded-md shadow-sm ${
                isNovel ? 'bg-indigo-600 text-white' : 'bg-brand-500 text-white'
              }`}>
                {isNovel ? 'Light Novel' : (info.type || 'Manga')}
              </span>

              {rating && (
                <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md bg-black/60 text-amber-400 border border-white/10">
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  {rating} Rating
                </span>
              )}

              {info.status && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-white/10 text-gray-300">
                  {info.status}
                </span>
              )}

              {info.totalChapterCount ? (
                <span className="text-xs font-semibold text-gray-400">
                  {info.totalChapterCount} Chapters
                </span>
              ) : null}
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              {info.title}
            </h1>

            {info.englishTitle && info.englishTitle !== info.title && (
              <p className="text-sm text-gray-400 font-medium">
                {info.englishTitle}
              </p>
            )}

            {/* Authors & Artists */}
            {info.authors && info.authors.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-gray-300">
                <Users className="w-4 h-4 text-brand-400 shrink-0" />
                <span className="text-gray-400">Authors:</span>
                <span className="font-semibold text-white">
                  {info.authors.map(a => a.name).join(', ')}
                </span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 pt-2 w-full">
              {resumeChapter && (
                <button
                  onClick={() => onNavigate(`#/read/${info.id}/${resumeChapter.id}`)}
                  className="w-full sm:w-auto px-6 py-3.5 sm:py-3 rounded-xl bg-brand-500 hover:bg-brand-400 text-white font-bold text-sm flex items-center justify-center gap-2 border border-white/10 active:scale-95 transition-all"
                >
                  {isNovel ? <BookText className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
                  <span>{progress ? `Resume Ch. ${progress.chapterNumber}` : 'Start Reading'}</span>
                </button>
              )}

              <button
                onClick={() => toggleBookmark(info)}
                className={`w-full sm:w-auto px-5 py-3.5 sm:py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border transition-all active:scale-95 ${
                  bookmarked
                    ? 'bg-brand-500/20 text-brand-400 border-brand-500/40'
                    : 'bg-white/10 hover:bg-white/20 text-white border-white/15'
                }`}
              >
                <Bookmark className={`w-4 h-4 ${bookmarked ? 'fill-brand-400' : ''}`} />
                <span>{bookmarked ? 'In Library' : 'Add to Library'}</span>
              </button>
            </div>

          </div>

        </div>

        {/* Genres & Synopsis */}
        <div className="px-4 sm:px-8 pb-8 pt-2 space-y-4 border-t border-white/10">
          {/* Genre Chips */}
          {info.genres && info.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-4">
              {info.genres.map(g => (
                <span
                  key={g.id || g.name}
                  className="px-3 py-1 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 transition"
                >
                  {g.name}
                </span>
              ))}
            </div>
          )}

          {/* Synopsis */}
          {info.synopsis && (
            <div className="relative">
              <p className={`text-sm text-gray-300 leading-relaxed ${!synopsisExpanded ? 'line-clamp-3 sm:line-clamp-4' : ''}`}>
                {info.synopsis}
              </p>
              {info.synopsis.length > 200 && (
                <button
                  onClick={() => setSynopsisExpanded(!synopsisExpanded)}
                  className="mt-2 text-xs font-bold text-brand-400 hover:text-brand-300 flex items-center gap-1"
                >
                  <span>{synopsisExpanded ? 'Show Less' : 'Read Full Synopsis'}</span>
                  {synopsisExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Chapters Section */}
      <section className="bg-carbon-900 border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-xl space-y-6">
        
        {/* Chapters Header & Search */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="font-extrabold text-xl text-white">
                Chapters ({filteredChapters.length})
              </h2>
              {hasMultipleGroups && selectedScanlator === 'dedup' && (
                <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  Clean • No Duplicates
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {hasMultipleGroups && selectedScanlator === 'dedup'
                ? `Showing unique chapters from ${availableScanlators[0]?.name || 'primary source'}`
                : 'Select a chapter to begin reading'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Scanlation Group Filter (only if multiple translation teams exist) */}
            {hasMultipleGroups && (
              <div className="relative flex-1 sm:flex-initial">
                <select
                  value={selectedScanlator}
                  onChange={e => setSelectedScanlator(e.target.value)}
                  className="w-full sm:w-auto bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl pl-3 pr-8 py-2 text-xs font-medium text-gray-200 outline-none focus:border-brand-500 appearance-none cursor-pointer transition"
                >
                  <option value="dedup" className="bg-carbon-900 text-white">
                    ✨ Main Version ({availableScanlators[0]?.name || 'Best'})
                  </option>
                  <option value="all" className="bg-carbon-900 text-white">
                    All Releases ({chapters.length} total)
                  </option>
                  {availableScanlators.map(s => (
                    <option key={s.id} value={s.id} className="bg-carbon-900 text-white">
                      {s.name} ({s.count} chs)
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}

            {/* Search Input */}
            <div className="relative flex-1 sm:w-56">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search chapter..."
                value={chapterSearch}
                onChange={e => setChapterSearch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-brand-500"
              />
            </div>

            {/* Sort Toggle */}
            <button
              onClick={() => setSortAsc(!sortAsc)}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 shrink-0"
              title={sortAsc ? 'Sorting Ascending' : 'Sorting Descending'}
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Chapters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[600px] overflow-y-auto no-scrollbar pr-1">
          {filteredChapters.length > 0 ? (
            filteredChapters.map(ch => {
              const isCurrent = progress && String(progress.chapterId) === String(ch.id);
              const groupName = ch.scanlationMangaId ? scanlatorMap.get(ch.scanlationMangaId) : null;
              return (
                <button
                  key={ch.id}
                  onClick={() => onNavigate(`#/read/${info.id}/${ch.id}`)}
                  className={`p-3.5 rounded-xl text-left border transition-all flex items-center justify-between gap-3 group ${
                    isCurrent
                      ? 'bg-brand-500/20 text-brand-400 font-bold border-brand-500/40'
                      : 'bg-white/[0.03] hover:bg-white/[0.08] text-gray-300 border-white/[0.06] hover:border-brand-500/30'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-semibold truncate group-hover:text-white transition-colors">
                      {ch.title || `Chapter ${ch.number}`}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span>Chapter {ch.number}</span>
                      {ch.pageCount ? <span>• {ch.pageCount} pages</span> : null}
                      {hasMultipleGroups && groupName && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-gray-400">
                          {groupName}
                        </span>
                      )}
                    </p>
                  </div>
                  <Play className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-brand-400 shrink-0 transition-opacity" />
                </button>
              );
            })
          ) : (
            <div className="col-span-full py-12 text-center text-gray-500 text-sm">
              No chapters match "{chapterSearch}"
            </div>
          )}
        </div>

      </section>

    </div>
  );
};
