import React from 'react';
import { Sparkles, BookOpen, Compass, Flame, Shield, Heart } from 'lucide-react';
import { Logo } from './Logo';

interface FooterProps {
  onNavigate: (route: string) => void;
}

const FOOTER_COLUMNS = [
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
    heading: 'Categories',
    links: [
      { label: 'Action & Adventure', route: '#/browse/comics' },
      { label: 'Romance & Drama', route: '#/browse/comics' },
      { label: 'Fantasy & Isekai', route: '#/browse/comics' },
      { label: 'Cultivation Web Novels', route: '#/browse/novels' },
      { label: 'All-Time Hall of Fame', route: '#/' },
    ],
  },
  {
    heading: 'Features',
    links: [
      { label: 'Instant Chapter Downloads (CBZ & PDF)', route: '#/' },
      { label: 'Smart Translation Deduplication', route: '#/' },
      { label: 'Zero Ads & Distraction-Free Reader', route: '#/' },
      { label: 'Progress Synchronization', route: '#/library' },
      { label: 'Install PWA Mobile App', route: '#/' },
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
    <footer className="border-t border-white/10 bg-[#070709]/90 mt-16 px-4 sm:px-8 py-12 text-sm text-gray-400 select-none">
      <div className="max-w-7xl mx-auto">
        {/* Brand Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-8 mb-8 border-b border-white/[0.08]">
          <div onClick={() => onNavigate('#/')} className="cursor-pointer">
            <Logo size="md" />
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
                    <button
                      onClick={() => onNavigate(link.route)}
                      className="text-gray-400 hover:text-emerald-400 transition text-xs text-left"
                    >
                      {link.label}
                    </button>
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
