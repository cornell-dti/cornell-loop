/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

import type * as React from "react";

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
