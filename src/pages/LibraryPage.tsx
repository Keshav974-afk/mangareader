import React, { useState } from 'react';
import { Bookmark, Play, Trash2, BookOpen, BookText } from 'lucide-react';
import { useReadingHistory } from '../hooks/useReadingHistory';
import { MediumType } from '../types/atsu';

interface LibraryPageProps {
  onNavigate: (route: string) => void;
}

export const LibraryPage: React.FC<LibraryPageProps> = ({ onNavigate }) => {
  const [tab, setTab] = useState<'history' | 'bookmarks'>('history');
  const [filterMedium, setFilterMedium] = useState<'all' | MediumType>('all');

  const { historyList, bookmarkList, removeHistory } = useReadingHistory();

  const filteredHistory = historyList.filter(item => {
    if (filterMedium === 'all') return true;
    return item.medium === filterMedium;
  });

  const filteredBookmarks = bookmarkList.filter(item => {
    if (filterMedium === 'all') return true;
    return item.medium === filterMedium;
  });

  return (
    <div className="space-y-8 pb-20 fade-enter">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            My Library
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Track reading progress and saved bookmarks locally
          </p>
        </div>

        {/* Tab & Medium Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Main Tab */}
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 text-xs font-semibold">
            <button
              onClick={() => setTab('history')}
              className={`px-3.5 py-1.5 rounded-lg transition ${
                tab === 'history' ? 'bg-brand-500 text-white font-bold' : 'text-gray-400 hover:text-white'
              }`}
            >
              Continue Reading ({historyList.length})
            </button>
            <button
              onClick={() => setTab('bookmarks')}
              className={`px-3.5 py-1.5 rounded-lg transition ${
                tab === 'bookmarks' ? 'bg-brand-500 text-white font-bold' : 'text-gray-400 hover:text-white'
              }`}
            >
              Bookmarks ({bookmarkList.length})
            </button>
          </div>

          {/* Medium Filter */}
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 text-xs font-semibold">
            {(['all', 'Comic', 'Novel'] as const).map(m => (
              <button
                key={m}
                onClick={() => setFilterMedium(m)}
                className={`px-2.5 py-1 rounded-lg transition ${
                  filterMedium === m ? 'bg-white/20 text-white font-bold' : 'text-gray-400 hover:text-white'
                }`}
              >
                {m === 'all' ? 'All' : m === 'Comic' ? 'Comics' : 'Novels'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* History Grid */}
      {tab === 'history' && (
        <div>
          {filteredHistory.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredHistory.map(item => (
                <div
                  key={item.mangaId}
                  onClick={() => onNavigate(`#/read/${item.mangaId}/${item.chapterId}`)}
                  className="p-3.5 rounded-2xl bg-carbon-900 border border-white/10 hover:border-white/30 cursor-pointer transition-all hover:-translate-y-1 group relative"
                >
                  <div className="flex gap-3">
                    <div className="w-16 h-24 rounded-xl bg-carbon-800 overflow-hidden shrink-0 relative">
                      <img src={item.cover} alt={item.mangaTitle} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/30 group-hover:bg-transparent transition-colors" />
                    </div>

                    <div className="min-w-0 flex-1 flex flex-col justify-between">
                      <div>
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400">
                          {item.medium}
                        </span>
                        <h3 className="font-bold text-sm text-white truncate mt-1 group-hover:text-brand-400 transition-colors">
                          {item.mangaTitle}
                        </h3>
                        <p className="text-xs text-gray-400 truncate mt-0.5">
                          {item.chapterTitle}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-gray-500 pt-2">
                        <span>{item.progressPercent}% finished</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeHistory(item.mangaId);
                          }}
                          className="p-1 text-gray-500 hover:text-red-400 rounded transition"
                          title="Remove"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Progress Line */}
                  <div className="w-full h-1 bg-white/10 rounded-full mt-3 overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full"
                      style={{ width: `${Math.max(5, item.progressPercent || 0)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center text-gray-500 space-y-3">
              <BookOpen className="w-12 h-12 mx-auto opacity-30 text-brand-400" />
              <h3 className="text-base font-bold text-gray-300">No Reading History Yet</h3>
              <p className="text-xs max-w-sm mx-auto">
                Start reading any manga, manhwa, or light novel and your progress will be tracked here.
              </p>
              <button
                onClick={() => onNavigate('#/')}
                className="mt-2 px-5 py-2.5 rounded-xl bg-brand-500 text-white font-bold text-xs"
              >
                Browse Titles
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bookmarks Grid */}
      {tab === 'bookmarks' && (
        <div>
          {filteredBookmarks.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filteredBookmarks.map(item => (
                <div
                  key={item.id}
                  onClick={() => onNavigate(`#/manga/${item.id}`)}
                  className="rounded-xl overflow-hidden bg-carbon-900 border border-white/10 hover:border-brand-500/40 cursor-pointer transition-all hover:-translate-y-1 group"
                >
                  <div className="aspect-[2/3] bg-carbon-800 relative">
                    <img src={item.cover} alt={item.title} className="w-full h-full object-cover" />
                    <span className="absolute top-2 left-2 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-black/75 text-white backdrop-blur">
                      {item.medium}
                    </span>
                  </div>
                  <div className="p-2.5">
                    <h4 className="font-bold text-xs text-white truncate group-hover:text-brand-400 transition-colors">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-gray-400 mt-0.5">{item.type || 'Manga'}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center text-gray-500 space-y-3">
              <Bookmark className="w-12 h-12 mx-auto opacity-30 text-brand-400" />
              <h3 className="text-base font-bold text-gray-300">No Bookmarks Saved</h3>
              <p className="text-xs max-w-sm mx-auto">
                Click the Bookmark icon on any series page to keep it handy in your personal library.
              </p>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
