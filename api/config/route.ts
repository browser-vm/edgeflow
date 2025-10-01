// EdgeFlow Control Plane API - Serverless Configuration Management
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { get } from '@vercel/edge-config';

// Configuration interfaces
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

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  url?: string;
  ip?: string;
  userAgent?: string;
}

// Default configuration
const DEFAULT_CONFIG: ProxyConfig = {
  enabled: true,
  cacheTTL: 3600,
  maxContentLength: 10 * 1024 * 1024,
  allowedDomains: [],
  blockedDomains: [],
  transformRules: [],
};

// GET - Retrieve current configuration
export async function GET() {
  try {
    // Try to get config from PostgreSQL first, fall back to Edge Config
    let config = DEFAULT_CONFIG;

    try {
      const result = await sql`SELECT config FROM proxy_config WHERE id = 1`;
      if (result.rows.length > 0) {
        config = result.rows[0].config as ProxyConfig;
      } else {
        // Fall back to Edge Config if no PostgreSQL config exists
        const edgeConfig = await get('proxy-config');
        if (edgeConfig && typeof edgeConfig === 'object' && !Array.isArray(edgeConfig)) {
          config = edgeConfig as unknown as ProxyConfig;
        }
      }
    } catch (dbError) {
      console.warn('PostgreSQL not available, falling back to Edge Config:', dbError);
      // Fall back to Edge Config if PostgreSQL fails
      const edgeConfig = await get('proxy-config');
      if (edgeConfig && typeof edgeConfig === 'object' && !Array.isArray(edgeConfig)) {
        config = edgeConfig as unknown as ProxyConfig;
      }
    }

    return NextResponse.json({
      success: true,
      config,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error retrieving config:', error);

    return NextResponse.json(
      { error: 'Failed to retrieve configuration' },
      { status: 500 }
    );
  }
}

// POST - Update configuration
export async function POST(request: NextRequest) {
  try {
    const updates = await request.json();

    // Validate the updates
    if (typeof updates !== 'object' || updates === null) {
      return NextResponse.json(
        { error: 'Invalid configuration data' },
        { status: 400 }
      );
    }

    // Get current config
    const currentConfigData = await get('proxy-config');
    const currentConfig: ProxyConfig = (currentConfigData && typeof currentConfigData === 'object' && !Array.isArray(currentConfigData))
      ? currentConfigData as unknown as ProxyConfig
      : DEFAULT_CONFIG;

    // Merge updates with current config
    const newConfig: ProxyConfig = { ...currentConfig, ...updates };

    // Validate the merged config
    if (typeof newConfig.enabled !== 'boolean' ||
        typeof newConfig.cacheTTL !== 'number' ||
        typeof newConfig.maxContentLength !== 'number' ||
        !Array.isArray(newConfig.allowedDomains) ||
        !Array.isArray(newConfig.blockedDomains) ||
        !Array.isArray(newConfig.transformRules)) {
      return NextResponse.json(
        { error: 'Invalid configuration structure' },
        { status: 400 }
      );
    }

    // Update configuration in PostgreSQL (Edge Config is read-only)
    await sql`INSERT INTO proxy_config (id, config, updated_at)
              VALUES (1, ${JSON.stringify(newConfig)}, NOW())
              ON CONFLICT (id) DO UPDATE SET
                config = ${JSON.stringify(newConfig)},
                updated_at = NOW()`;

    // Log the configuration change
    await logActivity('info', 'Configuration updated', {
      admin: true,
      changes: Object.keys(updates),
    });

    return NextResponse.json({
      success: true,
      config: newConfig,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error updating config:', error);

    return NextResponse.json(
      { error: 'Failed to update configuration' },
      { status: 500 }
    );
  }
}

// Helper function to log activities
async function logActivity(level: 'info' | 'warn' | 'error', message: string, metadata?: any) {
  try {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...metadata,
    };

    // Store in PostgreSQL for persistent logging
    await sql`INSERT INTO proxy_logs (timestamp, level, message, metadata, expires_at)
              VALUES (${logEntry.timestamp}, ${logEntry.level}, ${logEntry.message},
                      ${JSON.stringify(metadata || {})}, NOW() + INTERVAL '7 days')`;

    // Also log to console for immediate visibility
    console.log(`[${level.toUpperCase()}] ${message}`, metadata);

  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}