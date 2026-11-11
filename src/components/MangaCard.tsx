import React, { useState } from 'react';
import { Star, BookOpen, BookText, Clock } from 'lucide-react';
import { MangaItem } from '../types/atsu';
import { api } from '../services/api';

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 0) return 'Just now';
  const mins = Math.floor(diff / (60 * 1000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

interface MangaCardProps {
  item: MangaItem;
  onNavigate: (route: string) => void;
  width?: string;
}

export const MangaCard: React.FC<MangaCardProps> = ({ item, onNavigate, width = 'w-36 sm:w-44 md:w-48' }) => {
  const [imgError, setImgError] = useState(false);
  const [fallbackTried, setFallbackTried] = useState(false);
  const initialUrl = api.getPosterUrl(item, 'medium');
  const [imgSrc, setImgSrc] = useState(initialUrl);

  const isNovel = item.medium === 'Novel';
  const rating = item.mbRating ? item.mbRating.toFixed(1) : null;
  const title = item.title || item.englishTitle || 'Untitled';

  const handleError = () => {
    // If initial image fails, fallback to WordPress Photon edge
    if (!fallbackTried) {
      setFallbackTried(true);
      const posterPath = item.image || (item as any).poster?.image || item.mediumImage || (item as any).poster?.mediumImage || '';
      const clean = posterPath.replace(/^https?:\/\/cdn\.atsu\.moe\//, '').replace(/^\/?static\/?/, '');
      if (clean) {
        setImgSrc(`https://i0.wp.com/cdn.atsu.moe/static/${clean}`);
        return;
      }
    }
    setImgError(true);
  };

  return (
    <div
      onClick={() => onNavigate(`#/manga/${item.id}`)}
      className={`group relative ${width.includes('w-full') ? 'w-full' : 'shrink-0 ' + width} cursor-pointer select-none transition-all duration-300 hover:-translate-y-1 active:scale-95`}
    >
      {/* Poster wrapper with aspect ratio 2/3 */}
      <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-carbon-800 border border-white/[0.08] group-hover:border-white/30 transition-all">
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

        {/* Gradient shadow overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-carbon-950 via-carbon-950/20 to-transparent opacity-80 group-hover:opacity-60 transition-opacity" />

        {/* Top Badges */}
        <div className="absolute top-2 inset-x-2 flex items-center justify-between gap-1 pointer-events-none">
          {/* Medium Pill */}
          <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md backdrop-blur-md shadow-sm ${
            isNovel 
              ? 'bg-indigo-600/90 text-white border border-indigo-400/30' 
              : 'bg-emerald-600/90 text-white border border-emerald-400/30'
          }`}>
            {isNovel ? 'Novel' : (item.type || 'Comic')}
          </span>

          {/* Rating */}
          {rating ? (
            <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-amber-400 border border-white/10">
              <Star className="w-3 h-3 fill-amber-400 stroke-amber-400" />
              {rating}
            </span>
          ) : null}
        </div>

        {/* Bottom Info inside poster */}
        <div className="absolute bottom-2 inset-x-2 pointer-events-none flex items-center justify-between gap-1">
          {item.chapterCount ? (
            <span className="text-[10px] font-medium text-gray-300 bg-black/70 px-1.5 py-0.5 rounded backdrop-blur border border-white/5">
              {item.chapterCount} Ch
            </span>
          ) : <span />}
          {item.updatedAt ? (
            <span className="text-[9px] font-semibold text-gray-200 bg-black/85 px-1.5 py-0.5 rounded backdrop-blur border border-white/10 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5 text-gray-400" />
              {formatTimeAgo(item.updatedAt)}
            </span>
          ) : null}
        </div>
      </div>

      {/* Title & Type below poster */}
      <div className="pt-2 px-0.5">
        <h3 className="font-bold text-xs sm:text-sm text-gray-100 group-hover:text-brand-400 transition-colors line-clamp-2 leading-snug">
          {title}
        </h3>
        <p className="text-[11px] text-gray-400 mt-0.5 truncate flex items-center gap-1.5">
          <span>{isNovel ? 'Light Novel' : (item.type || 'Manga')}</span>
          {item.status ? (
            <>
              <span className="text-gray-600">•</span>
              <span className="text-gray-400">{item.status}</span>
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
};
