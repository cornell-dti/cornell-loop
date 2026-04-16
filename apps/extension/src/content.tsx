import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConvexReactClient } from 'convex/react'
import FloatingPanel from './components/FloatingPanel.tsx'
import contentStyles from './content.css?inline'

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string)

function mount() {
  if (document.getElementById('cornell-loop-host')) return

  const host = document.createElement('div')
  host.id = 'cornell-loop-host'
  // Explicit styles prevent Gmail/Calendar from accidentally hiding or
  // reflowing the host. Fixed + zero-size keeps it out of the page layout
  // while still allowing the shadow DOM children to use fixed positioning.
  host.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;overflow:visible;pointer-events:none;'
  document.body.appendChild(host)

  const shadow = host.attachShadow({ mode: 'open' })

  // Inject processed Tailwind + token styles into the shadow root so they
  // aren't blocked by shadow DOM style encapsulation.
  const sheet = new CSSStyleSheet()
  sheet.replaceSync(contentStyles)
  shadow.adoptedStyleSheets = [sheet]

  const mountPoint = document.createElement('div')
  mountPoint.style.pointerEvents = 'auto'
  shadow.appendChild(mountPoint)

  createRoot(mountPoint).render(
    <StrictMode>
      <ConvexAuthProvider client={convex}>
        <FloatingPanel />
      </ConvexAuthProvider>
    </StrictMode>,
  )
}

mount()
