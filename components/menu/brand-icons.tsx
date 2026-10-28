// Minimal brand marks (lucide dropped brand icons). Decorative: labels sit next to them.
const props = { width: 20, height: 20, viewBox: "0 0 24 24", "aria-hidden": true } as const;

export const InstagramIcon = () => (
  <svg {...props} fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);
export const FacebookIcon = () => (
  <svg {...props} fill="currentColor">
    <path d="M14 8h3V4h-3c-2.8 0-4.5 1.8-4.5 4.6V11H7v4h2.5v7h4v-7h3l.5-4h-3.5V8.8c0-.5.3-.8.5-.8Z" />
  </svg>
);
export const TikTokIcon = () => (
  <svg {...props} fill="currentColor">
    <path d="M16.5 3c.4 2.3 1.9 3.8 4 4v3.2c-1.5 0-2.9-.5-4-1.2v6.4A5.6 5.6 0 1 1 11 9.8v3.3a2.4 2.4 0 1 0 2.2 2.4V3h3.3Z" />
  </svg>
);
export const WhatsAppIcon = () => (
  <svg {...props} fill="currentColor">
    <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Zm0 16.3a7.3 7.3 0 0 1-3.7-1l-.3-.2-2.7.7.7-2.6-.2-.3A7.3 7.3 0 1 1 12 19.3Zm4-5.4c-.2-.1-1.3-.7-1.5-.7-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6 6 0 0 1-3-2.6c-.2-.4.2-.4.6-1.2.1-.2 0-.3 0-.4l-.7-1.6c-.2-.4-.4-.4-.5-.4h-.4a.8.8 0 0 0-.6.3 2.5 2.5 0 0 0-.8 1.9 4.4 4.4 0 0 0 .9 2.3 10 10 0 0 0 3.9 3.4c1.4.6 2 .7 2.7.6.4-.1 1.3-.5 1.5-1.1.2-.5.2-1 .1-1.1l-.5-.2Z" />
  </svg>
);
