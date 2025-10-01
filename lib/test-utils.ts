// EdgeFlow Proxy Test Utilities
import { sql } from '@vercel/postgres';

export interface TestResult {
  test: string;
  passed: boolean;
  message: string;
  duration?: number;
}

/**
 * Test Service Worker registration
 */
export async function testServiceWorker(): Promise<TestResult> {
  const startTime = Date.now();

  try {
    if (typeof window === 'undefined') {
      return {
        test: 'Service Worker Registration',
        passed: false,
        message: 'Service Worker can only be tested in browser environment',
      };
    }

    if (!('serviceWorker' in navigator)) {
      return {
        test: 'Service Worker Support',
        passed: false,
        message: 'Service Worker not supported in this browser',
      };
    }

    const registration = await navigator.serviceWorker.register('/sw.js');
    const duration = Date.now() - startTime;

    return {
      test: 'Service Worker Registration',
      passed: true,
      message: `Service Worker registered successfully. Scope: ${registration.scope}`,
      duration,
    };
  } catch (error) {
    return {
      test: 'Service Worker Registration',
      passed: false,
      message: `Service Worker registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Test proxy configuration
 */
export async function testProxyConfig(): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const response = await fetch('/api/config');
    const data = await response.json();
    const duration = Date.now() - startTime;

    if (response.ok && data.success) {
      return {
        test: 'Proxy Configuration',
        passed: true,
        message: 'Configuration retrieved successfully',
        duration,
      };
    } else {
      return {
        test: 'Proxy Configuration',
        passed: false,
        message: `Configuration request failed: ${data.error || 'Unknown error'}`,
        duration,
      };
    }
  } catch (error) {
    return {
      test: 'Proxy Configuration',
      passed: false,
      message: `Configuration test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Test KV store connectivity
 */
export async function testKVStore(): Promise<TestResult> {
  const startTime = Date.now();

  try {
    // Test PostgreSQL connectivity with a simple insert/select operation
    const testKey = `test:${Date.now()}`;
    const testValue = { test: true, timestamp: new Date().toISOString() };

    // Insert test data
    await sql`INSERT INTO test_data (test_key, test_value, expires_at)
              VALUES (${testKey}, ${JSON.stringify(testValue)}, NOW() + INTERVAL '60 seconds')`;

    // Retrieve test data
    const result = await sql`SELECT test_value FROM test_data WHERE test_key = ${testKey}`;
    const retrieved = result.rows.length > 0 ? JSON.parse(result.rows[0].test_value) : null;
    const duration = Date.now() - startTime;

    if (retrieved && JSON.stringify(retrieved) === JSON.stringify(testValue)) {
      return {
        test: 'KV Store Connectivity',
        passed: true,
        message: 'KV store is accessible and working',
        duration,
      };
    } else {
      return {
        test: 'KV Store Connectivity',
        passed: false,
        message: 'KV store test failed - data mismatch',
        duration,
      };
    }
  } catch (error) {
    return {
      test: 'KV Store Connectivity',
      passed: false,
      message: `KV store test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Test proxy functionality with a safe URL
 */
export async function testProxyFunctionality(): Promise<TestResult> {
  const startTime = Date.now();

  try {
    // Use a safe, public test URL
    const testUrl = 'https://httpbin.org/get';

    const response = await fetch('/api/proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: testUrl }),
    });

    const duration = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json();
      return {
        test: 'Proxy Functionality',
        passed: true,
        message: `Proxy request successful. Status: ${data.status}`,
        duration,
      };
    } else {
      return {
        test: 'Proxy Functionality',
        passed: false,
        message: `Proxy request failed with status: ${response.status}`,
        duration,
      };
    }
  } catch (error) {
    return {
      test: 'Proxy Functionality',
      passed: false,
      message: `Proxy test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Run all tests
 */
export async function runAllTests(): Promise<TestResult[]> {
  console.log('Running EdgeFlow Proxy tests...');

  const tests = [
    testServiceWorker,
    testProxyConfig,
    testKVStore,
    testProxyFunctionality,
  ];

  const results: TestResult[] = [];

  for (const test of tests) {
    const result = await test();
    results.push(result);
    console.log(`${result.passed ? '✅' : '❌'} ${result.test}: ${result.message}`);
  }

  const passedTests = results.filter(r => r.passed).length;
  console.log(`\nTest Results: ${passedTests}/${results.length} tests passed`);

  return results;
}

/**
 * Generate test report
 */
export function generateTestReport(results: TestResult[]): string {
  const passedTests = results.filter(r => r.passed).length;
  const totalTests = results.length;
  const successRate = (passedTests / totalTests) * 100;

  let report = `# EdgeFlow Proxy Test Report\n\n`;
  report += `**Overall Results:** ${passedTests}/${totalTests} tests passed (${successRate.toFixed(1)}%)\n\n`;

  results.forEach((result, index) => {
    report += `## Test ${index + 1}: ${result.test}\n`;
    report += `- **Status:** ${result.passed ? '✅ PASSED' : '❌ FAILED'}\n`;
    report += `- **Message:** ${result.message}\n`;
    if (result.duration) {
      report += `- **Duration:** ${result.duration}ms\n`;
    }
    report += '\n';
  });

  return report;
}