/**
 * The user's pinned "Sort by" filter tags, shared with the dashboard filter
 * bar via `userProfiles.filterTags` (falls back to DEFAULT_FILTER_TAGS).
 * Edits apply locally right away and persist through `users.setFilterTags`.
 */

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@app/convex/_generated/api";
import {
  CANONICAL_TAGS,
  DEFAULT_FILTER_TAGS,
  normalizeTags,
  type CanonicalTag,
} from "@app/convex/lib/tags";

export function useFilterTags(): {
  tags: CanonicalTag[];
  addTag: (tag: CanonicalTag) => void;
  removeTag: (tag: CanonicalTag) => void;
} {
  const current = useQuery(api.users.currentUser);
  const saveFilterTags = useMutation(api.users.setFilterTags);
  const [localTags, setLocalTags] = useState<CanonicalTag[] | null>(null);

  const savedTags = current?.profile?.filterTags;
  const tags = useMemo(
    () =>
      localTags ??
      (savedTags !== undefined
        ? normalizeTags(savedTags)
        : [...DEFAULT_FILTER_TAGS]),
    [localTags, savedTags],
  );

  const signedIn = current?.user != null && !current.rejectedDomain;
  const setTags = useCallback(
    (next: CanonicalTag[]) => {
      setLocalTags(next);
      if (!signedIn) return;
      saveFilterTags({ tags: next }).catch((err: unknown) => {
        console.error("Failed to save filter tags", err);
      });
    },
    [saveFilterTags, signedIn],
  );

  // Keep the strip in canonical order regardless of pin order.
  const addTag = useCallback(
    (tag: CanonicalTag) =>
      setTags(CANONICAL_TAGS.filter((t) => t === tag || tags.includes(t))),
    [setTags, tags],
  );
  const removeTag = useCallback(
    (tag: CanonicalTag) => setTags(tags.filter((t) => t !== tag)),
    [setTags, tags],
  );

  return { tags, addTag, removeTag };
}
