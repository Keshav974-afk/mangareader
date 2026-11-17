import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, LucideIcon } from 'lucide-react';
import { MangaItem } from '../types/atsu';
import { MangaCard } from './MangaCard';

interface MediaShelfProps {
  id: string;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  items: MangaItem[];
  isLoading?: boolean;
  onNavigate: (route: string) => void;
  exploreRoute?: string;
}

export const MediaShelf: React.FC<MediaShelfProps> = ({
  id,
  title,
  subtitle,
  icon: Icon,
  items,
  isLoading,
  onNavigate,
  exploreRoute,
}) => {
  const rowRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (!rowRef.current) return;
    const offset =
      direction === 'left' ? -rowRef.current.clientWidth * 0.75 : rowRef.current.clientWidth * 0.75;
    rowRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  if (!isLoading && (!items || items.length === 0)) return null;

  return (
    <section className="group/shelf relative py-3 sm:py-5 select-none">
      {/* Shelf Header */}
      <div className="flex items-end justify-between mb-3 px-3 sm:px-6 md:px-8">
        <div className="flex items-center gap-2.5">
          {Icon ? (
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Icon className="w-4 h-4" />
            </div>
          ) : null}
          <div>
            <h2 className="font-extrabold text-base sm:text-xl md:text-2xl text-white tracking-tight">
              {title}
            </h2>
            {subtitle ? (
              <p className="text-[11px] sm:text-xs text-gray-400 line-clamp-1 mt-0.5">{subtitle}</p>
            ) : null}
          </div>
        </div>

        {exploreRoute ? (
          <button
            onClick={() => onNavigate(exploreRoute)}
            className="text-xs sm:text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1 shrink-0 group/btn py-1 cursor-pointer"
          >
            <span>See All</span>
            <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" />
          </button>
        ) : null}
      </div>

      {/* Row Container with Flowflix-style edge scroll buttons */}
      <div className="relative">
        {/* Left Scroll Button */}
        <button
          onClick={() => scroll('left')}
          className="hidden md:grid absolute left-0 top-0 bottom-0 z-30 w-12 sm:w-14 place-items-center bg-black/60 hover:bg-black/90 text-white/80 hover:text-white opacity-0 group-hover/shelf:opacity-100 transition duration-200 cursor-pointer shadow-xl backdrop-blur-sm"
          aria-label="Scroll left"
        >
          <ChevronLeft className="size-8" />
        </button>

        {/* Horizontal Card Track */}
        <div
          ref={rowRef}
          id={id}
          className="flex gap-3 sm:gap-4 lg:gap-4.5 overflow-x-auto px-3 sm:px-6 md:px-8 py-2.5 scroll-smooth snap-x snap-proximity no-scrollbar touch-pan-x"
        >
          {isLoading ? (
            Array.from({ length: 7 }).map((_, idx) => (
              <div
                key={idx}
                className="snap-start shrink-0 w-28 sm:w-36 md:w-44 lg:w-48 aspect-[2/3] rounded-xl sm:rounded-2xl bg-[#181818] animate-pulse border border-white/5"
              />
            ))
          ) : (
            items.map((it) => (
              <div
                key={it.id}
                className="snap-start shrink-0 w-28 sm:w-36 md:w-44 lg:w-48"
              >
                <MangaCard item={it} onNavigate={onNavigate} width="w-full" />
              </div>
            ))
          )}
        </div>

        {/* Right Scroll Button */}
        <button
          onClick={() => scroll('right')}
          className="hidden md:grid absolute right-0 top-0 bottom-0 z-30 w-12 sm:w-14 place-items-center bg-black/60 hover:bg-black/90 text-white/80 hover:text-white opacity-0 group-hover/shelf:opacity-100 transition duration-200 cursor-pointer shadow-xl backdrop-blur-sm"
          aria-label="Scroll right"
        >
          <ChevronRight className="size-8" />
        </button>
      </div>
    </section>
  );
};
