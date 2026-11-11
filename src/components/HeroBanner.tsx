import React, { useState, useEffect } from 'react';
import { Play, Info, Bookmark, Star, ChevronLeft, ChevronRight, BookOpen, BookText } from 'lucide-react';
import { MangaItem } from '../types/atsu';
import { api } from '../services/api';

interface HeroBannerProps {
  items: MangaItem[];
  onNavigate: (route: string) => void;
  onToggleBookmark: (item: MangaItem) => void;
  isBookmarked: (id: string) => boolean;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  items,
  onNavigate,
  onToggleBookmark,
  isBookmarked
}) => {
  const [index, setIndex] = useState(0);
  const touchStartXRef = React.useRef<number | null>(null);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => {
      setIndex(prev => (prev + 1) % items.length);
    }, 7500);
    return () => clearInterval(timer);
  }, [items.length]);

  if (!items || items.length === 0) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const diff = touchStartXRef.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        setIndex(prev => (prev + 1) % items.length);
      } else {
        setIndex(prev => (prev - 1 + items.length) % items.length);
      }
    }
    touchStartXRef.current = null;
  };

  const current = items[index % items.length];
  const isNovel = current.medium === 'Novel';
  const posterUrl = api.getPosterUrl(current, 'large');
  const bookmarked = isBookmarked(current.id);
  const rating = current.mbRating ? current.mbRating.toFixed(1) : null;

  return (
    <section 
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="relative w-full rounded-2xl sm:rounded-3xl overflow-hidden bg-carbon-900 border border-white/[0.08] shadow-2xl mb-6 sm:mb-8 select-none group touch-pan-y"
    >
      
      {/* Background Poster / Backdrop Blur */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <img
          src={posterUrl}
          alt={current.title}
          onError={(e) => {
            if (current.image) {
              const fallback = api.getImageUrl(current.image);
              if (e.currentTarget.src !== fallback) {
                e.currentTarget.src = fallback;
              }
            }
          }}
          className="w-full h-full object-cover filter brightness-[0.35] sm:brightness-[0.4] blur-sm scale-105 transition-all duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-carbon-950 via-carbon-950/75 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-carbon-950 via-carbon-950/80 to-transparent max-w-4xl" />
      </div>

      {/* Hero Content */}
      <div className="relative z-10 p-4 sm:p-8 md:p-12 max-w-3xl flex flex-col justify-end min-h-[320px] sm:min-h-[420px] md:min-h-[460px]">
        
        {/* Badges Row */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className={`text-[11px] font-extrabold uppercase px-2.5 py-1 rounded-md backdrop-blur-md border ${
            isNovel 
              ? 'bg-indigo-600/90 text-white border-indigo-400/20' 
              : 'bg-brand-600/90 text-white border-brand-400/20'
          }`}>
            {isNovel ? 'Light Novel' : (current.type || 'Manga')}
          </span>

          {rating ? (
            <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-md text-amber-400 border border-white/10">
              <Star className="w-3.5 h-3.5 fill-amber-400 stroke-amber-400" />
              {rating} Rating
            </span>
          ) : null}

          {current.views ? (
            <span className="text-xs font-semibold text-gray-300 bg-white/10 px-2.5 py-1 rounded-md backdrop-blur">
              {Number(current.views).toLocaleString()} Reads
            </span>
          ) : null}

          {current.chapterCount ? (
            <span className="text-xs font-semibold text-gray-400">
              {current.chapterCount} Chapters
            </span>
          ) : null}
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight mb-3 line-clamp-2">
          {current.title}
        </h1>

        {/* Synopsis / Description */}
        {current.synopsis ? (
          <p className="text-xs sm:text-sm text-gray-300 line-clamp-2 sm:line-clamp-3 leading-relaxed mb-6 max-w-2xl">
            {current.synopsis}
          </p>
        ) : null}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => onNavigate(`#/manga/${current.id}`)}
            className="px-6 py-3 rounded-xl bg-brand-500 hover:bg-brand-400 text-white font-bold text-sm flex items-center gap-2 active:scale-95 transition-all"
          >
            {isNovel ? <BookText className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
            <span>Read Now</span>
          </button>

          <button
            onClick={() => onNavigate(`#/manga/${current.id}`)}
            className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md text-white font-bold text-sm flex items-center gap-2 border border-white/15 active:scale-95 transition-all"
          >
            <Info className="w-4 h-4" />
            <span>Details</span>
          </button>

          <button
            onClick={() => onToggleBookmark(current)}
            className={`p-3 rounded-xl backdrop-blur-md border transition-all active:scale-95 ${
              bookmarked 
                ? 'bg-brand-500/20 text-brand-400 border-brand-500/30' 
                : 'bg-white/10 hover:bg-white/20 text-white border-white/15'
            }`}
            title={bookmarked ? 'In Library' : 'Add to Library'}
          >
            <Bookmark className={`w-5 h-5 ${bookmarked ? 'fill-brand-400' : ''}`} />
          </button>
        </div>

      </div>

      {/* Navigation Arrows (visible on hover) */}
      <button
        onClick={() => setIndex(prev => (prev - 1 + items.length) % items.length)}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/60 hover:bg-black text-white border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        title="Previous"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <button
        onClick={() => setIndex(prev => (prev + 1) % items.length)}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/60 hover:bg-black text-white border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        title="Next"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Slide Indicators */}
      <div className="absolute bottom-4 right-6 z-20 flex items-center gap-1.5">
        {items.slice(0, 6).map((_, idx) => (
          <button
            key={idx}
            onClick={() => setIndex(idx)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              idx === (index % items.length) ? 'w-6 bg-brand-500' : 'w-2 bg-white/30 hover:bg-white/50'
            }`}
          />
        ))}
      </div>

    </section>
  );
};
