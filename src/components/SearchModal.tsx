import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Star, BookOpen, BookText, Loader2 } from 'lucide-react';
import { MangaItem, MediumType } from '../types/atsu';
import { api } from '../services/api';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (route: string) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [medium, setMedium] = useState<'all' | MediumType>('all');
  const [results, setResults] = useState<MangaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await api.search({ query, medium, perPage: 20 });
        setResults(res.items);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query, medium]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-start justify-center p-3 sm:p-6 md:pt-16 fade-enter"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl bg-carbon-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Search Header */}
        <div className="p-4 border-b border-white/10 flex items-center gap-3">
          <Search className="w-5 h-5 text-brand-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search thousands of manga, manhwa, novels, authors..."
            className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm sm:text-base outline-none font-medium"
          />
          {isLoading && <Loader2 className="w-5 h-5 text-brand-400 animate-spin shrink-0" />}
          {query ? (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-md text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-gray-500 bg-white/5 rounded border border-white/10">
              ESC
            </kbd>
          )}
        </div>

        {/* Medium Filters */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-carbon-950/60 border-b border-white/5 text-xs font-semibold overflow-x-auto no-scrollbar">
          {(['all', 'Comic', 'Novel'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMedium(m)}
              className={`px-3 py-1 rounded-lg transition-all ${
                medium === m
                  ? 'bg-brand-500 text-white font-bold shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {m === 'all' ? 'All Content' : m === 'Comic' ? 'Comics & Manga' : 'Light Novels'}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 no-scrollbar">
          {results.length > 0 ? (
            results.map(item => {
              const isNovel = item.medium === 'Novel';
              const posterUrl = api.getPosterUrl(item, 'small');
              const rating = item.mbRating ? item.mbRating.toFixed(1) : null;

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    onClose();
                    onNavigate(`#/manga/${item.id}`);
                  }}
                  className="flex items-center gap-3.5 p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.04] hover:border-brand-500/30 cursor-pointer transition-all group"
                >
                  {/* Thumbnail */}
                  <div className="w-12 h-16 rounded-lg overflow-hidden bg-carbon-800 shrink-0 relative">
                    {posterUrl ? (
                      <img src={posterUrl} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600">
                        {isNovel ? <BookText className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                        isNovel ? 'bg-indigo-500/20 text-indigo-300' : 'bg-brand-500/20 text-brand-400'
                      }`}>
                        {isNovel ? 'Novel' : (item.type || 'Manga')}
                      </span>
                      {rating && (
                        <span className="flex items-center gap-0.5 text-[10px] text-amber-400 font-bold">
                          <Star className="w-3 h-3 fill-amber-400" />
                          {rating}
                        </span>
                      )}
                      {item.status && (
                        <span className="text-[10px] text-gray-500">{item.status}</span>
                      )}
                    </div>

                    <h4 className="font-bold text-sm text-gray-200 group-hover:text-brand-400 transition-colors truncate">
                      {item.title}
                    </h4>

                    {item.tags && item.tags.length > 0 && (
                      <p className="text-[11px] text-gray-500 truncate mt-0.5">
                        {item.tags.slice(0, 4).join(', ')}
                      </p>
                    )}
                  </div>

                  {/* Chapter Count */}
                  {item.chapterCount ? (
                    <span className="text-xs text-gray-400 shrink-0 hidden sm:inline">
                      {item.chapterCount} ch
                    </span>
                  ) : null}
                </div>
              );
            })
          ) : query && !isLoading ? (
            <div className="p-8 text-center text-gray-500">
              <p className="text-sm">No manga or novels found matching "{query}"</p>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Popular Searches</p>
              <div className="flex flex-wrap justify-center gap-2">
                {['Solo Leveling', 'Shadow Slave', 'One Piece', 'Witch Hat Atelier', 'Omniscient Reader', 'Lord of the Mysteries'].map(s => (
                  <button
                    key={s}
                    onClick={() => setQuery(s)}
                    className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-300 transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
