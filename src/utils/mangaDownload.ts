import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { Chapter, Page } from '../types/atsu';
import { api } from '../services/api';

// Initialize PDF.js worker
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

export type DownloadFormat = 'pdf' | 'cbz';

export interface DownloadProgress {
  current: number;
  total: number;
  percent: number;
  message: string;
}

// Concurrency pool size: 5 workers balances speed with mobile memory safety
const DOWNLOAD_CONCURRENCY = 5;

/**
 * Concurrency runner: executes tasks with up to `concurrency` parallel workers
 * while preserving original index order in the returned results array.
 */
async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  taskFn: (item: T, index: number) => Promise<R>,
  onTaskDone?: (completedCount: number, total: number) => void
): Promise<R[]> {
  const total = items.length;
  if (total === 0) return [];

  const results: R[] = new Array(total);
  let currentIndex = 0;
  let completed = 0;

  const workerCount = Math.min(concurrency, total);
  const workers = Array.from({ length: workerCount }, async () => {
    while (currentIndex < total) {
      const idx = currentIndex++;
      try {
        results[idx] = await taskFn(items[idx], idx);
      } catch (err) {
        console.warn(`Task at index ${idx} failed:`, err);
        throw err;
      }
      completed++;
      onTaskDone?.(completed, total);
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * Checks whether the chapter is originally a PDF document or an image-based comic.
 */
export function isPdfSource(pages: Page[], chapter?: Chapter | null): boolean {
  if ((chapter as any)?.pdfUrl || (chapter as any)?.isPdf || (chapter as any)?.file?.endsWith('.pdf')) {
    return true;
  }
  if (pages.length === 1 && pages[0]?.image?.toLowerCase().includes('.pdf')) {
    return true;
  }
  return false;
}

/**
 * Returns the direct PDF URL if the chapter is a PDF comic.
 */
export function getPdfSourceUrl(pages: Page[], chapter?: Chapter | null): string | null {
  if ((chapter as any)?.pdfUrl) return api.getImageUrl((chapter as any).pdfUrl);
  if ((chapter as any)?.file?.endsWith('.pdf')) return api.getImageUrl((chapter as any).file);
  if (pages.length === 1 && pages[0]?.image?.toLowerCase().includes('.pdf')) {
    return api.getImageUrl(pages[0].image);
  }
  return null;
}

/**
 * Creates a clean placeholder fallback page so that decoding issues never hang the PDF.
 */
function createFallbackPage(pageNumber: number): {
  width: number;
  height: number;
  dataUrl: string;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 1400;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#0f0f14';
    ctx.fillRect(0, 0, 1000, 1400);
    ctx.fillStyle = '#888888';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Page ${pageNumber}`, 500, 700);
  }
  return {
    width: 1000,
    height: 1400,
    dataUrl: canvas.toDataURL('image/jpeg', 0.8)
  };
}

/**
 * Decodes an image blob into dimensions and a standardized JPEG DataURL.
 * Uses hardware-accelerated createImageBitmap with strict timeouts to ensure it NEVER hangs.
 */
async function decodeImageToDataUrl(rawBlob: Blob, pageNum: number): Promise<{
  width: number;
  height: number;
  dataUrl: string;
}> {
  // 1. Fast path: Hardware-accelerated createImageBitmap with 6s timeout
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await Promise.race([
        createImageBitmap(rawBlob),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('createImageBitmap timeout')), 6000))
      ]);
      const width = bmp.width || 1200;
      const height = bmp.height || 1800;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (ctx) {
        ctx.drawImage(bmp, 0, 0);
        bmp.close();
        const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
        return { width, height, dataUrl };
      }
    } catch {
      // Fall through to Image element
    }
  }

  // 2. Fallback: standard HTMLImageElement with strict 8s timeout
  const blobUrl = URL.createObjectURL(rawBlob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Image decode timeout for page ${pageNum}`));
      }, 8000);

      const image = new Image();
      image.onload = () => {
        clearTimeout(timer);
        resolve(image);
      };
      image.onerror = () => {
        clearTimeout(timer);
        reject(new Error(`Image decode error for page ${pageNum}`));
      };
      image.src = blobUrl;
    });

    const width = img.naturalWidth || img.width || 1200;
    const height = img.naturalHeight || img.height || 1800;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not get canvas context');

    ctx.drawImage(img, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
    return { width, height, dataUrl };
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * Fetches and decodes a single page for PDF with auto-retry and fallback so it never hangs.
 */
async function fetchPageForPdfWithFallback(pageUrl: string, pageNum: number): Promise<{
  width: number;
  height: number;
  dataUrl: string;
}> {
  try {
    const res = await fetch(pageUrl, { cache: 'force-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rawBlob = await res.blob();
    return await decodeImageToDataUrl(rawBlob, pageNum);
  } catch (err) {
    console.warn(`Initial fetch/decode failed for page ${pageNum}, retrying...`, err);
    try {
      const retryUrl = pageUrl + (pageUrl.includes('?') ? '&' : '?') + 'r=' + Date.now();
      const res = await fetch(retryUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rawBlob = await res.blob();
      return await decodeImageToDataUrl(rawBlob, pageNum);
    } catch {
      return createFallbackPage(pageNum);
    }
  }
}

/**
 * Ultra-fast page fetcher for CBZ:
 * Directly keeps JPEG, PNG, and WebP blobs without canvas re-encoding.
 */
async function fetchPageForCbz(pageUrl: string, pageNum: number): Promise<{
  filename: string;
  blob: Blob;
}> {
  try {
    const res = await fetch(pageUrl, { cache: 'force-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rawBlob = await res.blob();

    const type = rawBlob.type.toLowerCase();
    const pad = String(pageNum).padStart(3, '0');

    // Fast path: If already standard JPEG, PNG, or WebP, use raw bytes directly
    if (type.includes('jpeg') || type.includes('jpg')) {
      return { filename: `${pad}.jpg`, blob: rawBlob };
    }
    if (type.includes('png')) {
      return { filename: `${pad}.png`, blob: rawBlob };
    }
    if (type.includes('webp')) {
      return { filename: `${pad}.webp`, blob: rawBlob };
    }

    // If AVIF, transcode to JPEG
    try {
      const decoded = await decodeImageToDataUrl(rawBlob, pageNum);
      const canvas = document.createElement('canvas');
      canvas.width = decoded.width;
      canvas.height = decoded.height;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (ctx) {
        const jpegBlob = await new Promise<Blob>((resolve) => {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0);
            canvas.toBlob((b) => resolve(b || rawBlob), 'image/jpeg', 0.88);
          };
          img.onerror = () => resolve(rawBlob);
          img.src = decoded.dataUrl;
        });
        return { filename: `${pad}.jpg`, blob: jpegBlob };
      }
      return { filename: `${pad}.jpg`, blob: rawBlob };
    } catch {
      return { filename: `${pad}.jpg`, blob: rawBlob };
    }
  } catch {
    // Retry once
    const retryUrl = pageUrl + (pageUrl.includes('?') ? '&' : '?') + 'r=' + Date.now();
    const res = await fetch(retryUrl);
    const rawBlob = await res.blob();
    const pad = String(pageNum).padStart(3, '0');
    return { filename: `${pad}.jpg`, blob: rawBlob };
  }
}

/**
 * Generates ComicInfo.xml metadata for CBZ comic readers (Tachiyomi, Mihon, Panels, CDisplayEx).
 */
function createComicInfoXml(meta: {
  title?: string;
  series?: string;
  chapterNumber?: number;
  pageCount?: number;
}): string {
  const safeTitle = (meta.title || '').replace(/[<>&'"]/g, '');
  const safeSeries = (meta.series || '').replace(/[<>&'"]/g, '');
  const num = meta.chapterNumber ?? 1;
  const count = meta.pageCount ?? 1;

  return `<?xml version="1.0" encoding="utf-8"?>
<ComicInfo xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <Title>${safeTitle}</Title>
  <Series>${safeSeries}</Series>
  <Number>${num}</Number>
  <PageCount>${count}</PageCount>
  <Format>Digital Chapter</Format>
  <CommunityRating>5.0</CommunityRating>
</ComicInfo>`;
}

/**
 * High-Speed Parallel PDF Download:
 * 1. Parallel downloads pages without canvas/memory overload.
 * 2. Progressively builds jsPDF page-by-page while yielding to the UI.
 * 3. Disables CPU-heavy deflate compression (compress: false) so blob generation is instant.
 */
export async function downloadImageComicAsPdf(
  pages: Page[],
  filename: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<void> {
  const total = pages.length;
  if (total === 0) throw new Error('No comic pages found to download');

  // Step 1: Parallel fetch and decode of all pages (70% progress)
  const pageUrls = pages.map((p) => api.getImageUrl(p.image));

  const pagesData = await mapConcurrent(
    pageUrls,
    DOWNLOAD_CONCURRENCY,
    async (url, idx) => fetchPageForPdfWithFallback(url, idx + 1),
    (done) => {
      const percent = Math.round((done / total) * 70);
      onProgress?.({
        current: done,
        total,
        percent,
        message: `Downloading & decoding pages (${done}/${total})...`
      });
    }
  );

  // Step 2: Progressive assembly into jsPDF with UI yielding & memory release
  let pdfDoc: jsPDF | null = null;

  for (let i = 0; i < total; i++) {
    const pageNum = i + 1;
    const percent = 70 + Math.round((pageNum / total) * 24); // 70% to 94%
    onProgress?.({
      current: pageNum,
      total,
      percent,
      message: `Assembling PDF page ${pageNum} of ${total}...`
    });

    // Yield execution so React paints the progress bar and avoids freezing UI
    await new Promise((r) => setTimeout(r, 15));

    const pageData = pagesData[i];
    const ptWidth = Math.max(100, pageData.width * 0.75);
    const ptHeight = Math.max(100, pageData.height * 0.75);
    const orientation = ptWidth > ptHeight ? 'landscape' : 'portrait';

    if (i === 0) {
      pdfDoc = new jsPDF({
        orientation,
        unit: 'pt',
        format: [ptWidth, ptHeight],
        compress: false // CRITICAL: false prevents synchronous deflate hang during output('blob')
      });
      pdfDoc.addImage(pageData.dataUrl, 'JPEG', 0, 0, ptWidth, ptHeight, undefined, 'FAST');
    } else {
      pdfDoc!.addPage([ptWidth, ptHeight], orientation);
      pdfDoc!.addImage(pageData.dataUrl, 'JPEG', 0, 0, ptWidth, ptHeight, undefined, 'FAST');
    }

    // Release base64 dataUrl from memory immediately
    pageData.dataUrl = '';
  }

  onProgress?.({
    current: total,
    total,
    percent: 96,
    message: 'Finalizing PDF file...'
  });

  await new Promise((r) => setTimeout(r, 20));

  const pdfBlob = pdfDoc!.output('blob');

  onProgress?.({
    current: total,
    total,
    percent: 99,
    message: 'Saving PDF to device...'
  });

  triggerBrowserDownload(pdfBlob, filename.endsWith('.pdf') ? filename : `${filename}.pdf`);

  onProgress?.({
    current: total,
    total,
    percent: 100,
    message: 'PDF Download Complete!'
  });
}

/**
 * Ultra-Fast Parallel CBZ Download:
 * 1. Downloads pages in parallel.
 * 2. Uses original compressed image bytes directly.
 * 3. Uses ZIP 'STORE' compression (finishes in ~100ms).
 */
export async function downloadImageComicAsCbz(
  pages: Page[],
  filename: string,
  metadata: { seriesTitle: string; chapterTitle: string; chapterNumber: number },
  onProgress?: (progress: DownloadProgress) => void
): Promise<void> {
  const total = pages.length;
  if (total === 0) throw new Error('No comic pages found to download');

  const zip = new JSZip();

  // Add ComicInfo.xml metadata
  const comicInfo = createComicInfoXml({
    series: metadata.seriesTitle,
    title: metadata.chapterTitle,
    chapterNumber: metadata.chapterNumber,
    pageCount: total
  });
  zip.file('ComicInfo.xml', comicInfo);

  // 1. Parallel fetch of all page images
  const pageUrls = pages.map((p) => api.getImageUrl(p.image));

  const cbzFiles = await mapConcurrent(
    pageUrls,
    DOWNLOAD_CONCURRENCY,
    async (url, idx) => fetchPageForCbz(url, idx + 1),
    (done) => {
      const percent = Math.round((done / total) * 90);
      onProgress?.({
        current: done,
        total,
        percent,
        message: `Downloading pages in parallel (${done}/${total})...`
      });
    }
  );

  // 2. Add files to zip
  for (const f of cbzFiles) {
    zip.file(f.filename, f.blob);
  }

  onProgress?.({
    current: total,
    total,
    percent: 95,
    message: 'Packaging Comic Book ZIP (.cbz)...'
  });

  // 3. Fast STORE packaging (instantaneous)
  const cbzBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  triggerBrowserDownload(cbzBlob, filename.endsWith('.cbz') ? filename : `${filename}.cbz`);

  onProgress?.({
    current: total,
    total,
    percent: 100,
    message: 'CBZ Download Complete!'
  });
}

/**
 * Downloads a PDF Comic directly as a .pdf file.
 */
export async function downloadPdfComicAsPdf(
  pdfUrl: string,
  filename: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<void> {
  onProgress?.({
    current: 1,
    total: 1,
    percent: 30,
    message: 'Fetching PDF document from cloud...'
  });

  const res = await fetch(pdfUrl);
  if (!res.ok) throw new Error(`Failed to fetch PDF: HTTP ${res.status}`);

  const blob = await res.blob();

  onProgress?.({
    current: 1,
    total: 1,
    percent: 90,
    message: 'Saving PDF file...'
  });

  triggerBrowserDownload(blob, filename.endsWith('.pdf') ? filename : `${filename}.pdf`);

  onProgress?.({
    current: 1,
    total: 1,
    percent: 100,
    message: 'PDF Download Complete!'
  });
}

/**
 * Converts a PDF Comic into a Comic Book ZIP (.cbz) with parallel rendering & fast STORE compression.
 */
export async function downloadPdfComicAsCbz(
  pdfUrl: string,
  filename: string,
  metadata: { seriesTitle: string; chapterTitle: string; chapterNumber: number },
  onProgress?: (progress: DownloadProgress) => void
): Promise<void> {
  onProgress?.({
    current: 1,
    total: 1,
    percent: 10,
    message: 'Loading PDF document...'
  });

  const res = await fetch(pdfUrl);
  if (!res.ok) throw new Error(`Failed to fetch PDF: HTTP ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();

  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  const zip = new JSZip();

  // Add ComicInfo.xml metadata
  const comicInfo = createComicInfoXml({
    series: metadata.seriesTitle,
    title: metadata.chapterTitle,
    chapterNumber: metadata.chapterNumber,
    pageCount: numPages
  });
  zip.file('ComicInfo.xml', comicInfo);

  const pageNumbers = Array.from({ length: numPages }, (_, i) => i + 1);

  // Render PDF pages with concurrency of 3
  const renderedPages = await mapConcurrent(
    pageNumbers,
    3,
    async (pageIndex) => {
      const page = await pdf.getPage(pageIndex);
      const viewport = page.getViewport({ scale: 2.0 });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('Canvas 2D context not available');

      await (page.render({ canvasContext: ctx, viewport, canvas } as any)).promise;

      const pageBlob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.86);
      });

      const pageIndexStr = String(pageIndex).padStart(3, '0');
      return { filename: `${pageIndexStr}.jpg`, blob: pageBlob };
    },
    (done) => {
      const percent = 10 + Math.round((done / numPages) * 80);
      onProgress?.({
        current: done,
        total: numPages,
        percent,
        message: `Rendering PDF pages (${done}/${numPages})...`
      });
    }
  );

  for (const page of renderedPages) {
    zip.file(page.filename, page.blob);
  }

  onProgress?.({
    current: numPages,
    total: numPages,
    percent: 95,
    message: 'Packaging Comic Book ZIP (.cbz)...'
  });

  const cbzBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  triggerBrowserDownload(cbzBlob, filename.endsWith('.cbz') ? filename : `${filename}.cbz`);

  onProgress?.({
    current: numPages,
    total: numPages,
    percent: 100,
    message: 'CBZ Download Complete!'
  });
}

/**
 * Universal Master Download Handler for MangaReader.
 * Automatically inspects the chapter, detects if it's a PDF comic or an Image comic,
 * and compiles the requested format (PDF or CBZ).
 */
export async function downloadChapterComic(params: {
  pages: Page[];
  chapter?: Chapter | null;
  seriesTitle: string;
  chapterTitle: string;
  chapterNumber: number;
  format: DownloadFormat;
  onProgress?: (progress: DownloadProgress) => void;
}): Promise<void> {
  const { pages, chapter, seriesTitle, chapterTitle, chapterNumber, format, onProgress } = params;

  const isPdf = isPdfSource(pages, chapter);
  const pdfUrl = getPdfSourceUrl(pages, chapter);

  const safeSeries = (seriesTitle || 'Manga').replace(/[/\\?%*:|"<>]/g, '_').trim();
  const safeChapter = (chapterTitle || `Chapter ${chapterNumber}`).replace(/[/\\?%*:|"<>]/g, '_').trim();
  const baseFilename = `${safeSeries} - ${safeChapter}`;

  if (isPdf && pdfUrl) {
    if (format === 'pdf') {
      await downloadPdfComicAsPdf(pdfUrl, `${baseFilename}.pdf`, onProgress);
    } else {
      await downloadPdfComicAsCbz(
        pdfUrl,
        `${baseFilename}.cbz`,
        { seriesTitle, chapterTitle, chapterNumber },
        onProgress
      );
    }
  } else {
    if (format === 'pdf') {
      await downloadImageComicAsPdf(pages, `${baseFilename}.pdf`, onProgress);
    } else {
      await downloadImageComicAsCbz(
        pages,
        `${baseFilename}.cbz`,
        { seriesTitle, chapterTitle, chapterNumber },
        onProgress
      );
    }
  }
}

/**
 * Triggers a real browser file download using a temporary Object URL.
 */
export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename.replace(/[/\\?%*:|"<>]/g, '_').trim();
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 25000);
}
