/**
 * Search — /search route.
 *
 * Thin wrapper around Home that pre-loads the SearchBar with a `?q=` query
 * and boots the page directly into the results state. Reusing Home keeps a
 * single source of truth for the layout (sidebar + feed + RSVPs panel) and
 * the search state machine.
 *
 * The Figma flow shows search as an inline overlay/expansion within Home
 * (state nodes 507:1517, 515:2082, 515:2413 — same Home frame, same chrome),
 * so a separate URL is purely for shareability.
 */

import { useNavigate, useSearchParams } from "react-router-dom";
import type { SideBarItemId } from "@app/ui";
import { Home } from "./Home";
import {
  SAMPLE_POSTS,
  SAMPLE_RSVP_GROUPS,
  SAMPLE_CLUBS,
} from "../data/sampleHome";

function pathForNavItem(id: SideBarItemId): string {
  return `/${id}`;
}

export function Search() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const q = params.get("q") ?? "";

  return (
    <Home
      activeNavItem="home"
      onNavigate={(id) => navigate(pathForNavItem(id))}
      posts={SAMPLE_POSTS}
      rsvpGroups={SAMPLE_RSVP_GROUPS}
      clubs={SAMPLE_CLUBS}
      initialQuery={q}
      // Keep the URL in sync as the user re-submits a new query — this keeps
      // back/forward navigation predictable and lets the search be shared.
      onSearchSubmit={(next) => {
        const params2 = new URLSearchParams(params);
        params2.set("q", next);
        setParams(params2, { replace: false });
      }}
    />
  );
}

export default Search;
