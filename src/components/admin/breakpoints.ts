// Tailwind's `md:` breakpoint is 48rem, which is 768px regardless of this project's root font
// size: inside a media query `rem` resolves against the initial 16px value, not the document's.
// Keep this in step with the `md:` visibility classes in the sidebar — the drawer's auto-close
// and the CSS that hides it have to agree on where the desktop layout begins.
const ADMIN_DESKTOP_BREAKPOINT_PX = 768;
export const ADMIN_DESKTOP_MEDIA_QUERY = `(min-width: ${ADMIN_DESKTOP_BREAKPOINT_PX}px)`;
