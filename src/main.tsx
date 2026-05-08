import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

/**
 * Global UX fix for number inputs:
 * Many forms hold their state as `number` and default to 0, so the input
 * shows "0" and the user's digits get appended after it (e.g. "0300").
 * Select the value when a number input gains focus so the first keystroke
 * replaces it instead of appending.
 *
 * Also disables mouse-wheel changes which routinely corrupt values.
 */
document.addEventListener('focusin', (e) => {
  const t = e.target as HTMLInputElement | null;
  if (t && t.tagName === 'INPUT' && t.type === 'number') {
    // Defer so the browser places the caret first, then we select.
    setTimeout(() => {
      try {
        t.select();
      } catch {
        /* some inputs don't allow select(); ignore */
      }
    }, 0);
  }
});

document.addEventListener(
  'wheel',
  (e) => {
    const t = e.target as HTMLInputElement | null;
    if (
      t &&
      t.tagName === 'INPUT' &&
      t.type === 'number' &&
      document.activeElement === t
    ) {
      t.blur();
    }
  },
  { passive: true }
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
