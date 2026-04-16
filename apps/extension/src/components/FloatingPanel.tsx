import { useState } from 'react'
import App from '../App'
import FloatingIcon from '../../public/floating_icon.svg?react'
import CloseIcon from '@app/ui/assets/close_search.svg?react'

export default function FloatingPanel() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Floating tab — SVG is the full visual (bg, shape, shadow all included) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed right-0 top-32 z-[9999] bg-transparent hover:brightness-95 transition-[filter]"
          aria-label="Open Cornell Loop"
        >
          <FloatingIcon className="w-[82px] h-[90px]" />
        </button>
      )}

      {/* Side panel — slides in from the right */}
      <div
        style={{ '--panel-width': '380px' } as React.CSSProperties}
        className={[
          'fixed top-0 right-0 h-full z-[9998]',
          'w-[var(--panel-width)] bg-background border-l border-border shadow-2xl',
          'flex flex-col transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <span className="text-sm font-semibold text-foreground">Cornell Loop</span>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 rounded hover:bg-muted transition-colors"
            aria-label="Close panel"
          >
            <CloseIcon className="w-4 h-4 text-foreground" />
          </button>
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-auto">
          <App />
        </div>
      </div>
    </>
  )
}
