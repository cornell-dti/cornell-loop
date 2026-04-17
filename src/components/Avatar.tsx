/**
 * Avatar — Loop Design System
 *
 * Source: Figma "Incubator-design-file" › Design System › Avatar (node 494:1719)
 *
 * Variants (Figma `property1`):
 *   • "Default"  — single 32 px circle + organisation name label
 *   • "multiple" — N stacked 32 px circles (−8 px overlap, 2 px ring) +
 *                  comma-separated name labels
 *
 * The variant is inferred from the length of the `avatars` array — pass one
 * item for Default, two or more for the multiple stack.
 *
 * Image fallback:
 *   When an avatar item has no `src`, profile.svg from src/assets is shown on a
 *   Neutral/100 background.  The icon is normalised to ~Neutral/900 via the
 *   --filter-icon-nav CSS custom property defined in tokens.css.
 *
 * All colours, spacing, and font values reference CSS custom properties from
 * src/styles/tokens.css — nothing is hardcoded.
 */

import ProfileIcon from '../assets/profile.svg?react';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface AvatarItem {
  /** Photo / org image URL. Omit to show the profile.svg placeholder. */
  src?: string;
  /** Display name. Shown in the label and used as <img> alt text. */
  name: string;
}

export interface AvatarProps {
  /**
   * One or more avatar items.
   *   `avatars.length === 1` → "Default" variant (single circle + single label)
   *   `avatars.length  >  1` → "multiple" variant (stacked circles + comma labels)
   */
  avatars: AvatarItem[];
  className?: string;
}

// ─── AvatarCircle ─────────────────────────────────────────────────────────────

interface AvatarCircleProps {
  item: AvatarItem;
  /**
   * When true the circle gets the white 2 px ring separator and a negative
   * left margin for stacking (Figma: mr-[-8px] pattern on every avatar after
   * the first, implemented here as margin-left for cleaner DOM flow).
   */
  stacked?: boolean;
  /** CSS z-index so earlier avatars render on top of later ones. */
  zIndex?: number;
}

function AvatarCircle({ item, stacked = false, zIndex }: AvatarCircleProps) {
  return (
    <span
      className={[
        /* shape */
        'relative inline-flex shrink-0 items-center justify-center',
        'rounded-full overflow-hidden',
        /* size: 32 px = --space-8 */
        'size-[var(--space-8)]',
        /* fallback background */
        'bg-[var(--color-surface-subtle)]',
        /*
         * Stacked ring + overlap:
         *   ring-2 ring-[var(--color-surface)] → 2 px white ring between circles
         *   [margin-left:calc(-1*var(--space-2))] → −8 px overlap
         *   Figma uses mr-[-8px] on all avatars + pr-[8px] on the container;
         *   using ml here on 2nd+ avatars is equivalent with no container padding needed.
         */
        stacked
          ? 'ring-2 ring-[var(--color-surface)] [margin-left:calc(-1*var(--space-2))]'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={zIndex !== undefined ? { zIndex } : undefined}
    >
      {item.src ? (
        <img
          src={item.src}
          alt={item.name}
          className="size-full object-cover"
        />
      ) : (
        /*
         * Fallback: profile.svg rendered inline via SVGR.
         * Sized to --space-5 (20 px) inside the 32 px circle.
         * --filter-icon-nav normalises the hardcoded SVG stroke to ~Neutral/900.
         */
        <ProfileIcon
          aria-hidden="true"
          className="size-[var(--space-5)] [filter:var(--filter-icon-nav)]"
        />
      )}
    </span>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

export function Avatar({ avatars, className }: AvatarProps) {
  if (avatars.length === 0) return null;

  const isMultiple = avatars.length > 1;

  return (
    /*
     * Figma outer container: flex gap-[8px] items-center px-[6px]
     *   --space-2  = 8 px (gap between circle stack and label)
     *   --space-1-5 = 6 px (horizontal padding)
     */
    <div
      className={[
        'flex items-center gap-[var(--space-2)]',
        'px-[var(--space-1-5)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* ── Circle(s) ── */}
      <div className="flex items-center">
        {avatars.map((avatar, i) => (
          <AvatarCircle
            key={i}
            item={avatar}
            stacked={isMultiple && i > 0}
            /* Higher index = lower z-index so first avatar sits on top */
            zIndex={avatars.length - i}
          />
        ))}
      </div>

      {/* ── Label ── */}
      {/*
       * Single variant:  just the name
       * Multiple variant: "Name1, Name2, Name3" — each name+comma is its own flex
       *                   span matching Figma's gap-[4px] group pattern.
       * Typography: DM Sans SemiBold 14 px, Neutral/700, −0.5 px tracking.
       */}
      <div
        className={[
          'flex items-center',
          isMultiple ? 'gap-[var(--space-1)]' : '',
          'font-[family-name:var(--font-body)] font-semibold',
          'text-[length:var(--font-size-body2)] leading-[var(--line-height-body2)]',
          'tracking-[var(--letter-spacing-body2)]',
          'text-[var(--color-neutral-700)]',
          'whitespace-nowrap',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ fontVariationSettings: "'opsz' 14" }}
      >
        {avatars.map((avatar, i) => (
          <span key={i} className="flex items-center">
            {avatar.name}
            {/* Attach comma directly to name (no space) — matches Figma's <p>,</p> pattern */}
            {i < avatars.length - 1 && <span>,</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
