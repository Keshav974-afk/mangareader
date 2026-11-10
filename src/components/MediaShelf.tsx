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
  exploreRoute
}) => {
  const rowRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (!rowRef.current) return;
    const offset = direction === 'left' ? -rowRef.current.clientWidth * 0.75 : rowRef.current.clientWidth * 0.75;
    rowRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  if (!isLoading && (!items || items.length === 0)) return null;

  return (
    <section className="relative mb-8 sm:mb-10 group/shelf">
      {/* Header */}
      <div className="flex items-end justify-between mb-3 px-1 sm:px-2">
        <div className="flex items-center gap-2 sm:gap-2.5">
          {Icon ? (
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 shrink-0">
              <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          ) : null}
          <div>
            <h2 className="font-extrabold text-sm sm:text-lg md:text-xl text-white tracking-tight flex items-center gap-2">
              {title}
            </h2>
            {subtitle ? <p className="text-[11px] sm:text-xs text-gray-400 line-clamp-1">{subtitle}</p> : null}
          </div>
        </div>

        {exploreRoute ? (
          <button
            onClick={() => onNavigate(exploreRoute)}
            className="text-[11px] sm:text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-0.5 sm:gap-1 shrink-0 group/btn py-1"
          >
            <span>See All</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
          </button>
        ) : null}
      </div>

      {/* Row with Navigation Arrows */}
      <div className="relative">
        {/* Left Arrow (Desktop only) */}
        <button
          onClick={() => scroll('left')}
          className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full bg-black/80 hover:bg-carbon-900 border border-white/20 text-white items-center justify-center opacity-0 group-hover/shelf:opacity-100 transition-all shadow-2xl hover:scale-110 active:scale-95"
          title="Scroll Left"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Right Arrow (Desktop only) */}
        <button
          onClick={() => scroll('right')}
          className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full bg-black/80 hover:bg-carbon-900 border border-white/20 text-white items-center justify-center opacity-0 group-hover/shelf:opacity-100 transition-all shadow-2xl hover:scale-110 active:scale-95"
          title="Scroll Right"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Items Container with Mobile Touch Snap */}
        <div
          ref={rowRef}
          id={id}
          className="flex gap-2.5 sm:gap-4 overflow-x-auto pb-3 pt-1 px-1 sm:px-2 no-scrollbar scroll-smooth touch-pan-x snap-x snap-proximity"
        >
          {isLoading ? (
            Array.from({ length: 7 }).map((_, idx) => (
              <div key={idx} className="w-32 sm:w-44 md:w-48 shrink-0 snap-start">
                <div className="aspect-[2/3] rounded-xl shimmer-box" />
                <div className="h-3.5 w-3/4 rounded shimmer-box mt-2" />
                <div className="h-3 w-1/2 rounded shimmer-box mt-1" />
              </div>
            ))
          ) : (
            items.map(item => (
              <div key={item.id} className="snap-start shrink-0">
                <MangaCard
                  item={item}
                  onNavigate={onNavigate}
                  width="w-32 sm:w-44 md:w-48"
                />
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
};
