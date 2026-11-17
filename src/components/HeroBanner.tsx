import React, { useState, useEffect, useRef } from 'react';
import { Play, Info, Bookmark, Star, ChevronLeft, ChevronRight, BookText, Sparkles, BookOpen } from 'lucide-react';
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
  isBookmarked,
}) => {
  const [index, setIndex] = useState(0);
  const touchStartXRef = useRef<number | null>(null);

  const list = items?.slice(0, 8) || [];

  useEffect(() => {
    if (list.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % list.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [list.length]);

  if (!list || list.length === 0) {
    return (
      <div className="mx-auto w-full aspect-[16/10] sm:aspect-[21/9] lg:h-[70vh] rounded-2xl sm:rounded-3xl bg-neutral-900/60 animate-pulse border border-white/5" />
    );
  }

  const current = list[index % list.length];
  const isNovel = current.medium === 'Novel';
  const posterUrl = api.getPosterUrl(current, 'large');
  const bookmarked = isBookmarked(current.id);
  const rating = current.mbRating ? Number(current.mbRating).toFixed(1) : null;

  const prevSlide = () => setIndex((prev) => (prev - 1 + list.length) % list.length);
  const nextSlide = () => setIndex((prev) => (prev + 1) % list.length);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const diff = touchStartXRef.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) nextSlide();
      else prevSlide();
    }
    touchStartXRef.current = null;
  };

  const formattedViews = current.views
    ? typeof current.views === 'number'
      ? `${Number(current.views).toLocaleString()} Reads`
      : `${current.views} Reads`
    : null;

  return (
    <section className="relative w-full mb-8 sm:mb-12 select-none group/hero">
      {/* 1. Mobile Hero View (md:hidden) — Flowflix Mobile Billboard */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="md:hidden relative mx-auto aspect-[2/3] w-full max-w-[340px] overflow-hidden rounded-2xl sm:rounded-3xl bg-neutral-900 border border-white/10 shadow-2xl"
      >
        <img
          src={posterUrl}
          alt={current.title}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500"
        />

        {/* Cinematic Vignettes */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-transparent" />

        {/* Content Overlay */}
        <div className="absolute inset-x-0 bottom-0 p-4 flex flex-col items-center text-center">
          {/* Title */}
          <h1 className="mb-2 text-xl sm:text-2xl font-black text-white tracking-tight drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)] line-clamp-2">
            {current.title}
          </h1>

          {/* Badges line */}
          <div className="mb-3 flex flex-wrap items-center justify-center gap-1.5 text-xs font-semibold text-white/90 drop-shadow">
            <span
              className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded shadow ${
                isNovel ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'
              }`}
            >
              {isNovel ? 'Light Novel' : (current.type || 'Manga')}
            </span>

            {rating ? (
              <span className="flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded bg-black/60 text-amber-400 border border-white/10">
                <Star className="w-3 h-3 fill-amber-400 stroke-amber-400" />
                {rating}
              </span>
            ) : null}

            {formattedViews ? (
              <span className="text-[11px] text-gray-300 font-medium">
                • {formattedViews}
              </span>
            ) : null}
          </div>

          {/* Flowflix Action Buttons: Read Now + Library + Info */}
          <div className="flex w-full items-center gap-2">
            <button
              onClick={() => onNavigate(`#/manga/${current.id}`)}
              className="flex-1 flex items-center justify-center gap-2 rounded-full bg-emerald-500 hover:bg-emerald-400 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 active:scale-95 transition cursor-pointer"
            >
              {isNovel ? <BookText className="size-4" /> : <Play className="size-4 fill-white" />}
              <span>Read Now</span>
            </button>

            <button
              onClick={() => onToggleBookmark(current)}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-full py-2.5 text-sm font-semibold border active:scale-95 transition cursor-pointer backdrop-blur-md ${
                bookmarked
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-white/15 hover:bg-white/25 text-white border-white/10'
              }`}
            >
              <Bookmark className={`size-4 ${bookmarked ? 'fill-emerald-400 text-emerald-400' : ''}`} />
              <span>{bookmarked ? 'In Library' : 'My Library'}</span>
            </button>

            <button
              onClick={() => onNavigate(`#/manga/${current.id}`)}
              className="size-10 grid place-items-center rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md text-white border border-white/10 active:scale-95 transition cursor-pointer"
              title="View Details"
              aria-label="View Details"
            >
              <Info className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Desktop Widescreen Billboard (hidden md:block) — Flowflix Cinema Grade */}
      <div className="hidden md:block relative aspect-[16/9] lg:aspect-[21/9] lg:h-[76vh] w-full max-w-[1920px] mx-auto overflow-hidden rounded-2xl sm:rounded-3xl bg-neutral-900 border border-white/10 shadow-2xl">
        {/* High-res Backdrop Image */}
        <img
          src={posterUrl}
          alt={current.title}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700 filter brightness-[0.8] scale-105"
        />

        {/* Multi-stop Cinematic Vignette Gradients matching Flowflix */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#070709] via-black/50 via-40% to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#070709] via-black/50 via-55% to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent max-h-36" />

        {/* Manual Slide Navigation Arrows on Hover */}
        {list.length > 1 && (
          <>
            <button
              onClick={prevSlide}
              className="hidden lg:grid absolute left-6 top-1/2 -translate-y-1/2 z-30 size-12 place-items-center rounded-full bg-black/60 hover:bg-black/90 text-white/80 hover:text-white border border-white/20 backdrop-blur-md opacity-0 group-hover/hero:opacity-100 transition-all duration-200 cursor-pointer shadow-xl hover:scale-110 active:scale-95"
              aria-label="Previous title"
            >
              <ChevronLeft className="size-6" />
            </button>
            <button
              onClick={nextSlide}
              className="hidden lg:grid absolute right-6 top-1/2 -translate-y-1/2 z-30 size-12 place-items-center rounded-full bg-black/60 hover:bg-black/90 text-white/80 hover:text-white border border-white/20 backdrop-blur-md opacity-0 group-hover/hero:opacity-100 transition-all duration-200 cursor-pointer shadow-xl hover:scale-110 active:scale-95"
              aria-label="Next title"
            >
              <ChevronRight className="size-6" />
            </button>
          </>
        )}

        {/* Hero Billboard Content Overlay */}
        <div className="relative z-10 h-full p-6 sm:p-10 md:p-14 lg:p-16 flex flex-col justify-end max-w-3xl">
          {/* Badges Row */}
          <div className="flex flex-wrap items-center gap-2.5 mb-3.5">
            <span
              className={`text-[11px] font-black uppercase px-3 py-1 rounded-md backdrop-blur-md shadow-sm border ${
                isNovel
                  ? 'bg-indigo-600/90 text-white border-indigo-400/30'
                  : 'bg-emerald-600/90 text-white border-emerald-400/30'
              }`}
            >
              {isNovel ? 'Light Novel' : (current.type || 'Manga')}
            </span>

            {rating ? (
              <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md bg-black/75 backdrop-blur-md text-amber-400 border border-white/15 shadow">
                <Star className="size-3.5 fill-amber-400 stroke-amber-400" />
                {rating} Rating
              </span>
            ) : null}

            {formattedViews ? (
              <span className="text-xs font-semibold text-gray-200 bg-white/10 px-2.5 py-1 rounded-md backdrop-blur border border-white/10">
                {formattedViews}
              </span>
            ) : null}

            {current.chapterCount ? (
              <span className="text-xs font-semibold text-gray-300 bg-white/5 px-2.5 py-1 rounded-md backdrop-blur border border-white/10">
                {current.chapterCount} Chapters
              </span>
            ) : null}
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight mb-3 drop-shadow-[0_4px_24px_rgba(0,0,0,0.95)] line-clamp-2">
            {current.title}
          </h1>

          {/* Synopsis */}
          {current.synopsis ? (
            <p className="text-xs sm:text-sm md:text-[15px] text-gray-300 line-clamp-2 sm:line-clamp-3 leading-relaxed mb-6 max-w-2xl drop-shadow">
              {current.synopsis}
            </p>
          ) : null}

          {/* Flowflix Pill Action Buttons */}
          <div className="flex flex-wrap items-center gap-3.5">
            <button
              onClick={() => onNavigate(`#/manga/${current.id}`)}
              className="flex items-center gap-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm sm:text-base px-7 py-3.5 shadow-xl shadow-emerald-500/25 active:scale-95 transition-all cursor-pointer"
            >
              {isNovel ? <BookText className="size-5" /> : <Play className="size-5 fill-white" />}
              <span>Read Now</span>
            </button>

            <button
              onClick={() => onToggleBookmark(current)}
              className={`flex items-center gap-2 rounded-full px-6 py-3.5 text-sm sm:text-base font-semibold backdrop-blur-md border active:scale-95 transition-all cursor-pointer ${
                bookmarked
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-white/15 hover:bg-white/25 text-white border-white/15'
              }`}
            >
              <Bookmark className={`size-4.5 ${bookmarked ? 'fill-emerald-400 text-emerald-400' : ''}`} />
              <span>{bookmarked ? 'In Library' : 'Add to Library'}</span>
            </button>

            <button
              onClick={() => onNavigate(`#/manga/${current.id}`)}
              className="size-12 grid place-items-center rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md text-white border border-white/15 active:scale-95 transition-all cursor-pointer"
              title="More Details"
              aria-label="More Details"
            >
              <Info className="size-5" />
            </button>
          </div>
        </div>

        {/* Flowflix Slide Indicator Dots */}
        {list.length > 1 && (
          <div className="absolute right-8 bottom-6 z-20 flex items-center gap-1.5">
            {list.map((m, idx) => (
              <button
                key={m.id}
                onClick={() => setIndex(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className="p-1 cursor-pointer"
              >
                <span
                  className={`block h-1 rounded-full transition-all duration-300 ${
                    idx === index ? 'w-7 bg-emerald-500 shadow-sm' : 'w-2.5 bg-white/35 hover:bg-white/70'
                  }`}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
