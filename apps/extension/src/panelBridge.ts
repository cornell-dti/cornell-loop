/**
 * Module-level EventTarget used to signal state changes across the
 * content-script/component boundary without needing React refs or context.
 *
 * "show" — dispatched when the background service-worker notifies us that the
 *           user clicked the toolbar icon while the panel was dismissed.
 */
export const panelEvents = new EventTarget();
