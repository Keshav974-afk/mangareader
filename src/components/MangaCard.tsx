import React, { useState } from 'react';
import { Star, BookOpen, BookText, Play, Plus, Check, ChevronDown, Bookmark } from 'lucide-react';
import { MangaItem } from '../types/atsu';
import { api } from '../services/api';
import { useReadingHistory } from '../hooks/useReadingHistory';

interface MangaCardProps {
  item: MangaItem;
  onNavigate: (route: string) => void;
  width?: string;
}

export const MangaCard: React.FC<MangaCardProps> = ({
  item,
  onNavigate,
  width = 'w-32 sm:w-44 md:w-48 lg:w-52',
}) => {
  const [imgError, setImgError] = useState(false);
  const [fallbackTried, setFallbackTried] = useState(false);
  const initialUrl = api.getPosterUrl(item, 'medium');
  const [imgSrc, setImgSrc] = useState(initialUrl);

  const { isBookmarked, toggleBookmark, getProgress } = useReadingHistory();
  const bookmarked = isBookmarked(item.id);
  const progress = getProgress(item.id);

  const isNovel = item.medium === 'Novel';
  const rating = item.mbRating ? Number(item.mbRating).toFixed(1) : null;
  const title = item.title || item.englishTitle || 'Untitled';

  const handleError = () => {
    if (!fallbackTried) {
      setFallbackTried(true);
      const posterPath =
        item.image ||
        (item as any).poster?.image ||
        item.mediumImage ||
        (item as any).poster?.mediumImage ||
        '';
      const clean = posterPath.replace(/^https?:\/\/cdn\.atsu\.moe\//, '').replace(/^\/?static\/?/, '');
      if (clean) {
        setImgSrc(`https://i0.wp.com/cdn.atsu.moe/static/${clean}`);
        return;
      }
    }
    setImgError(true);
  };

  const handleCardClick = () => {
    onNavigate(`#/manga/${item.id}`);
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (progress && progress.chapterId) {
      onNavigate(`#/read/${item.id}/${progress.chapterId}`);
    } else {
      onNavigate(`#/manga/${item.id}`);
    }
  };

  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleBookmark(item);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => e.key === 'Enter' && handleCardClick()}
      className={`group relative ${
        width.includes('w-full') ? 'w-full' : 'shrink-0 ' + width
      } aspect-[2/3] rounded-xl sm:rounded-2xl overflow-hidden bg-[#181818] border border-white/10 cursor-pointer transition-all duration-300 ease-out hover:scale-105 sm:hover:scale-108 hover:z-30 hover:shadow-2xl hover:shadow-black/95 select-none text-left`}
      style={{ touchAction: 'manipulation' }}
    >
      {/* Poster Image */}
      {imgError || !imgSrc ? (
        <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-carbon-850 text-gray-500">
          {isNovel ? <BookText className="w-8 h-8 mb-2 opacity-50" /> : <BookOpen className="w-8 h-8 mb-2 opacity-50" />}
          <span className="text-[11px] font-semibold line-clamp-2 text-gray-400">{title}</span>
        </div>
      ) : (
        <img
          src={imgSrc}
          alt={title}
          loading="lazy"
          onError={handleError}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      )}

      {/* Default Bottom Gradient & Info (Hidden on desktop hover when action overlay is active) */}
      <div className="absolute inset-x-0 bottom-0 p-2.5 sm:p-3 bg-gradient-to-t from-black/95 via-black/55 to-transparent transition-opacity group-hover:opacity-0 pointer-events-none">
        <div className="text-xs sm:text-[13px] font-bold text-white line-clamp-1 drop-shadow">
          {title}
        </div>
        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-gray-400">
          <span className="font-semibold text-emerald-400">{isNovel ? 'Novel' : (item.type || 'Manga')}</span>
          {rating ? (
            <>
              <span>•</span>
              <span className="flex items-center gap-0.5 text-amber-400 font-bold">
                <Star className="w-2.5 h-2.5 fill-amber-400" />
                {rating}
              </span>
            </>
          ) : null}
        </div>

        {/* Progress line if in history */}
        {progress && progress.progressPercent ? (
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/20">
            <div className="h-full bg-emerald-500" style={{ width: `${Math.max(5, progress.progressPercent)}%` }} />
          </div>
        ) : null}
      </div>

      {/* Flowflix Hover Action Overlay (Desktop Only) */}
      <div className="hidden sm:flex absolute inset-0 bg-gradient-to-t from-black/95 via-black/80 to-black/35 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-col justify-end p-3 gap-1.5 z-20 pointer-events-none">
        <div className="text-xs sm:text-[13px] font-bold text-white line-clamp-1 drop-shadow">
          {title}
        </div>

        {/* Action Buttons Row */}
        <div className="flex items-center gap-1.5 pt-0.5 pointer-events-auto">
          {/* Circular Green Play / Read Button */}
          <button
            onClick={handlePlayClick}
            className="size-8 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white grid place-items-center shadow-lg active:scale-95 transition cursor-pointer"
            title="Read Chapter"
            aria-label="Read Chapter"
          >
            <Play className="size-4 fill-white translate-x-px" />
          </button>

          {/* Circular Add to Library Button */}
          <button
            onClick={handleBookmarkClick}
            className={`size-8 rounded-full border grid place-items-center active:scale-95 transition cursor-pointer ${
              bookmarked
                ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-400'
                : 'border-white/35 bg-black/60 hover:border-white hover:bg-black/80 text-white'
            }`}
            title={bookmarked ? 'Remove from Library' : 'Add to Library'}
            aria-label={bookmarked ? 'Remove from Library' : 'Add to Library'}
          >
            {bookmarked ? <Check className="size-4 text-emerald-400" /> : <Plus className="size-4" />}
          </button>

          {/* Circular Info Button */}
          <button
            onClick={handleCardClick}
            className="size-8 ml-auto rounded-full border border-white/35 bg-black/60 hover:border-white hover:bg-black/80 text-white grid place-items-center active:scale-95 transition cursor-pointer"
            title="View Details"
            aria-label="View Details"
          >
            <ChevronDown className="size-4" />
          </button>
        </div>

        {/* Metadata subline */}
        <div className="flex items-center gap-1.5 text-[10px] text-white/80 pt-0.5 font-medium">
          <span className="text-emerald-400 font-bold">{isNovel ? 'Light Novel' : 'Manga'}</span>
          {rating ? (
            <>
              <span>•</span>
              <span className="text-amber-400 font-bold">{rating} ★</span>
            </>
          ) : null}
          {item.chapterCount ? (
            <>
              <span>•</span>
              <span>{item.chapterCount} Chs</span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
