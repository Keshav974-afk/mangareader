import React, { useState, useEffect } from 'react';
import { Search, Compass, Sparkles, Flame, BookText, Bookmark, Download, X, Smartphone, Monitor } from 'lucide-react';
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
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    // Check if already in standalone PWA mode
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
    }

    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (installPrompt) {
      try {
        installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        if (outcome === 'accepted') {
          setInstallPrompt(null);
          setIsInstalled(true);
        }
      } catch (e) {
        setShowInstallGuide(true);
      }
    } else {
      setShowInstallGuide(true);
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
    <>
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
            className="flex items-center text-left shrink-0 active:scale-95 transition-transform cursor-pointer"
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
                  <item.icon className="w-4 h-4 opacity-75" />
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-emerald-500 text-white">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Action Bar (Search Capsule + Install App Button + Mobile Library) */}
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {/* Always-visible Search Capsule with shortcut indicator */}
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

            {/* Install App Button (Placed instead of Shuffle) */}
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold transition-all shadow-md shadow-emerald-500/25 active:scale-95 cursor-pointer shrink-0"
              title={isInstalled ? "Voidflix Manga Installed" : "Install Voidflix Manga App (PWA)"}
              aria-label="Install App"
            >
              <Download className="size-3.5" />
              <span className="hidden xs:inline sm:inline">
                {isInstalled ? 'App Ready' : 'Install App'}
              </span>
            </button>

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

      {/* PWA Install Guide Modal (Shown when clicked if native prompt isn't already primed) */}
      {showInstallGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in"
          onClick={() => setShowInstallGuide(false)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl bg-[#121218] border border-white/15 p-5 sm:p-6 text-white shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Install Voidflix Manga</h3>
                  <p className="text-xs text-gray-400">Offline reading, zero ads, fullscreen app</p>
                </div>
              </div>
              <button
                onClick={() => setShowInstallGuide(false)}
                className="p-1 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-gray-300">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/10">
                <Monitor className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-white">Desktop (Chrome / Edge / Brave)</h4>
                  <p className="text-gray-400 mt-0.5">Click the install icon (⊕ or ⊞) in your browser address bar at the top right.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/10">
                <Smartphone className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-white">Mobile (iOS Safari / Android)</h4>
                  <p className="text-gray-400 mt-0.5">
                    <strong>iOS:</strong> Tap the Share button (<span className="text-white font-mono">⎋</span>) and choose <strong>&ldquo;Add to Home Screen&rdquo;</strong>.<br />
                    <strong>Android:</strong> Tap the menu (<span className="text-white font-mono">⋮</span>) and select <strong>&ldquo;Install App&rdquo;</strong>.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowInstallGuide(false)}
                className="px-5 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs transition cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
