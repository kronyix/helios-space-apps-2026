import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Type system: Luckiest Guy (hero display), Silkscreen (labels, headings, UI, data), Inter (body).
import '@fontsource/luckiest-guy/400.css';
import '@fontsource/silkscreen/400.css';
import '@fontsource/silkscreen/700.css';
import '@fontsource-variable/inter';
// Hindi: Devanagari subset only (unicode-range), downloaded only when Devanagari text renders.
import '@fontsource/noto-sans-devanagari/devanagari-400.css';
import '@fontsource/noto-sans-devanagari/devanagari-600.css';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
