import { useState } from "react";
import App from "../App";
import type { AppProps } from "../App";
import FloatingIcon from "../../public/floating_icon.svg?react";

export interface FloatingPanelProps extends Pick<
  AppProps,
  "pageContext" | "onPreviewSlot"
> {}

export default function FloatingPanel({
  pageContext,
  onPreviewSlot,
}: FloatingPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating tab — fades out when panel opens, fades in when closed */}
      <button
        onClick={() => setIsOpen(true)}
        className={[
          "fixed top-32 right-0 z-[9999] bg-transparent",
          "transition-[filter,opacity] duration-300 hover:brightness-95",
          isOpen ? "pointer-events-none opacity-0" : "opacity-100",
        ].join(" ")}
        aria-label="Open Cornell Loop"
      >
        <FloatingIcon className="h-[90px] w-[82px]" />
      </button>

      {/* Panel outer shell — slides in/out via inline transform (reliable in shadow DOM) */}
      <div
        className="fixed top-4 right-4 bottom-4 z-[9998] w-[380px] transition-transform duration-300 ease-in-out"
        style={{
          transform: isOpen ? "translateX(0)" : "translateX(calc(100% + 1rem))",
        }}
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
