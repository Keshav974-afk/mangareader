import React, { useState, useEffect } from 'react';
import { Search, Compass, Sparkles, Flame, BookText, Bookmark, Shuffle, Download } from 'lucide-react';
import { api } from '../services/api';
import { Logo } from './Logo';

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
  bookmarkCount,
}) => {
  const [scrolled, setScrolled] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isSurpriseLoading, setIsSurpriseLoading] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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

  const handleSurpriseMe = async () => {
    if (isSurpriseLoading) return;
    setIsSurpriseLoading(true);
    try {
      const res = await api.getPopular({ timeframe: 'daily', limit: 20 });
      if (res && res.items && res.items.length > 0) {
        const randomIndex = Math.floor(Math.random() * res.items.length);
        const randomItem = res.items[randomIndex];
        onNavigate(`#/manga/${randomItem.id}`);
      }
    } catch {
      // fallback
    } finally {
      setIsSurpriseLoading(false);
    }
  };

  const navItems = [
    { id: 'home', label: 'Home', icon: Compass, route: '#/' },
    { id: 'latest', label: 'Latest', icon: Sparkles, route: '#/latest' },
    { id: 'comics', label: 'Manga & Manhwa', icon: Flame, route: '#/browse/comics' },
    { id: 'novels', label: 'Light Novels', icon: BookText, route: '#/browse/novels' },
    { id: 'library', label: 'My Library', icon: Bookmark, route: '#/library', badge: bookmarkCount },
  ];

  return (
    <header
      className={`fixed top-0 inset-x-0 z-40 transition-all duration-300 ${
        scrolled
          ? 'glass-strong border-x-0 border-t-0'
          : 'bg-gradient-to-b from-black/90 via-black/40 to-transparent'
      }`}
    >
      <div className="flex items-center gap-3 sm:gap-6 px-4 sm:px-8 h-16 sm:h-18 max-w-[1920px] mx-auto">
        {/* Brand Logo matching Flowflix with Emerald Theme */}
        <button
          onClick={() => onNavigate('#/')}
          className="text-left shrink-0 active:scale-95 transition-transform cursor-pointer"
          aria-label="Voidflix Manga Home"
        >
          <Logo size="md" />
        </button>

        {/* Desktop Navigation Links with Flowflix-style rounded active pill */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-2 text-sm ml-2">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.route)}
                className={`px-3.5 py-1.5 rounded-full transition-all text-[13px] xl:text-[14px] flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-black/75 text-emerald-400 font-bold border border-white/10 shadow-md backdrop-blur-sm ring-1 ring-emerald-500/30'
                    : 'text-white/70 hover:text-white hover:bg-white/5 font-medium'
                }`}
              >
                <span>{item.label}</span>
                {item.badge ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/30 text-emerald-300">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* Right Action Icons: Search Capsule + Surprise Me + Install App */}
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {/* Flowflix Desktop Search Capsule */}
          <div
            onClick={onOpenSearch}
            className="flex items-center rounded-full border border-white/20 bg-black/50 px-3.5 py-1.5 text-sm text-white hover:border-emerald-500/60 transition-all duration-300 w-36 sm:w-52 lg:w-64 shadow-inner cursor-pointer group"
          >
            <Search className="size-4 text-emerald-400 mr-2 shrink-0 group-hover:scale-110 transition-transform" />
            <span className="text-xs sm:text-[13px] text-white/60 group-hover:text-white/80 transition-colors truncate">
              Titles, authors, genres...
            </span>
            <kbd className="hidden lg:inline-block ml-auto px-1.5 py-0.5 text-[10px] font-bold font-mono text-gray-400 bg-white/10 rounded border border-white/10">
              ⌘K
            </kbd>
          </div>

          {/* Surprise Me / Random Manga Button */}
          <button
            onClick={handleSurpriseMe}
            disabled={isSurpriseLoading}
            className="size-9 sm:size-10 grid place-items-center rounded-full border border-white/15 bg-black/40 hover:bg-white/10 text-emerald-400 hover:text-emerald-300 transition active:scale-95 cursor-pointer shadow-sm"
            title="Surprise Me (Random Title)"
            aria-label="Surprise Me"
          >
            <Shuffle className={`size-4 ${isSurpriseLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* PWA Install Button */}
          {installPrompt && (
            <button
              onClick={handleInstallClick}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-bold transition active:scale-95 cursor-pointer"
              title="Install Voidflix Manga App (PWA)"
            >
              <Download className="size-3.5" />
              <span>Install App</span>
            </button>
          )}

          {/* Library Link on mobile / tablet */}
          <button
            onClick={() => onNavigate('#/library')}
            className="lg:hidden size-9 grid place-items-center rounded-full border border-white/15 bg-black/40 text-white/80 hover:text-white transition cursor-pointer relative"
            title="Library"
          >
            <Bookmark className="size-4" />
            {bookmarkCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-emerald-500 text-[10px] font-black text-white flex items-center justify-center">
                {bookmarkCount > 99 ? '99+' : bookmarkCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
