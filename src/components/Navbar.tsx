import React, { useState, useEffect } from 'react';
import { BookOpen, Search, Bookmark, Compass, Flame, BookText, Library, Download, Sparkles } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  onNavigate: (route: string) => void;
  onOpenSearch: () => void;
  bookmarkCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onNavigate,
  onOpenSearch,
  bookmarkCount
}) => {
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const desktopNavItems = [
    { id: 'home', label: 'Discover', icon: Compass, route: '#/' },
    { id: 'latest', label: 'Latest Chapters', icon: Sparkles, route: '#/latest' },
    { id: 'comics', label: 'Manga & Manhwa', icon: Flame, route: '#/browse/comics' },
    { id: 'novels', label: 'Light Novels', icon: BookText, route: '#/browse/novels' },
    { id: 'library', label: 'Library', icon: Library, route: '#/library', badge: bookmarkCount }
  ];

  const mobileNavItems = [
    { id: 'home', label: 'Home', icon: Compass, route: '#/' },
    { id: 'latest', label: 'Latest', icon: Sparkles, route: '#/latest' },
    { id: 'comics', label: 'Manga', icon: Flame, route: '#/browse/comics' },
    { id: 'search', label: 'Search', icon: Search, action: onOpenSearch },
    { id: 'library', label: 'Library', icon: Bookmark, route: '#/library', badge: bookmarkCount }
  ];

  return (
    <>
      {/* Top Header (Sticky) */}
      <header className="sticky top-0 z-40 glass-nav transition-all duration-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          
          {/* Logo: Voidflix Manga */}
          <button 
            onClick={() => onNavigate('#/')}
            className="flex items-center gap-2 sm:gap-2.5 text-left group shrink-0 active:scale-95 transition-transform"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-red-600 via-rose-600 to-red-700 flex items-center justify-center text-white shadow-lg shadow-red-600/30 group-hover:scale-105 transition-transform">
              <span className="font-black text-sm sm:text-base tracking-tighter">V</span>
            </div>
            <div>
              <span className="font-black tracking-tight text-base sm:text-lg text-white transition-colors flex items-center gap-1.5">
                VOID<span className="text-red-500">FLIX</span>
                <span className="text-brand-400 text-[10px] sm:text-xs px-1.5 py-0.5 rounded bg-brand-500/15 border border-brand-500/25 font-black uppercase tracking-wider">
                  MANGA
                </span>
              </span>
            </div>
          </button>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/[0.06]">
            {desktopNavItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.route)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive 
                      ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.badge ? (
                    <span className="ml-1 text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-white/20 text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          {/* Search Trigger & PWA Install */}
          <div className="flex items-center gap-2">
            {installPrompt && (
              <button
                onClick={handleInstallClick}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-brand-500/15 hover:bg-brand-500/25 border border-brand-500/30 text-brand-400 text-xs font-bold transition-all active:scale-95"
                title="Install Voidflix Manga App (PWA)"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Install App</span>
              </button>
            )}

            <button
              onClick={onOpenSearch}
              className="flex items-center gap-2 sm:gap-3 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-white/[0.06] hover:bg-white/10 border border-white/10 text-gray-300 text-xs font-medium transition-all group active:scale-95 shadow-sm"
              title="Search titles, authors, or genres (Ctrl + K)"
            >
              <Search className="w-4 h-4 text-brand-400 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">Search manga & novels...</span>
              <span className="sm:hidden text-xs text-gray-400 font-medium">Search</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-bold font-mono text-gray-400 bg-white/10 rounded border border-white/15">
                ⌘K
              </kbd>
            </button>
          </div>

        </div>
      </header>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav 
        className="md:hidden fixed bottom-0 inset-x-0 z-50 glass-nav border-t border-white/10 bg-carbon-950/95 backdrop-blur-xl px-2 py-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl transition-all"
        aria-label="Mobile Navigation"
      >
        <div className="flex items-center justify-around max-w-md mx-auto">
          {mobileNavItems.map(item => {
            const Icon = item.icon;
            const isActive = item.id !== 'search' && activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.action) {
                    item.action();
                  } else if (item.route) {
                    onNavigate(item.route);
                  }
                }}
                className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all active:scale-90 ${
                  isActive 
                    ? 'text-brand-400' 
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {/* Active pill indicator */}
                {isActive && (
                  <span className="absolute -top-1 w-8 h-1 rounded-full bg-brand-500 shadow-sm shadow-brand-500" />
                )}

                <div className="relative">
                  <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 stroke-[2.4]' : 'stroke-[1.8]'}`} />
                  {/* Badge */}
                  {item.badge ? (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-brand-500 text-[10px] font-extrabold text-white flex items-center justify-center shadow-sm">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  ) : null}
                </div>

                <span className={`text-[10px] tracking-tight mt-1 transition-all ${
                  isActive ? 'font-extrabold text-white' : 'font-medium'
                }`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
