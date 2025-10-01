'use client';

import { useState, useRef, useEffect } from 'react';

export default function Home() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isServiceWorkerReady, setIsServiceWorkerReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration);
          setIsServiceWorkerReady(true);
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !isServiceWorkerReady) return;

    setIsLoading(true);

    try {
      // Use the Service Worker to proxy the request
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (response.ok) {
        // Load the proxied content in an iframe
        if (iframeRef.current) {
          iframeRef.current.src = `/api/proxy?url=${encodeURIComponent(url)}`;
        }
      } else {
        console.error('Proxy request failed');
      }
    } catch (error) {
      console.error('Error accessing proxy:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="proxy-container">
      <div className="proxy-header">
        <h1>EdgeFlow Proxy</h1>
        <p>Service-Worker Based Web Proxy with Scramjet and Vercel Functions</p>

        <div className={`status-indicator ${isServiceWorkerReady ? 'active' : 'inactive'}`}>
          {isServiceWorkerReady ? '✓ Service Worker Active' : '○ Service Worker Loading...'}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <input
          type="url"
          className="proxy-input"
          placeholder="Enter URL to proxy (e.g., https://example.com)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
        <div>
          <button
            type="submit"
            className="proxy-button"
            disabled={!isServiceWorkerReady || isLoading}
          >
            {isLoading ? 'Loading...' : 'Access via Proxy'}
          </button>
        </div>
      </form>

      <iframe
        ref={iframeRef}
        className="proxy-frame"
        title="Proxied Content"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
      />
    </main>
  );
}