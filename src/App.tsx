import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navbar } from './components/Navbar';
import { MobileTabBar } from './components/MobileTabBar';
import { Footer } from './components/Footer';
import { SearchModal } from './components/SearchModal';
import { ErrorBoundary } from './components/ErrorBoundary';
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

    if (route.startsWith('#/latest') || route.startsWith('#/browse/latest')) {
      return <BrowsePage category="latest" onNavigate={navigate} />;
    }

    if (route.startsWith('#/browse/')) {
      const category = route.replace('#/browse/', '');
      return <BrowsePage category={category} onNavigate={navigate} />;
    }

    return <HomePage onNavigate={navigate} />;
  };

  const getActiveTab = () => {
    if (route.includes('/latest')) return 'latest';
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
        <div className={`flex-1 ${!isReader ? 'max-w-[1920px] mx-auto w-full pt-16 sm:pt-20 pb-24 md:pb-12' : ''}`}>
          <ErrorBoundary key={route}>
            {renderCurrentView()}
          </ErrorBoundary>
        </div>

        {/* Global Search Modal */}
        <SearchModal
          isOpen={searchOpen}
          onClose={() => setSearchOpen(false)}
          onNavigate={navigate}
        />

        {/* Floating Mobile Tab Bar matching Flowflix (hidden on desktop and in reader) */}
        {!isReader && (
          <MobileTabBar
            activeTab={getActiveTab()}
            onNavigate={navigate}
            onOpenSearch={() => setSearchOpen(true)}
            bookmarkCount={bookmarkList.length}
          />
        )}

        {/* Flowflix 4-Column Cinema Footer */}
        {!isReader && <Footer onNavigate={navigate} />}

      </div>
    </QueryClientProvider>
  );
};
