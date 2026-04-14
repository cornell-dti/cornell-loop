import LoopMarkIcon from '../assets/loop_logo.svg?react';
import LoopMarkMixedIcon from '../assets/loop-logo-mixed.svg?react';

/**
 * Logo variants matching the Figma "Logo" section (node 381:1325):
 *
 *  wordmark       → mark (orange) + "Loop" in black  — Figma "Favicon"
 *  wordmark-light → mark (orange) + "Loop" in white  — Figma "Logo - dark background"
 *  mark           → mark (orange) only               — Figma "Variant2"
 *  mark-mixed     → mark (mixed/cream) only           — Figma "Favicon - Orange Backgroud"
 */
export type LogoVariant =
  | 'wordmark'
  | 'wordmark-light'
  | 'mark'
  | 'mark-mixed';

export interface LoopLogoProps {
  /**
   * Which Figma logo variant to render.
   * @default 'wordmark'
   */
  variant?: LogoVariant;
  /**
   * Controls the height of the logo mark (and scales the wordmark text proportionally).
   * Defaults to 'md' (~42px mark, matching the Figma Logo section).
   * Use 'sm' for the compact sidebar presentation.
   */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const markSizeClass: Record<NonNullable<LoopLogoProps['size']>, string> = {
  sm: 'size-[var(--space-6)]',        /* 24px — sidebar compact */
  md: 'size-[2.625rem]',              /* 42px — Figma Logo section standard mark */
  lg: 'size-[3.4375rem]',             /* 55px — display / hero usage */
};

const wordmarkSizeClass: Record<NonNullable<LoopLogoProps['size']>, string> = {
  sm: 'text-[length:var(--font-size-wordmark)]',         /* 32px */
  md: 'text-[length:var(--font-size-wordmark-display)]', /* 55px */
  lg: 'text-[length:var(--font-size-wordmark-display)]', /* 55px — same, let container scale */
};

export function LoopLogo({
  variant = 'wordmark',
  size = 'md',
  className,
}: LoopLogoProps) {
  const showText = variant === 'wordmark' || variant === 'wordmark-light';
  const textColorClass =
    variant === 'wordmark-light' ? 'text-white' : 'text-[var(--color-neutral-900)]';

  const MarkComponent =
    variant === 'mark-mixed' ? LoopMarkMixedIcon : LoopMarkIcon;

  return (
    <div
      className={[
        'flex items-center',
        showText ? 'gap-[var(--space-2)]' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label="Loop logo"
      role="img"
    >
      <MarkComponent
        className={['shrink-0', markSizeClass[size]].join(' ')}
        aria-hidden="true"
      />
      {showText && (
        <span
          className={[
            'font-[family-name:var(--font-brand)] font-bold leading-none whitespace-nowrap',
            wordmarkSizeClass[size],
            textColorClass,
          ].join(' ')}
        >
          Loop
        </span>
      )}
    </div>
  );
}

export default LoopLogo;
