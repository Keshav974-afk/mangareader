import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { MangaPageInfo, Chapter } from '../types/atsu';
import { api } from '../services/api';
import { MangaReader } from '../components/MangaReader';
import { NovelReader } from '../components/NovelReader';

interface ReaderPageProps {
  mangaId: string;
  chapterId: string;
  onNavigate: (route: string) => void;
}

export const ReaderPage: React.FC<ReaderPageProps> = ({
  mangaId,
  chapterId,
  onNavigate
}) => {
  const [mangaInfo, setMangaInfo] = useState<MangaPageInfo | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    Promise.all([
      api.getMangaInfo(mangaId).catch(() => null),
      api.getAllChapters(mangaId).catch(() => [])
    ]).then(([info, chs]) => {
      if (!isMounted) return;
      setMangaInfo(info);
      setChapters(chs || []);
      setIsLoading(false);
    });

    return () => { isMounted = false; };
  }, [mangaId]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-carbon-950 flex flex-col items-center justify-center text-white z-50">
        <Loader2 className="w-10 h-10 text-brand-400 animate-spin mb-4" />
        <p className="text-sm font-semibold text-gray-300">Opening reader...</p>
      </div>
    );
  }

  const isNovel = mangaInfo?.medium === 'Novel';

  if (isNovel) {
    return (
      <NovelReader
        mangaId={mangaId}
        chapterId={chapterId}
        mangaInfo={mangaInfo || undefined}
        allChapters={chapters}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <MangaReader
      mangaId={mangaId}
      chapterId={chapterId}
      mangaInfo={mangaInfo || undefined}
      allChapters={chapters}
      onNavigate={onNavigate}
    />
  );
};
