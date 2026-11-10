import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navbar } from './components/Navbar';
import { SearchModal } from './components/SearchModal';
import { HomePage } from './pages/HomePage';
import { DetailsPage } from './pages/DetailsPage';
import { ReaderPage } from './pages/ReaderPage';
import { BrowsePage } from './pages/BrowsePage';
import { LibraryPage } from './pages/LibraryPage';
import { useReadingHistory } from './hooks/useReadingHistory';
import { BookOpen, Heart, Sparkles } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 2 * 60 * 1000
    }
  }
});

export const App: React.FC = () => {
  const [route, setRoute] = useState(window.location.hash || '#/');
  const [searchOpen, setSearchOpen] = useState(false);
  const { bookmarkList } = useReadingHistory();

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(window.location.hash || '#/');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Keyboard shortcut Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navigate = (newRoute: string) => {
    window.location.hash = newRoute;
  };

  // Parse active route
  const isReader = route.startsWith('#/read/') || route.startsWith('#/novel/');
  
  // Route resolver
  const renderCurrentView = () => {
    if (route.startsWith('#/read/') || route.startsWith('#/novel/')) {
      const parts = route.split('/');
      const mangaId = parts[2];
      const chapterId = parts[3];
      if (mangaId && chapterId) {
        return <ReaderPage mangaId={mangaId} chapterId={chapterId} onNavigate={navigate} />;
      }
    }

    if (route.startsWith('#/manga/')) {
      const mangaId = route.replace('#/manga/', '');
      return <DetailsPage mangaId={mangaId} onNavigate={navigate} />;
    }

    if (route.startsWith('#/browse/library') || route === '#/library') {
      return <LibraryPage onNavigate={navigate} />;
    }

    if (route.startsWith('#/browse/')) {
      const category = route.replace('#/browse/', '');
      return <BrowsePage category={category} onNavigate={navigate} />;
    }

    return <HomePage onNavigate={navigate} />;
  };

  const getActiveTab = () => {
    if (route.includes('/library')) return 'library';
    if (route.includes('/comics')) return 'comics';
    if (route.includes('/novels')) return 'novels';
    return 'home';
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen flex flex-col bg-carbon-950 text-gray-100 selection:bg-brand-500 selection:text-white">
        
        {/* Navbar is hidden during immersive reading */}
        {!isReader && (
          <Navbar
            activeTab={getActiveTab()}
            onNavigate={navigate}
            onOpenSearch={() => setSearchOpen(true)}
            bookmarkCount={bookmarkList.length}
          />
        )}

        {/* Main Content Area */}
        <div className={`flex-1 ${!isReader ? 'max-w-7xl mx-auto w-full px-3 sm:px-6 pt-4 sm:pt-6 pb-20 md:pb-10' : ''}`}>
          {renderCurrentView()}
        </div>

        {/* Global Search Modal */}
        <SearchModal
          isOpen={searchOpen}
          onClose={() => setSearchOpen(false)}
          onNavigate={navigate}
        />

        {/* Global Footer (only visible when not in reader) */}
        {!isReader && (
          <footer className="mt-auto border-t border-white/10 bg-carbon-900/60 py-8 md:py-10 pb-28 md:pb-10 px-4 sm:px-6">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-red-600 to-rose-700 flex items-center justify-center text-white font-black text-xs">
                  V
                </div>
                <span className="font-black text-white text-sm tracking-tight">VOID<span className="text-red-500">FLIX</span> <span className="text-brand-400 font-extrabold text-xs">MANGA</span></span>
                <span className="text-gray-600 hidden sm:inline">|</span>
                <span className="hidden sm:inline">Fast, modern PWA manga & novel reader</span>
              </div>

              <div className="flex items-center gap-4 text-gray-500">
                <span>AVIF / WebP Accelerated</span>
                <span>•</span>
                <span>Distraction-Free Typography</span>
                <span>•</span>
                <span>Zero Ads</span>
              </div>
            </div>
          </footer>
        )}

      </div>
    </QueryClientProvider>
  );
};
