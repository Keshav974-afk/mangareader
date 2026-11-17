import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showBadge?: boolean;
  showIcon?: boolean;
  iconOnly?: boolean;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showBadge = true,
  showIcon = true,
  iconOnly = false,
  className = ''
}) => {
  // Dimensions for icon and typography based on size
  const sizeMap = {
    sm: {
      pixel: 22,
      iconClass: 'w-[22px] h-[22px]',
      text: 'text-lg',
      badge: 'text-[9px] px-1.5 py-0.5',
      gap: 'gap-1.5',
    },
    md: {
      pixel: 28,
      iconClass: 'w-7 h-7 sm:w-[30px] sm:h-[30px]',
      text: 'text-xl sm:text-2xl',
      badge: 'text-[9px] sm:text-[10px] px-2 py-0.5',
      gap: 'gap-2 sm:gap-2.5',
    },
    lg: {
      pixel: 36,
      iconClass: 'w-9 h-9',
      text: 'text-2xl sm:text-3xl',
      badge: 'text-xs px-2.5 py-0.5',
      gap: 'gap-3',
    },
    xl: {
      pixel: 48,
      iconClass: 'w-12 h-12',
      text: 'text-4xl sm:text-5xl',
      badge: 'text-sm px-3 py-1',
      gap: 'gap-4',
    }
  };

  const current = sizeMap[size];

  return (
    <div className={`inline-flex items-center ${current.gap} select-none group ${className}`}>
      {/* Precision Geometric Voidflix Manga Emblem */}
      {showIcon && (
        <div
          className={`relative ${current.iconClass} shrink-0 transition-transform duration-200 group-hover:scale-105 active:scale-95`}
          style={{ width: `${current.pixel}px`, height: `${current.pixel}px`, minWidth: `${current.pixel}px`, minHeight: `${current.pixel}px` }}
        >
          {/* Ambient Emerald Aura */}
          <div className="absolute inset-0 bg-emerald-500/25 rounded-lg blur-xs opacity-70 group-hover:opacity-100 transition-opacity" />

          {/* Vector SVG Icon */}
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full block relative z-10 drop-shadow-[0_2px_8px_rgba(16,185,129,0.35)]"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ width: '100%', height: '100%' }}
          >
            <defs>
              {/* Background Squircle Gradient */}
              <linearGradient id="vf-bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#141620" />
                <stop offset="100%" stopColor="#08080d" />
              </linearGradient>

              {/* Left Page Wing Gradient */}
              <linearGradient id="vf-wing-left" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#059669" />
                <stop offset="100%" stopColor="#047857" />
              </linearGradient>

              {/* Right Page Wing Gradient (Luminous & Foreground) */}
              <linearGradient id="vf-wing-right" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="50%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>

              {/* Page Fold Accent Gradient */}
              <linearGradient id="vf-fold-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#a7f3d0" />
                <stop offset="100%" stopColor="#ffffff" />
              </linearGradient>

              {/* Center Core Flare */}
              <radialGradient id="vf-core-flare" cx="50%" cy="40%" r="50%">
                <stop offset="0%" stopColor="#34d399" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </radialGradient>

              {/* Bevel Stroke Gradient */}
              <linearGradient id="vf-rim-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
                <stop offset="50%" stopColor="rgba(16,185,129,0.5)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.08)" />
              </linearGradient>
            </defs>

            {/* Squircle Base with Cinema Glass Border */}
            <rect
              x="3"
              y="3"
              width="94"
              height="94"
              rx="24"
              fill="url(#vf-bg-grad)"
              stroke="url(#vf-rim-grad)"
              strokeWidth="2.5"
            />

            {/* Central Radial Energy Glow */}
            <circle cx="50" cy="50" r="30" fill="url(#vf-core-flare)" />

            {/* Left Wing (Deep Layered Manga Page) */}
            <path
              d="M 22 24 L 38 24 L 50 68 L 36 68 Z"
              fill="url(#vf-wing-left)"
            />

            {/* Right Wing (Foreground Overlapping Manga Blade with Razor Apex) */}
            <path
              d="M 64 24 L 78 24 L 50 82 L 36 68 L 50 68 Z"
              fill="url(#vf-wing-right)"
            />

            {/* Top-Right Manga Page Dog-Ear Fold */}
            <path
              d="M 64 24 L 78 24 L 78 38 Z"
              fill="url(#vf-fold-grad)"
              opacity="0.95"
            />

            {/* Speedline Sparks / Dynamic Manga Slash Insets */}
            <path
              d="M 28 32 L 34 32 L 46 64 L 41 64 Z"
              fill="#ffffff"
              opacity="0.25"
            />
            <path
              d="M 68 34 L 62 34 L 52 64 L 56 64 Z"
              fill="#ffffff"
              opacity="0.3"
            />

            {/* Glowing Center Portal Core Diamond */}
            <polygon
              points="50,38 54,46 50,54 46,46"
              fill="#a7f3d0"
            />
          </svg>
        </div>
      )}

      {/* Typography & Badge */}
      {!iconOnly && (
        <div className="flex items-center gap-1.5 sm:gap-2 tracking-tight">
          <div className={`font-display font-black ${current.text} tracking-wider leading-none flex items-center`}>
            <span className="text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">VOID</span>
            <span className="text-emerald-400 drop-shadow-[0_0_12px_rgba(16,185,129,0.4)]">FLIX</span>
          </div>

          {showBadge && (
            <span
              className={`font-black uppercase tracking-widest rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 backdrop-blur-md shadow-xs ${current.badge} leading-tight self-center`}
            >
              MANGA
            </span>
          )}
        </div>
      )}
    </div>
  );
};
