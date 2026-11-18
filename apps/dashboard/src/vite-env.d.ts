/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

import type * as React from "react";

declare global {
  interface ImportMetaEnv {
    readonly VITE_CONVEX_URL: string;
    readonly VITE_CONVEX_SITE_URL?: string;
    /** Absent in local/preview builds — analytics silently no-ops. */
    readonly VITE_POSTHOG_KEY?: string;
    readonly VITE_POSTHOG_HOST?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

type SvgReactComponent = React.FunctionComponent<
  React.ComponentProps<"svg"> & {
    title?: string;
    titleId?: string;
    desc?: string;
    descId?: string;
  }
>;

declare module "@app/ui/assets/bookmark.svg?react" {
  const ReactComponent: SvgReactComponent;
  export default ReactComponent;
}

declare module "@app/ui/assets/bookmark-filled.svg?react" {
  const ReactComponent: SvgReactComponent;
  export default ReactComponent;
}

declare module "@app/ui/assets/close_tags.svg?react" {
  const ReactComponent: SvgReactComponent;
  export default ReactComponent;
}

declare module "@app/ui/assets/close_search.svg?react" {
  const ReactComponent: SvgReactComponent;
  export default ReactComponent;
}

declare module "@app/ui/assets/verified.svg?react" {
  const ReactComponent: SvgReactComponent;
  export default ReactComponent;
}
