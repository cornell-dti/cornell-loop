import { useState } from 'react'
import { Button } from '@app/ui'
import SearchHeader from './components/SearchHeader'
import FeedView from './components/FeedView'
import BookmarkView from './components/BookmarkView'
import SearchView from './components/SearchView'
import OriginalEmailView from './components/OriginalEmailView'

type View = 'feed' | 'bookmarks' | 'search' | 'email'

export interface AppProps {
  onClose?: () => void
}

export default function App({ onClose }: AppProps) {
  const [view, setView] = useState<View>('feed')
  const [activeTab, setActiveTab] = useState<'feed' | 'bookmarks'>('feed')
  const [searchQuery, setSearchQuery] = useState('')

  const isSearchMode = view === 'search' || view === 'email'

  const handleTabChange = (tab: string) => {
    const t = tab as 'feed' | 'bookmarks'
    setActiveTab(t)
    setView(t)
  }

  const handleSearchFocus = () => setView('search')

  const handleSearchChange = (q: string) => {
    setSearchQuery(q)
    setView('search')
  }

  const handleSearchClear = () => setSearchQuery('')

  const handleBack = () => {
    setSearchQuery('')
    setView(activeTab)
  }

  return (
    <div
      className="h-full bg-white rounded-[12px] overflow-hidden flex flex-col"
      style={{ boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.18)' }}
    >
      {/* ── Sticky header ── */}
      <div className="shrink-0 px-6 pt-7">
        <SearchHeader
          variant={isSearchMode ? 'search' : 'main'}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onSearchFocus={handleSearchFocus}
          onSearchClear={handleSearchClear}
          onBack={handleBack}
          onClose={onClose}
        />
      </div>

      {/* ── Scrollable content (CTA scrolls with content, not sticky) ── */}
      <div className="flex-1 overflow-y-auto min-h-0 px-6 py-[21px]">
        {view === 'feed' && <FeedView />}
        {view === 'bookmarks' && <BookmarkView />}
        {view === 'search' && <SearchView query={searchQuery} />}
        {view === 'email' && <OriginalEmailView />}

        <div className="pt-[21px]">
          <Button variant="primary" size="cta">
            See more in dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}
