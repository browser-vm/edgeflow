// EdgeFlow Proxy Service Worker
const CACHE_NAME = 'edgeflow-proxy-v1';
const EDGE_FUNCTION_URL = '/api/proxy';

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker installing');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/manifest.json'
      ]);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - intercept and proxy requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only intercept requests that should go through the proxy
  // Skip chrome-extension, data:, blob:, and our own API routes
  if (
    url.protocol === 'chrome-extension:' ||
    url.protocol === 'data:' ||
    url.protocol === 'blob:' ||
    url.hostname === 'localhost' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/') ||
    url.pathname.includes('.')
  ) {
    return;
  }

  console.log('Intercepting request:', event.request.url);

  event.respondWith(
    handleProxyRequest(event.request)
  );
});

async function handleProxyRequest(request) {
  try {
    // Create proxy request to our edge function
    const proxyRequest = new Request(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Original-URL': request.url,
        'X-Original-Method': request.method,
      },
      body: JSON.stringify({
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers.entries()),
        body: request.method !== 'GET' ? await request.text() : null,
      }),
    });

    console.log('Sending to edge function:', proxyRequest.url);

    const response = await fetch(proxyRequest);

    if (!response.ok) {
      throw new Error(`Edge function responded with ${response.status}`);
    }

    // Get the response data
    const responseData = await response.json();

    // Create new response with proxied content
    const proxiedResponse = new Response(
      new Blob([responseData.content], { type: responseData.contentType }),
      {
        status: responseData.status,
        statusText: responseData.statusText,
        headers: responseData.headers,
      }
    );

    // Implement caching strategy
    if (responseData.cacheable) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, proxiedResponse.clone());
    }

    return proxiedResponse;

  } catch (error) {
    console.error('Proxy request failed:', error);

    // Fallback to cache if available
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('Serving from cache');
      return cachedResponse;
    }

    // Final fallback - return a simple error response
    return new Response('Proxy temporarily unavailable', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }
}

// Message handling for communication with main thread
self.addEventListener('message', (event) => {
  console.log('Service Worker received message:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});