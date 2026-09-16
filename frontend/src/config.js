// adding vercel envv, THANKS GULSHAN BHAIYA FOR IDEAAAA
export const API_BASE = import.meta.env.VITE_API_URL || '';

export const getWsUrl = () => {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  if (import.meta.env.VITE_API_URL) {
    
    const url = new URL(import.meta.env.VITE_API_URL);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${url.host}`;
  }
  const host = window.location.hostname || 'localhost';
  return `ws://${host}:4000`;
};
