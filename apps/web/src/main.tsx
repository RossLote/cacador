import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App';
import './index.css';
// The image map, imported here so all 15 pictures are in dist and the precache before any screen shows one (D14).
import './pwa/images';
import { ReloadOnUpdate } from './pwa/ReloadOnUpdate';
import { registerServiceWorker } from './pwa/registerServiceWorker';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

// The basename follows Vite's base (/cacador/), so the routes are written from /.
createRoot(root).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
      <ReloadOnUpdate />
    </BrowserRouter>
  </StrictMode>,
);

registerServiceWorker();
