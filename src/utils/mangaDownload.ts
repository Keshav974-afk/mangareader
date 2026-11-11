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
 * Loads an image from a URL, decodes it via HTML5 Canvas,
 * and produces clean, standardized JPEG data & dimensions.
 * Handles AVIF, WebP, PNG, and JPEG seamlessly without CORS tainting.
 */
async function loadImageAsCanvas(url: string): Promise<{
  width: number;
  height: number;
  dataUrl: string;
  blob: Blob;
}> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load page image (HTTP ${res.status})`);
  }
  const rawBlob = await res.blob();
  const blobUrl = URL.createObjectURL(rawBlob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Failed to decode image'));
      image.src = blobUrl;
    });

    const width = img.naturalWidth || img.width || 1200;
    const height = img.naturalHeight || img.height || 1800;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    // Draw image to standardize colors and formats
    ctx.drawImage(img, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const jpegBlob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b || rawBlob), 'image/jpeg', 0.92);
    });

    return { width, height, dataUrl, blob: jpegBlob };
  } finally {
    URL.revokeObjectURL(blobUrl);
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
 * Downloads an Image Comic as a compiled multi-page PDF.
 */
export async function downloadImageComicAsPdf(
  pages: Page[],
  filename: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<void> {
  const total = pages.length;
  if (total === 0) throw new Error('No comic pages found to download');

  let pdfDoc: jsPDF | null = null;

  for (let i = 0; i < total; i++) {
    const pageNum = i + 1;
    const percent = Math.round((i / total) * 90);
    onProgress?.({
      current: pageNum,
      total,
      percent,
      message: `Processing page ${pageNum} of ${total}...`
    });

    const pageUrl = api.getImageUrl(pages[i].image);
    const pageData = await loadImageAsCanvas(pageUrl);

    // Convert pixels to PDF points (1 px = 0.75 pt)
    const ptWidth = pageData.width * 0.75;
    const ptHeight = pageData.height * 0.75;
    const orientation = ptWidth > ptHeight ? 'landscape' : 'portrait';

    if (i === 0) {
      pdfDoc = new jsPDF({
        orientation,
        unit: 'pt',
        format: [ptWidth, ptHeight]
      });
      pdfDoc.addImage(pageData.dataUrl, 'JPEG', 0, 0, ptWidth, ptHeight, undefined, 'FAST');
    } else {
      pdfDoc!.addPage([ptWidth, ptHeight], orientation);
      pdfDoc!.addImage(pageData.dataUrl, 'JPEG', 0, 0, ptWidth, ptHeight, undefined, 'FAST');
    }
  }

  onProgress?.({
    current: total,
    total,
    percent: 95,
    message: 'Compiling PDF document...'
  });

  const pdfBlob = pdfDoc!.output('blob');
  triggerBrowserDownload(pdfBlob, filename.endsWith('.pdf') ? filename : `${filename}.pdf`);

  onProgress?.({
    current: total,
    total,
    percent: 100,
    message: 'PDF Download Complete!'
  });
}

/**
 * Downloads an Image Comic as a standard Comic Book ZIP (.cbz) archive.
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

  for (let i = 0; i < total; i++) {
    const pageNum = i + 1;
    const percent = Math.round((i / total) * 80);
    onProgress?.({
      current: pageNum,
      total,
      percent,
      message: `Archiving page ${pageNum} of ${total}...`
    });

    const pageUrl = api.getImageUrl(pages[i].image);
    const pageData = await loadImageAsCanvas(pageUrl);
    const pageIndexStr = String(pageNum).padStart(3, '0');
    zip.file(`${pageIndexStr}.jpg`, pageData.blob);
  }

  onProgress?.({
    current: total,
    total,
    percent: 85,
    message: 'Compressing Comic Book ZIP (.cbz)...'
  });

  const cbzBlob = await zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    (meta) => {
      const p = 85 + Math.round((meta.percent / 100) * 14);
      onProgress?.({
        current: total,
        total,
        percent: Math.min(99, p),
        message: `Packaging CBZ: ${Math.round(meta.percent)}%`
      });
    }
  );

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
 * Converts a PDF Comic into a Comic Book ZIP (.cbz) by rendering each PDF page into JPEG.
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

  for (let i = 1; i <= numPages; i++) {
    const percent = 10 + Math.round((i / numPages) * 75);
    onProgress?.({
      current: i,
      total: numPages,
      percent,
      message: `Rendering PDF page ${i} of ${numPages} to high-res image...`
    });

    const page = await pdf.getPage(i);
    // Render at 2x scale for crystal-sharp reading resolution
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not available');

    await (page.render({ canvasContext: ctx, viewport, canvas } as any)).promise;

    const pageBlob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.92);
    });

    const pageIndexStr = String(i).padStart(3, '0');
    zip.file(`${pageIndexStr}.jpg`, pageBlob);
  }

  onProgress?.({
    current: numPages,
    total: numPages,
    percent: 88,
    message: 'Packaging Comic Book ZIP (.cbz)...'
  });

  const cbzBlob = await zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    (meta) => {
      const p = 88 + Math.round((meta.percent / 100) * 11);
      onProgress?.({
        current: numPages,
        total: numPages,
        percent: Math.min(99, p),
        message: `Compressing CBZ: ${Math.round(meta.percent)}%`
      });
    }
  );

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
