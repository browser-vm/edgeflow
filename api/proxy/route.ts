// EdgeFlow Proxy API Route - Edge Processing Layer
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { get } from '@vercel/edge-config';

// Initialize Neon database connection
const sql = neon(process.env.DATABASE_URL!);

// Configuration interface
interface ProxyConfig {
  enabled: boolean;
  cacheTTL: number;
  maxContentLength: number;
  allowedDomains: string[];
  blockedDomains: string[];
  transformRules: TransformRule[];
}

interface TransformRule {
  pattern: string;
  replacement: string;
  type: 'url' | 'header' | 'content';
}

// Default configuration
const DEFAULT_CONFIG: ProxyConfig = {
  enabled: true,
  cacheTTL: 3600, // 1 hour
  maxContentLength: 10 * 1024 * 1024, // 10MB
  allowedDomains: [],
  blockedDomains: [],
  transformRules: [],
};

// Scramjet-inspired evasion techniques
class ScramjetEngine {
  private config: ProxyConfig;

  constructor(config: ProxyConfig) {
    this.config = config;
  }

  // URL rewriting for censorship evasion
  rewriteUrl(originalUrl: string): string {
    let rewrittenUrl = originalUrl;

    // Apply transformation rules
    for (const rule of this.config.transformRules) {
      if (rule.type === 'url') {
        const regex = new RegExp(rule.pattern, 'g');
        rewrittenUrl = rewrittenUrl.replace(regex, rule.replacement);
      }
    }

    // Domain fronting technique
    if (this.shouldApplyDomainFronting(originalUrl)) {
      rewrittenUrl = this.applyDomainFronting(rewrittenUrl);
    }

    return rewrittenUrl;
  }

  // Header manipulation for anonymity
  sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized = { ...headers };

    // Remove potentially identifying headers
    delete sanitized['cookie'];
    delete sanitized['referer'];
    delete sanitized['origin'];

    // Add proxy-specific headers
    sanitized['user-agent'] = this.generateRandomUserAgent();
    sanitized['x-forwarded-for'] = this.generateRandomIP();
    sanitized['x-proxy-engine'] = 'edgeflow-scramjet';

    return sanitized;
  }

  // Content transformation for censorship evasion
  async transformContent(content: string, contentType: string): Promise<string> {
    if (!this.config.transformRules.length) {
      return content;
    }

    let transformedContent = content;

    for (const rule of this.config.transformRules) {
      if (rule.type === 'content') {
        const regex = new RegExp(rule.pattern, 'g');
        transformedContent = transformedContent.replace(regex, rule.replacement);
      }
    }

    return transformedContent;
  }

  private shouldApplyDomainFronting(url: string): boolean {
    // Apply domain fronting for known censored domains
    const censoredDomains = ['blocked-site.com', 'restricted-content.org'];
    return censoredDomains.some(domain => url.includes(domain));
  }

  private applyDomainFronting(url: string): string {
    // Simple domain fronting by routing through a legitimate domain
    const frontDomains = ['google.com', 'cloudflare.com', 'aws.amazon.com'];
    const randomFront = frontDomains[Math.floor(Math.random() * frontDomains.length)];

    // This is a simplified example - real domain fronting is more complex
    return url.replace(/^https?:\/\//, `https://${randomFront}/proxy?url=${encodeURIComponent(url)}&`);
  }

  private generateRandomUserAgent(): string {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    ];

    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  private generateRandomIP(): string {
    // Generate a random IP in a common range
    return `192.168.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
  }
}

// Main proxy handler
export async function POST(request: NextRequest) {
  try {
    // Get configuration from Edge Config
    const configData = await get('proxy-config');
    const config: ProxyConfig = (configData && typeof configData === 'object' && !Array.isArray(configData))
      ? configData as unknown as ProxyConfig
      : DEFAULT_CONFIG;

    if (!config.enabled) {
      return NextResponse.json(
        { error: 'Proxy service is disabled' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { url, method = 'GET', headers = {}, body: requestBody } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL
    let targetUrl: URL;
    try {
      targetUrl = new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Check domain restrictions
    if (config.blockedDomains.some(domain => targetUrl.hostname.includes(domain))) {
      return NextResponse.json(
        { error: 'Domain is blocked' },
        { status: 403 }
      );
    }

    if (config.allowedDomains.length > 0 &&
        !config.allowedDomains.some(domain => targetUrl.hostname.includes(domain))) {
      return NextResponse.json(
        { error: 'Domain is not allowed' },
        { status: 403 }
      );
    }

    // Initialize Scramjet engine
    const scramjet = new ScramjetEngine(config);

    // Apply URL rewriting
    const rewrittenUrl = scramjet.rewriteUrl(url);

    // Sanitize headers
    const sanitizedHeaders = scramjet.sanitizeHeaders(headers);

    console.log(`Proxying request: ${method} ${url} -> ${rewrittenUrl}`);

    // Create the proxied request
    const proxyRequest = new Request(rewrittenUrl, {
      method,
      headers: sanitizedHeaders,
      body: requestBody,
    });

    // Make the request to the target server
    const response = await fetch(proxyRequest, {
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    // Get response content
    const contentType = response.headers.get('content-type') || 'text/plain';
    let content = '';

    if (response.body) {
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength < config.maxContentLength) {
        const decoder = new TextDecoder('utf-8', { fatal: false });
        content = decoder.decode(buffer);
      } else {
        return NextResponse.json(
          { error: 'Content too large' },
          { status: 413 }
        );
      }
    }

    // Apply content transformation
    const transformedContent = await scramjet.transformContent(content, contentType);

    // Prepare response headers
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      // Skip certain headers that shouldn't be proxied
      if (!['set-cookie', 'connection', 'transfer-encoding'].includes(key.toLowerCase())) {
        responseHeaders[key] = value;
      }
    });

    // Add proxy headers
    responseHeaders['x-proxied-by'] = 'edgeflow';
    responseHeaders['x-cache-status'] = 'MISS';

    // Cache the response if appropriate
    const cacheable = isCacheableResponse(response);

    if (cacheable) {
      await sql`
        INSERT INTO proxy_cache (cache_key, content, content_type, status, status_text, headers, expires_at)
        VALUES (${`proxy:${url}:${Date.now()}`}, ${transformedContent}, ${contentType},
                ${response.status}, ${response.statusText}, ${JSON.stringify(responseHeaders)},
                NOW() + INTERVAL '${config.cacheTTL} seconds')
      `;
    }

    return NextResponse.json({
      content: transformedContent,
      contentType,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      cacheable,
    });

  } catch (error) {
    console.error('Proxy error:', error);

    return NextResponse.json(
      { error: 'Proxy request failed' },
      { status: 500 }
    );
  }
}

// GET handler for direct proxy access
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json(
      { error: 'URL parameter is required' },
      { status: 400 }
    );
  }

  // Forward to POST handler logic
  const postRequest = new NextRequest('/api/proxy', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });

  return POST(postRequest);
}

// Helper function to determine if response should be cached
function isCacheableResponse(response: Response): boolean {
  const cacheControl = response.headers.get('cache-control') || '';
  const contentType = response.headers.get('content-type') || '';

  // Don't cache POST responses or error responses
  if (response.status >= 400) {
    return false;
  }

  // Don't cache dynamic content
  if (cacheControl.includes('no-cache') ||
      cacheControl.includes('no-store') ||
      contentType.includes('application/json')) {
    return false;
  }

  return true;
}