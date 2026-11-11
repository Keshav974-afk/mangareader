import React, { useState } from 'react';
import {
  X,
  Download,
  FileText,
  BookOpen,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Chapter, Page } from '../types/atsu';
import {
  DownloadFormat,
  DownloadProgress,
  downloadChapterComic,
  isPdfSource
} from '../utils/mangaDownload';

interface MangaDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  pages: Page[];
  chapter: Chapter | null;
  seriesTitle: string;
}

export const MangaDownloadModal: React.FC<MangaDownloadModalProps> = ({
  isOpen,
  onClose,
  pages,
  chapter,
  seriesTitle
}) => {
  const [downloadingFormat, setDownloadingFormat] = useState<DownloadFormat | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completedFormat, setCompletedFormat] = useState<DownloadFormat | null>(null);

  if (!isOpen) return null;

  const isPdf = isPdfSource(pages, chapter);
  const chapterTitle = chapter?.title || `Chapter ${chapter?.number || 1}`;
  const chapterNumber = chapter?.number || 1;
  const pageCount = pages.length;

  const startDownload = async (format: DownloadFormat) => {
    if (downloadingFormat) return;

    setDownloadingFormat(format);
    setError(null);
    setCompletedFormat(null);
    setProgress({
      current: 0,
      total: pageCount,
      percent: 5,
      message: 'Initializing download engine...'
    });

    try {
      await downloadChapterComic({
        pages,
        chapter,
        seriesTitle,
        chapterTitle,
        chapterNumber,
        format,
        onProgress: (p) => setProgress(p)
      });
      setCompletedFormat(format);
    } catch (err: any) {
      console.error('Download error:', err);
      setError(err?.message || 'Failed to complete download. Please retry.');
    } finally {
      setDownloadingFormat(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={() => {
        if (!downloadingFormat) onClose();
      }}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl bg-[#0f0f14] border border-white/10 p-5 sm:p-6 text-white shadow-2xl max-h-[92vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-500/20 text-brand-400 border border-brand-500/30 uppercase tracking-wider">
                Offline Chapter Download
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white/10 text-gray-300">
                {isPdf ? 'PDF Comic' : `${pageCount} Pages`}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
              {seriesTitle}
            </h3>
            <p className="text-xs text-gray-400 font-medium">
              {chapterTitle}
            </p>
          </div>
          <button
            onClick={() => {
              if (!downloadingFormat) onClose();
            }}
            disabled={!!downloadingFormat}
            className={`p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors ${
              downloadingFormat ? 'opacity-30 cursor-not-allowed' : ''
            }`}
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notice */}
        <div className="my-4 rounded-xl bg-white/5 border border-white/5 p-3 text-xs text-gray-300 leading-relaxed">
          <p>
            Choose your preferred offline format. Files are generated client-side at maximum original resolution with no watermarks.
          </p>
        </div>

        {/* Active Download Progress Bar */}
        {downloadingFormat && progress && (
          <div className="mb-4 rounded-xl border border-brand-500/40 bg-brand-500/10 p-4 space-y-2.5 animate-in fade-in">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-2 text-white">
                <Loader2 className="w-4 h-4 text-brand-400 animate-spin" />
                <span>Generating {downloadingFormat.toUpperCase()}...</span>
              </span>
              <span className="text-brand-400 tabular-nums font-mono">{progress.percent}%</span>
            </div>

            {/* Progress track */}
            <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-brand-500 to-emerald-400 rounded-full transition-all duration-200"
                style={{ width: `${progress.percent}%` }}
              />
            </div>

            <p className="text-[11px] text-gray-300 truncate">
              {progress.message}
            </p>
          </div>
        )}

        {/* Success Banner */}
        {completedFormat && !downloadingFormat && (
          <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex items-center gap-2.5 text-xs text-emerald-300 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-semibold">
              {completedFormat.toUpperCase()} downloaded successfully! Check your browser downloads.
            </span>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 flex items-center gap-2.5 text-xs text-red-300 animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Format Selection Cards */}
        <div className="space-y-3">
          {/* Option 1: PDF Format */}
          <div className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/[0.07] p-3.5 sm:p-4 transition group">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    PDF Document (.pdf)
                  </h4>
                  <span className="text-[10px] font-semibold text-rose-300">
                    Universal Reader • Books, Acrobat, Kindle
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-gray-300 leading-normal my-2.5">
              High-resolution multi-page PDF formatted to each page&apos;s exact dimensions. Works on Adobe Acrobat, Apple Books, Google Drive, Kindle, and all PDF apps.
            </p>

            <button
              onClick={() => startDownload('pdf')}
              disabled={!!downloadingFormat}
              className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition shadow active:scale-95 cursor-pointer ${
                downloadingFormat === 'pdf'
                  ? 'bg-rose-600/50 text-white cursor-wait'
                  : 'bg-rose-600 hover:bg-rose-500 text-white'
              }`}
            >
              {downloadingFormat === 'pdf' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download as PDF</span>
                </>
              )}
            </button>
          </div>

          {/* Option 2: CBZ Format */}
          <div className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/[0.07] p-3.5 sm:p-4 transition group">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    Comic Book ZIP (.cbz)
                  </h4>
                  <span className="text-[10px] font-semibold text-indigo-300">
                    Standard Comic Archive • Tachiyomi, Mihon, CDisplayEx
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-gray-300 leading-normal my-2.5">
              Standard comic archive with sequentially named pages and embedded <code className="text-[10px] text-gray-400">ComicInfo.xml</code> metadata. Perfect for dedicated comic and manga readers on mobile or desktop.
            </p>

            <button
              onClick={() => startDownload('cbz')}
              disabled={!!downloadingFormat}
              className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition shadow active:scale-95 cursor-pointer ${
                downloadingFormat === 'cbz'
                  ? 'bg-indigo-600/50 text-white cursor-wait'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
            >
              {downloadingFormat === 'cbz' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Packaging CBZ...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download as CBZ</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between">
          <span className="text-[11px] text-gray-400">
            {isPdf ? 'Source: Direct PDF' : `Source: ${pageCount} High-Res Images`}
          </span>
          <button
            onClick={() => {
              if (!downloadingFormat) onClose();
            }}
            disabled={!!downloadingFormat}
            className={`text-xs font-semibold text-gray-400 hover:text-white transition-colors ${
              downloadingFormat ? 'opacity-30 cursor-not-allowed' : ''
            }`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
