// EdgeFlow Logs API - Serverless Monitoring and Analytics
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

// Initialize Neon database connection
const sql = neon(process.env.DATABASE_URL!);

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  url?: string;
  ip?: string;
  userAgent?: string;
  responseTime?: number;
  statusCode?: number;
}

// GET - Retrieve logs with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level') as 'info' | 'warn' | 'error' | null;
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000);
    const offset = parseInt(searchParams.get('offset') || '0');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build the query with filters
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (level) {
      whereClause += ` AND level = $${paramIndex}`;
      params.push(level);
      paramIndex++;
    }

    if (startDate) {
      whereClause += ` AND timestamp >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereClause += ` AND timestamp <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM proxy_logs ${whereClause}`;
    const countResult = await sql.query(countQuery, params.slice(0, paramIndex - 1));
    const total = parseInt(countResult[0].total);

    if (total === 0) {
      return NextResponse.json({
        success: true,
        logs: [],
        total: 0,
        hasMore: false,
      });
    }

    // Get paginated logs
    const offsetParam = paramIndex;
    const limitParam = paramIndex + 1;
    const logsQuery = `
      SELECT timestamp, level, message, url, ip, userAgent, responseTime, statusCode
      FROM proxy_logs
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;

    const result = await sql.query(logsQuery, [...params.slice(0, paramIndex - 1), limit, offset]);
    const logs: LogEntry[] = result as LogEntry[];

    // Check if there are more results
    const hasMore = offset + limit < total;

    return NextResponse.json({
      success: true,
      logs,
      total,
      hasMore,
      limit,
      offset,
    });

  } catch (error) {
    console.error('Error retrieving logs:', error);

    return NextResponse.json(
      { error: 'Failed to retrieve logs' },
      { status: 500 }
    );
  }
}

// POST - Submit a new log entry
export async function POST(request: NextRequest) {
  try {
    const logEntry: Omit<LogEntry, 'timestamp'> = await request.json();

    // Validate required fields
    if (!logEntry.level || !logEntry.message) {
      return NextResponse.json(
        { error: 'Level and message are required' },
        { status: 400 }
      );
    }

    // Validate level
    if (!['info', 'warn', 'error'].includes(logEntry.level)) {
      return NextResponse.json(
        { error: 'Invalid log level' },
        { status: 400 }
      );
    }

    // Create complete log entry
    const completeLogEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      ...logEntry,
    };

    // Store in PostgreSQL with TTL (7 days)
    const result = await sql`
      INSERT INTO proxy_logs (timestamp, level, message, url, ip, userAgent, responseTime, statusCode, expires_at)
      VALUES (${completeLogEntry.timestamp}, ${completeLogEntry.level}, ${completeLogEntry.message},
              ${completeLogEntry.url || null}, ${completeLogEntry.ip || null},
              ${completeLogEntry.userAgent || null}, ${completeLogEntry.responseTime || null},
              ${completeLogEntry.statusCode || null}, NOW() + INTERVAL '7 days')
      RETURNING id
    `;

    // Also log to console for immediate visibility
    console.log(`[${logEntry.level.toUpperCase()}] ${logEntry.message}`, logEntry);

    return NextResponse.json({
      success: true,
      logId: result[0].id,
      timestamp: completeLogEntry.timestamp,
    });

  } catch (error) {
    console.error('Error creating log entry:', error);

    return NextResponse.json(
      { error: 'Failed to create log entry' },
      { status: 500 }
    );
  }
}

// DELETE - Clear old logs (admin function)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const olderThan = searchParams.get('olderThan'); // ISO date string
    const maxAge = parseInt(searchParams.get('maxAge') || '7'); // days

    if (!olderThan && !maxAge) {
      return NextResponse.json(
        { error: 'olderThan or maxAge parameter required' },
        { status: 400 }
      );
    }

    const cutoffDate = olderThan
      ? new Date(olderThan)
      : new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000);

    // Delete old logs based on timestamp
    const result = await sql`
      DELETE FROM proxy_logs
      WHERE timestamp < ${cutoffDate.toISOString()}
    `;

    const deletedCount = result.length || 0;

    // Log the cleanup activity
    console.log(`Cleaned up ${deletedCount} old log entries`);

    return NextResponse.json({
      success: true,
      deletedCount,
      cutoffDate: cutoffDate.toISOString(),
    });

  } catch (error) {
    console.error('Error cleaning up logs:', error);

    return NextResponse.json(
      { error: 'Failed to clean up logs' },
      { status: 500 }
    );
  }
}