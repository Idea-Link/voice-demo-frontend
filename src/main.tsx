import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const path = window.location.pathname;
const root = ReactDOM.createRoot(rootElement);

if (path === '/' || path === '/outbound') {
  const appRoute = path === '/' ? undefined : path;
  root.render(
    <React.StrictMode>
      <App appRoute={appRoute} />
    </React.StrictMode>
  );
} else {
  root.render(
    <React.StrictMode>
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center p-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">404</h1>
          <p className="text-slate-600 mb-6">Page not found</p>
          <a 
            href="/" 
            className="px-6 py-2 bg-[#ff594e] text-white rounded-full font-medium hover:bg-[#e0483e] transition-colors"
          >
            Go Home
          </a>
        </div>
      </div>
    </React.StrictMode>
  );
}