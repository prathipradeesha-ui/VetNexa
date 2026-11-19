import './logo.css';

interface LogoMarkProps {
  size?: number;
  /** "reversed" draws a white tile for use on teal or navy backgrounds. */
  variant?: 'default' | 'reversed';
  className?: string;
}

/**
 * The VetNexa mark: a paw print with a medical cross in the main pad.
 * Drawn inline (not as an <img>) so it stays sharp at any size and the wordmark
 * next to it can use the site's own font.
 */
export function LogoMark({ size = 36, variant = 'default', className }: LogoMarkProps) {
  const tile = variant === 'reversed' ? '#FFFFFF' : '#0A6C6C';
  const paw = variant === 'reversed' ? '#0A6C6C' : '#FFFFFF';
  const dot = variant === 'reversed' ? '#4FB3AE' : '#7FD6C2';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <rect width="64" height="64" rx="16" fill={tile} />
      <circle cx="52.5" cy="11.5" r="3.2" fill={dot} />
      <g fill={paw}>
        <ellipse cx="17.5" cy="27" rx="4.3" ry="5.4" transform="rotate(-28 17.5 27)" />
        <ellipse cx="26" cy="18.5" rx="4.5" ry="5.9" transform="rotate(-9 26 18.5)" />
        <ellipse cx="38" cy="18.5" rx="4.5" ry="5.9" transform="rotate(9 38 18.5)" />
        <ellipse cx="46.5" cy="27" rx="4.3" ry="5.4" transform="rotate(28 46.5 27)" />
        <path d="M32 29c6 0 13.5 7 13.5 14 0 6-5 9.2-9.6 8.1-1.7-.4-2.8-.9-3.9-.9s-2.2.5-3.9.9c-4.6 1.1-9.6-2.1-9.6-8.1C18.5 36 26 29 32 29z" />
      </g>
      <g fill={tile}>
        <rect x="30" y="35" width="4" height="12.5" rx="1.2" />
        <rect x="25.75" y="39.25" width="12.5" height="4" rx="1.2" />
      </g>
    </svg>
  );
}

interface LogoProps {
  variant?: 'default' | 'reversed';
  size?: 'md' | 'lg';
}

/** Full horizontal logo: mark + "VetNexa" wordmark. */
export function Logo({ variant = 'default', size = 'md' }: LogoProps) {
  return (
    <span className={`logo logo--${variant} logo--${size}`}>
      <LogoMark size={size === 'lg' ? 48 : 36} variant={variant} />
      <span className="logo__word">
        Vet<span className="logo__accent">Nexa</span>
      </span>
    </span>
  );
}
