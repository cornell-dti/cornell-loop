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
 *   colour derived deterministically from the avatar name using design-system
 *   palette tokens.  The icon is normalised to ~Neutral/900 via the
 *   --filter-icon-nav CSS custom property defined in tokens.css.
 *
 * All colours, spacing, and font values reference CSS custom properties from
 * src/styles/tokens.css — nothing is hardcoded.
 */

import ProfileIcon from "../assets/profile-avatar.svg?react";

// ─── Fallback colour palette ─────────────────────────────────────────────────
// Deterministic pastel backgrounds for avatars without an image, drawn from
// design-system token values to keep things visually cohesive.

const FALLBACK_PALETTE: { bg: string; fg: string }[] = [
  { bg: "var(--color-primary-500)", fg: "var(--color-primary-800)" }, // peach / dark orange
  { bg: "var(--color-secondary-400)", fg: "var(--color-secondary-700)" }, // light blue / navy
  { bg: "var(--color-primary-400)", fg: "var(--color-primary-700)" }, // warm cream / brand orange
  { bg: "var(--color-secondary-300)", fg: "var(--color-secondary-600)" }, // pale blue / medium blue
  { bg: "var(--color-primary-600)", fg: "var(--color-primary-900)" }, // salmon / deep brown
  { bg: "var(--color-secondary-500)", fg: "var(--color-secondary-900)" }, // sky blue / dark navy
];

/** Simple string hash → palette index so the same name always gets the same colour. */
function fallbackColorsForName(name: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length];
}

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
        "relative inline-flex shrink-0 items-center justify-center",
        "overflow-hidden rounded-full",
        /* size: 32 px = --space-8 */
        "size-[var(--space-8)]",
        /* fallback background — overridden inline when no src is provided */
        item.src ? "bg-[var(--color-surface-subtle)]" : "",
        /*
         * Stacked ring + overlap:
         *   ring-2 ring-[var(--color-surface)] → 2 px white ring between circles
         *   [margin-left:calc(-1*var(--space-2))] → −8 px overlap
         *   Figma uses mr-[-8px] on all avatars + pr-[8px] on the container;
         *   using ml here on 2nd+ avatars is equivalent with no container padding needed.
         */
        stacked
          ? "[margin-left:calc(-1*var(--space-2))] ring-2 ring-[var(--color-surface)]"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        ...(zIndex !== undefined ? { zIndex } : {}),
        ...(!item.src
          ? { backgroundColor: fallbackColorsForName(item.name).bg }
          : {}),
      }}
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
         * Color is a darker shade from the same palette as the background.
         */
        <ProfileIcon
          aria-hidden="true"
          className="size-[var(--space-5)]"
          style={{ color: fallbackColorsForName(item.name).fg }}
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
        "flex items-center gap-[var(--space-2)]",
        "px-[var(--space-1-5)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
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
          "flex items-center",
          isMultiple ? "gap-[var(--space-1)]" : "",
          "font-[family-name:var(--font-body)] font-semibold",
          "text-[length:var(--font-size-body2)] leading-[var(--line-height-body2)]",
          "tracking-[var(--letter-spacing-body2)]",
          "text-[color:var(--color-neutral-700)]",
          "whitespace-nowrap",
        ]
          .filter(Boolean)
          .join(" ")}
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
