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
import { fallbackColorsForName } from "../utils/fallbackColors";

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
  /** Show the white 2 px ring (all avatars in a multi-stack). */
  showRing?: boolean;
  /** Apply negative left margin for overlap (2nd+ avatars only). */
  overlap?: boolean;
  /** CSS z-index so earlier avatars render on top of later ones. */
  zIndex?: number;
}

function AvatarCircle({
  item,
  showRing = false,
  overlap = false,
  zIndex,
}: AvatarCircleProps) {
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
        /* White outline on every avatar in a stack so overlapping neighbours show a border.
         * Uses outline instead of ring to avoid clipping with overflow-hidden. */
        showRing ? "outline-2 outline-[var(--color-surface)]" : "",
        /* Negative margin for overlap on 2nd+ avatars */
        overlap ? "[margin-left:calc(-1*var(--space-2))]" : "",
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
            showRing={isMultiple}
            overlap={isMultiple && i > 0}
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
          "pointer-events-none whitespace-nowrap select-none",
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
