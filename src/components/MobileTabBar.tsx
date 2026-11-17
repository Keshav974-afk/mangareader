import React from 'react';
import { Compass, Sparkles, Flame, Search, Bookmark } from 'lucide-react';

interface MobileTabBarProps {
  activeTab: string;
  onNavigate: (route: string) => void;
  onOpenSearch: () => void;
  bookmarkCount: number;
}

/**
 * Mobile floating pill tab bar matching Flowflix Web UI.
 * Features: Home | Latest | Manga | Search | Library
 * Translucent rounded glass capsule with active glow and emerald accents.
 * Hidden on desktop (md+) and inside the immersive reader.
 */
export const MobileTabBar: React.FC<MobileTabBarProps> = ({
  activeTab,
  onNavigate,
  onOpenSearch,
  bookmarkCount,
}) => {
  const tabs = [
    { id: 'home', label: 'Home', icon: Compass, route: '#/' },
    { id: 'latest', label: 'Latest', icon: Sparkles, route: '#/latest' },
    { id: 'comics', label: 'Manga', icon: Flame, route: '#/browse/comics' },
    { id: 'search', label: 'Search', icon: Search, action: onOpenSearch },
    { id: 'library', label: 'Library', icon: Bookmark, route: '#/library', badge: bookmarkCount },
  ] as const;

  return (
    <div
      className="fixed inset-x-0 bottom-3 z-50 flex justify-center px-4 pointer-events-none md:hidden select-none"
      style={{ touchAction: 'manipulation' }}
    >
      <nav className="pointer-events-auto flex h-14 w-full max-w-sm items-center justify-between rounded-full border border-white/15 bg-[#121218]/92 px-2.5 py-1 shadow-[0_8px_32px_rgba(0,0,0,0.85)] backdrop-blur-2xl">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = t.id !== 'search' && activeTab === t.id;

          return (
            <button
              key={t.id}
              onClick={() => {
                if ('action' in t && t.action) {
                  t.action();
                } else if ('route' in t && t.route) {
                  onNavigate(t.route);
                }
              }}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full py-1 text-center transition-all cursor-pointer ${
                isActive
                  ? 'bg-emerald-500/15 text-emerald-400 font-bold shadow-sm'
                  : 'text-white/60 hover:text-white/90'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`size-4.5 sm:size-5 transition-transform ${
                    isActive ? 'scale-110 stroke-[2.4] text-emerald-400' : 'stroke-[1.8]'
                  }`}
                />
                {'badge' in t && t.badge && t.badge > 0 ? (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[15px] h-3.5 px-1 rounded-full bg-emerald-500 text-[9px] font-black text-white flex items-center justify-center shadow-sm">
                    {t.badge > 99 ? '99+' : t.badge}
                  </span>
                ) : null}
              </div>
              <span className={`text-[10px] tracking-tight leading-none ${isActive ? 'text-emerald-400 font-bold' : 'text-gray-400'}`}>
                {t.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
