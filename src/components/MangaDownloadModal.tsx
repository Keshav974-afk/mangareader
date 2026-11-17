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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={() => {
        if (!downloadingFormat) onClose();
      }}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl bg-[#121218] border border-white/10 p-5 sm:p-6 text-white shadow-2xl max-h-[92vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/10 text-gray-300 border border-white/10">
                Chapter Download
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-white/5 text-gray-400 border border-white/5">
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
            className={`p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer ${
              downloadingFormat ? 'opacity-30 cursor-not-allowed' : ''
            }`}
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notice */}
        <div className="my-4 rounded-xl bg-white/[0.03] border border-white/10 p-3 text-xs text-gray-300 leading-relaxed">
          <p>
            Choose your preferred offline format. Files are generated client-side at maximum original resolution with no watermarks.
          </p>
        </div>

        {/* Active Download Progress Bar */}
        {downloadingFormat && progress && (
          <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2.5 animate-in fade-in">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-2 text-white">
                <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                <span>Generating {downloadingFormat.toUpperCase()}...</span>
              </span>
              <span className="text-emerald-400 tabular-nums font-mono">{progress.percent}%</span>
            </div>

            {/* Progress track */}
            <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/10">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-200"
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

        {/* Format Selection Cards (Clean, Cohesive Cinema-Dark Theme) */}
        <div className="space-y-3">
          {/* Option 1: PDF Format */}
          <div className="rounded-2xl border border-white/10 bg-[#181822] hover:border-white/20 p-4 transition-all duration-200 group shadow-md">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-white shrink-0">
                  <FileText className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    PDF Document (.pdf)
                  </h4>
                  <span className="text-[11px] font-medium text-gray-400">
                    Universal Reader • Books, Acrobat, Kindle
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-normal my-3">
              High-resolution multi-page PDF formatted to each page&apos;s exact dimensions. Works on Adobe Acrobat, Apple Books, Google Drive, Kindle, and all PDF apps.
            </p>

            <button
              onClick={() => startDownload('pdf')}
              disabled={!!downloadingFormat}
              className={`w-full py-2.5 px-4 rounded-full font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer ${
                downloadingFormat === 'pdf'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-wait'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-500/20'
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
          <div className="rounded-2xl border border-white/10 bg-[#181822] hover:border-white/20 p-4 transition-all duration-200 group shadow-md">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-white shrink-0">
                  <BookOpen className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    Comic Book ZIP (.cbz)
                  </h4>
                  <span className="text-[11px] font-medium text-gray-400">
                    Standard Comic Archive • Tachiyomi, Mihon, CDisplayEx
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-normal my-3">
              Standard comic archive with sequentially named pages and embedded <code className="text-[10px] text-gray-400 font-mono">ComicInfo.xml</code> metadata. Perfect for dedicated comic and manga readers on mobile or desktop.
            </p>

            <button
              onClick={() => startDownload('cbz')}
              disabled={!!downloadingFormat}
              className={`w-full py-2.5 px-4 rounded-full font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer ${
                downloadingFormat === 'cbz'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-wait'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-500/20'
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
        <div className="mt-5 pt-3.5 border-t border-white/10 flex items-center justify-between">
          <span className="text-[11px] text-gray-400">
            {isPdf ? 'Source: Direct PDF' : `Source: ${pageCount} High-Res Images`}
          </span>
          <button
            onClick={() => {
              if (!downloadingFormat) onClose();
            }}
            disabled={!!downloadingFormat}
            className={`px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-xs font-semibold text-gray-300 hover:text-white transition-colors cursor-pointer ${
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
