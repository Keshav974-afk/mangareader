import React, { useState } from 'react';
import { Bookmark, Play, Trash2, BookOpen, BookText } from 'lucide-react';
import { useReadingHistory } from '../hooks/useReadingHistory';
import { MediumType } from '../types/atsu';
import { MangaCard } from '../components/MangaCard';

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
    <div className="space-y-8 pb-20 fade-enter px-3 sm:px-6 md:px-8">
      
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

        {/* Tab & Medium Switcher (Flowflix Pill Capsules) */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Main Tab */}
          <div className="flex bg-[#181818] p-1 rounded-full border border-white/10 text-xs font-semibold shadow-inner">
            <button
              onClick={() => setTab('history')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                tab === 'history' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Continue Reading ({historyList.length})
            </button>
            <button
              onClick={() => setTab('bookmarks')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                tab === 'bookmarks' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Bookmarks ({bookmarkList.length})
            </button>
          </div>

          {/* Medium Filter */}
          <div className="flex bg-[#181818] p-1 rounded-full border border-white/10 text-xs font-semibold shadow-inner">
            {(['all', 'Comic', 'Novel'] as const).map(m => (
              <button
                key={m}
                onClick={() => setFilterMedium(m)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  filterMedium === m ? 'bg-white/20 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'
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
                  className="p-3.5 rounded-2xl bg-[#181818] border border-white/10 hover:border-emerald-500/40 cursor-pointer transition-all hover:scale-102 group relative shadow-lg"
                >
                  <div className="flex gap-3">
                    <div className="w-16 h-24 rounded-xl bg-carbon-800 overflow-hidden shrink-0 relative border border-white/10">
                      <img src={item.cover} alt={item.mangaTitle} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      <div className="absolute inset-0 bg-black/30 group-hover:bg-transparent transition-colors" />
                    </div>

                    <div className="min-w-0 flex-1 flex flex-col justify-between">
                      <div>
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          {item.medium}
                        </span>
                        <h3 className="font-bold text-sm text-white truncate mt-1 group-hover:text-emerald-400 transition-colors">
                          {item.mangaTitle}
                        </h3>
                        <p className="text-xs text-gray-400 truncate mt-0.5">
                          {item.chapterTitle}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-gray-400 pt-2">
                        <span className="font-semibold text-emerald-400">{item.progressPercent}% finished</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeHistory(item.mangaId);
                          }}
                          className="p-1.5 text-gray-500 hover:text-red-400 rounded-full hover:bg-white/5 transition cursor-pointer"
                          title="Remove from history"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Flowflix Emerald Progress Bar */}
                  <div className="w-full h-1 bg-white/15 rounded-full mt-3 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${Math.max(5, item.progressPercent || 0)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center text-gray-500 space-y-3">
              <BookOpen className="w-12 h-12 mx-auto opacity-30 text-emerald-400" />
              <h3 className="text-base font-bold text-gray-300">No Reading History Yet</h3>
              <p className="text-xs max-w-sm mx-auto text-gray-400">
                Start reading any manga, manhwa, or light novel and your progress will be tracked here.
              </p>
              <button
                onClick={() => onNavigate('#/')}
                className="mt-2 px-6 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
              >
                Browse Titles
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bookmarks Grid (Flowflix MediaCard format) */}
      {tab === 'bookmarks' && (
        <div>
          {filteredBookmarks.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
              {filteredBookmarks.map(item => (
                <MangaCard
                  key={item.id}
                  item={item as any}
                  onNavigate={onNavigate}
                  width="w-full"
                />
              ))}
            </div>
          ) : (
            <div className="py-20 text-center text-gray-500 space-y-3">
              <Bookmark className="w-12 h-12 mx-auto opacity-30 text-emerald-400" />
              <h3 className="text-base font-bold text-gray-300">No Bookmarks Saved</h3>
              <p className="text-xs max-w-sm mx-auto text-gray-400">
                Click the Bookmark icon on any series page to keep it handy in your personal library.
              </p>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
