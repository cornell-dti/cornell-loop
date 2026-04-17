import { useState } from 'react'
import App from '../App'
import FloatingIcon from '../../public/floating_icon.svg?react'

export default function FloatingPanel() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Floating tab — fades out when panel opens, fades in when closed */}
      <button
        onClick={() => setIsOpen(true)}
        className={[
          'fixed right-0 top-32 z-[9999] bg-transparent',
          'hover:brightness-95 transition-[filter,opacity] duration-300',
          isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100',
        ].join(' ')}
        aria-label="Open Cornell Loop"
      >
        <FloatingIcon className="w-[82px] h-[90px]" />
      </button>

      {/* Panel outer shell — slides in/out via inline transform (reliable in shadow DOM) */}
      <div
        className="fixed top-4 right-4 bottom-4 z-[9998] w-[380px] transition-transform duration-300 ease-in-out"
        style={{ transform: isOpen ? 'translateX(0)' : 'translateX(calc(100% + 1rem))' }}
      >
        <App onClose={() => setIsOpen(false)} />
      </div>
    </>
  )
}
