import React from 'react';
import { Sparkles, Film, Heart, ExternalLink } from 'lucide-react';
import { Logo } from './Logo';

interface FooterProps {
  onNavigate: (route: string) => void;
}

interface FooterLink {
  label: string;
  route?: string;
  href?: string;
  isExternal?: boolean;
}

interface FooterColumn {
  heading: string;
  links: FooterLink[];
}

const FOOTER_COLUMNS: FooterColumn[] = [
  {
    heading: 'Browse',
    links: [
      { label: 'Discover & Trending', route: '#/' },
      { label: 'Latest Chapters', route: '#/latest' },
      { label: 'Top Manga & Manhwa', route: '#/browse/comics' },
      { label: 'Light Novels', route: '#/browse/novels' },
      { label: 'My Reading Library', route: '#/library' },
    ],
  },
  {
    heading: 'Voidflix Network',
    links: [
      { label: 'voidflix.org (Movies & TV)', href: 'https://voidflix.org', isExternal: true },
      { label: 'hentai.voidflix.org (18+ Anime)', href: 'https://hentai.voidflix.org', isExternal: true },
      { label: 'manga.voidflix.org (Manga & Novels)', route: '#/' },
      { label: 'Action & Martial Arts', route: '#/browse/comics' },
      { label: 'Fantasy & Isekai Series', route: '#/browse/comics' },
    ],
  },
  {
    heading: 'Reader Features',
    links: [
      { label: 'Instant Downloads (CBZ & PDF)', route: '#/' },
      { label: 'Clean Translation Deduplication', route: '#/' },
      { label: 'Zero Ads & Distraction-Free', route: '#/' },
      { label: 'Automatic Progress Tracking', route: '#/library' },
      { label: 'PWA Offline Installation', route: '#/' },
    ],
  },
  {
    heading: 'Platform & Legal',
    links: [
      { label: 'Terms of Use', route: '#/' },
      { label: 'Privacy Policy', route: '#/' },
      { label: 'DMCA Disclaimer', route: '#/' },
      { label: 'Atsu.moe Catalog Attribution', route: '#/' },
      { label: 'Cloudflare Edge Accelerated', route: '#/' },
    ],
  },
];

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="border-t border-white/10 bg-[#070709]/95 mt-16 px-4 sm:px-8 py-12 text-sm text-gray-400 select-none">
      <div className="max-w-7xl mx-auto">
        {/* Brand & Network Row */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-8 mb-8 border-b border-white/[0.08]">
          <div onClick={() => onNavigate('#/')} className="cursor-pointer">
            <Logo size="md" />
          </div>

          {/* Quick Network Navigation Pills */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs text-gray-400 font-semibold mr-1">Voidflix Network:</span>
            <a
              href="https://voidflix.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-emerald-500/15 hover:border-emerald-500/40 border border-white/10 text-xs font-semibold text-gray-300 hover:text-emerald-300 transition-all cursor-pointer"
            >
              <Film className="w-3.5 h-3.5 text-emerald-400" />
              <span>voidflix.org</span>
              <ExternalLink className="w-3 h-3 text-gray-400" />
            </a>
            <a
              href="https://hentai.voidflix.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-emerald-500/15 hover:border-emerald-500/40 border border-white/10 text-xs font-semibold text-gray-300 hover:text-emerald-300 transition-all cursor-pointer"
            >
              <Heart className="w-3.5 h-3.5 text-emerald-400" />
              <span>hentai.voidflix.org</span>
              <ExternalLink className="w-3 h-3 text-gray-400" />
            </a>
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <Sparkles className="w-3.5 h-3.5" /> High-Speed AVIF & WebP
            </span>
            <span>•</span>
            <span>Zero Ads</span>
            <span>•</span>
            <span>100% Free</span>
          </div>
        </div>

        {/* 4 Navigation Columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.heading}>
              <h3 className="text-white font-bold text-xs uppercase tracking-wider mb-3.5 text-gray-200">
                {col.heading}
              </h3>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.isExternal && link.href ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-emerald-400 transition text-xs inline-flex items-center gap-1.5 group/link"
                      >
                        <span>{link.label}</span>
                        <ExternalLink className="w-3 h-3 opacity-60 group-hover/link:opacity-100 transition-opacity" />
                      </a>
                    ) : (
                      <button
                        onClick={() => link.route && onNavigate(link.route)}
                        className="text-gray-400 hover:text-emerald-400 transition text-xs text-left cursor-pointer"
                      >
                        {link.label}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Disclaimer Note */}
        <div className="pt-6 border-t border-white/[0.06] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-gray-400">
          <p className="max-w-2xl leading-relaxed">
            Voidflix Manga is a modern, high-performance reader web application designed for fast, seamless reading of manga, manhwa, manhua, and light novels. All media content and metadata are indexed from publicly available community sources.
          </p>
          <p className="shrink-0 text-gray-400">
            © {new Date().getFullYear()} Voidflix Manga. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
