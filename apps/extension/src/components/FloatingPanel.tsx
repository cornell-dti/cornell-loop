import { useState, useRef, useEffect, useCallback } from "react";
import App from "../App";
import type { AppProps } from "../App";
import FloatingIcon from "../../public/floating_icon.svg?react";
import { panelEvents } from "../panelBridge";

export interface FloatingPanelProps extends Pick<
  AppProps,
  "pageContext" | "onPreviewSlot"
> {}

// ── Layout constants ─────────────────────────────────────────────────────────
// Icon is rendered at 80 % of the original 82×90 SVG.
const ICON_W = 66;
const ICON_H = 72;

// Mirror inset so the icon’s visible shape sits flush with the viewport edge
// when snapped left or right (~6 px transparent padding at 80 % scale).
const SNAP_EDGE_INSET = 6;

// Default launcher Y: ~old top-32 relative to a full-height panel from EDGE_GAP.
const ICON_BELOW_PANEL = 112;

// Default panel top (full-height panel): aligns launcher with previous layout.
const DEFAULT_PANEL_TOP = 16;

// Minimum gap from any viewport edge.
const EDGE_GAP = 8;

/** Matches previous `right-4` / `left-4` panel inset. */
const PANEL_EDGE = 16;

type DragSurface = "icon" | "panel";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** X when snapped to the left edge (negative pulls past the edge for flush art). */
function snapLeftX(): number {
  return -SNAP_EDGE_INSET;
}

/** X when snapped to the right edge. */
function snapRightX(): number {
  return window.innerWidth - ICON_W + SNAP_EDGE_INSET;
}

function clampIconPos(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(snapLeftX(), Math.min(snapRightX(), x)),
    y: Math.max(EDGE_GAP, Math.min(window.innerHeight - ICON_H - EDGE_GAP, y)),
  };
}

/** Snap horizontal position to whichever side the icon’s center is closer to. */
function magneticSnapX(x: number): number {
  const center = x + ICON_W / 2;
  return center < window.innerWidth / 2 ? snapLeftX() : snapRightX();
}

function isPanelDragBlockedTarget(node: EventTarget | null): boolean {
  if (!(node instanceof Element)) return false;
  return (
    node.closest(
      "button, a, input, textarea, select, [contenteditable='true'], [role='button'], [role='tab']",
    ) !== null
  );
}

function isInsideLoopScroll(node: EventTarget | null): boolean {
  if (!(node instanceof Element)) return false;
  return node.closest("[data-loop-scroll]") !== null;
}

/** Panel drag: never from scroll content; always from drag chrome or non-scroll areas. */
function isPanelDragAllowedStart(node: EventTarget | null): boolean {
  if (!(node instanceof Element)) return false;
  if (isPanelDragBlockedTarget(node)) return false;
  if (
    isInsideLoopScroll(node) &&
    node.closest("[data-loop-panel-drag]") === null
  ) {
    return false;
  }
  return true;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function FloatingPanel({
  pageContext,
  onPreviewSlot,
}: FloatingPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const [iconPos, setIconPos] = useState(() =>
    clampIconPos(snapRightX(), DEFAULT_PANEL_TOP + ICON_BELOW_PANEL),
  );

  const [isDragging, setIsDragging] = useState(false);

  const panelRootRef = useRef<HTMLDivElement>(null);

  /** Shared pointer-drag state (icon and panel use the same move / end logic). */
  const dragRef = useRef<{
    surface: DragSurface;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);

  // True = panel is anchored to the viewport right (icon on the right half).
  const dockRight = iconPos.x + ICON_W / 2 >= window.innerWidth / 2;

  useEffect(() => {
    const handler = () => setIsDismissed(false);
    panelEvents.addEventListener("show", handler);
    return () => panelEvents.removeEventListener("show", handler);
  }, []);

  useEffect(() => {
    function handleResize() {
      setIconPos((prev) => clampIconPos(magneticSnapX(prev.x), prev.y));
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const beginDrag = useCallback(
    (
      surface: DragSurface,
      e: React.PointerEvent,
      captureTarget: HTMLElement,
    ) => {
      dragRef.current = {
        surface,
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startX: iconPos.x,
        startY: iconPos.y,
        moved: false,
      };
      setIsDragging(true);
      captureTarget.setPointerCapture(e.pointerId);
    },
    [iconPos.x, iconPos.y],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || e.pointerId !== dragRef.current.pointerId) return;
    const d = dragRef.current;
    const dx = e.clientX - d.startClientX;
    const dy = e.clientY - d.startClientY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true;
    setIconPos(clampIconPos(d.startX + dx, d.startY + dy));
  }, []);

  const endDrag = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || e.pointerId !== dragRef.current.pointerId) return;
    const { surface, moved } = dragRef.current;
    dragRef.current = null;
    setIsDragging(false);

    if (surface === "icon" && !moved) {
      setIsOpen(true);
      return;
    }

    setIconPos((prev) => clampIconPos(magneticSnapX(prev.x), prev.y));
  }, []);

  const handleLostPointerCapture = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || e.pointerId !== dragRef.current.pointerId) return;
    const { surface, moved } = dragRef.current;
    dragRef.current = null;
    setIsDragging(false);
    if (surface === "icon" && !moved) {
      setIsOpen(true);
      return;
    }
    setIconPos((prev) => clampIconPos(magneticSnapX(prev.x), prev.y));
  }, []);

  const handleIconPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest("[data-dismiss-btn]")) return;
      if (e.button !== 0) return;
      beginDrag("icon", e, e.currentTarget as HTMLElement);
    },
    [beginDrag],
  );

  const handlePanelPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isOpen) return;
      if (e.button !== 0) return;
      if (!isPanelDragAllowedStart(e.target)) return;
      const el = panelRootRef.current;
      if (el === null) return;
      beginDrag("panel", e, el);
    },
    [isOpen, beginDrag],
  );

  // Panel is always full viewport height; launcher Y is independent.
  const panelTop = EDGE_GAP;
  const panelHeight = `calc(100vh - ${EDGE_GAP * 2}px)`;

  const iconTransition = isDragging
    ? "opacity 0.3s, filter 0.3s"
    : [
        "left 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "top 0.25s ease-out",
        "opacity 0.3s",
        "filter 0.3s",
      ].join(", ");

  const panelClosedTransform = dockRight
    ? "translateX(calc(100% + 1rem))"
    : "translateX(calc(-100% - 1rem))";

  if (isDismissed) return null;

  return (
    <>
      {/* ── Floating tab ───────────────────────────────────────────────────── */}
      <div
        role="button"
        aria-label="Open Cornell Loop"
        tabIndex={0}
        className={[
          "group fixed z-[9999] select-none",
          isOpen
            ? "pointer-events-none opacity-0"
            : "cursor-grab opacity-100 active:cursor-grabbing",
        ].join(" ")}
        style={{ left: iconPos.x, top: iconPos.y, transition: iconTransition }}
        onPointerDown={handleIconPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={handleLostPointerCapture}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setIsOpen(true);
        }}
      >
        {dockRight ? (
          <FloatingIcon style={{ width: ICON_W, height: ICON_H }} />
        ) : (
          <div
            style={{
              transform: "scaleX(-1)",
              width: ICON_W,
              height: ICON_H,
            }}
          >
            <FloatingIcon style={{ width: ICON_W, height: ICON_H }} />
          </div>
        )}

        <button
          data-dismiss-btn
          onClick={(e) => {
            e.stopPropagation();
            setIsDismissed(true);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className={[
            "absolute top-0 left-[3px] -translate-y-1/2",
            "flex h-[18px] w-[18px] items-center justify-center",
            "rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.22)]",
            "opacity-0 transition-opacity duration-150 group-hover:opacity-100",
            "text-[var(--color-brand)]",
          ].join(" ")}
          aria-label="Dismiss Cornell Loop"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M8.5 8.5L1.5 1.5M8.5 1.5L1.5 8.5"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* ── Panel — full viewport height; dock follows launcher X ─────────── */}
      <div
        ref={panelRootRef}
        className={[
          "fixed z-[9998] w-[380px] overflow-hidden",
          "transition-transform duration-300 ease-in-out",
        ].join(" ")}
        style={{
          top: panelTop,
          height: panelHeight,
          ...(dockRight
            ? { right: PANEL_EDGE, left: "auto" }
            : { left: PANEL_EDGE, right: "auto" }),
          transform: isOpen ? "translateX(0)" : panelClosedTransform,
        }}
        onPointerDown={handlePanelPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={handleLostPointerCapture}
      >
        <App
          onClose={() => setIsOpen(false)}
          pageContext={pageContext}
          onPreviewSlot={onPreviewSlot}
        />
      </div>
    </>
  );
}
