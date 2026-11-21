import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { StoreProvider } from './context/Store';
import { ErrorBoundary } from './components/ErrorBoundary';
import { reportError } from './lib/report';
import './index.css';

window.addEventListener('error', (e) => reportError(e.message, 'window'));
window.addEventListener('unhandledrejection', (e) => reportError(String((e.reason as Error)?.message ?? e.reason), 'promise'));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <StoreProvider>
          <App />
        </StoreProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
