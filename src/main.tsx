import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/foundation.css';
import './styles/analysis-system.css';
import App from './App';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Application root was not found.');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
