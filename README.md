# EdgeFlow Proxy

A novel web proxy application that leverages Service Workers, Scramjet, and Vercel Functions to provide a distributed, performant, and censorship-resistant web proxy solution.

## Architecture Overview

This application implements a three-layer architecture:

1. **Client-Side Interception Layer**: Service Worker intercepts network requests in the browser
2. **Edge Processing Layer**: Vercel Functions handle proxy logic and content transformation
3. **Control Plane**: Serverless configuration management and monitoring

## Key Features

- **Service Worker Integration**: Client-side request interception and caching
- **Scramjet Techniques**: Advanced censorship evasion and content transformation
- **Vercel Edge Functions**: Globally distributed, serverless proxy processing
- **Multi-Layer Caching**: Service Worker cache, Edge cache, and origin caching
- **Real-time Configuration**: Dynamic proxy rule management
- **Comprehensive Logging**: Detailed monitoring and analytics

## Tech Stack

- **Frontend**: Next.js 14+ with TypeScript
- **Service Worker**: Modern web APIs for request interception
- **Edge Processing**: Vercel Functions with Edge Runtime
- **Configuration**: Vercel Edge Config and KV Store
- **Deployment**: Vercel platform

## Getting Started

### Prerequisites

- Node.js 18+
- Vercel CLI
- Git

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd edgeflow-proxy
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Configure the following environment variables:
```env
# Vercel Edge Config
EDGE_CONFIG=

# Vercel KV Store
KV_URL=
KV_REST_API_URL=
KV_REST_API_TOKEN=
KV_REST_API_READ_ONLY_TOKEN=

# Optional: Analytics
VERCEL_ANALYTICS=
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

### Deploy to Vercel

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy the application:
```bash
vercel --prod
```

3. Set up Edge Config:
```bash
vercel edge-config create
```

4. Configure KV Store:
```bash
vercel kv add
```

## Configuration

### Proxy Rules

Configure proxy behavior through the `/api/config` endpoint:

```typescript
{
  "enabled": true,
  "cacheTTL": 3600,
  "maxContentLength": 10485760,
  "allowedDomains": [],
  "blockedDomains": [],
  "transformRules": [
    {
      "pattern": "blocked-site\\.com",
      "replacement": "proxy-site.com",
      "type": "url"
    }
  ]
}
```

### Scramjet Techniques

The application implements various censorship evasion techniques:

- **URL Rewriting**: Dynamic URL transformation
- **Header Manipulation**: User-Agent and Referer spoofing
- **Content Transformation**: DOM and content modification
- **Domain Fronting**: Routing through legitimate domains

## API Endpoints

### Proxy API
- `POST /api/proxy` - Process proxy requests
- `GET /api/proxy?url=<url>` - Direct proxy access

### Configuration API
- `GET /api/config` - Retrieve current configuration
- `POST /api/config` - Update configuration

### Logs API
- `GET /api/logs` - Retrieve log entries
- `POST /api/logs` - Submit log entry
- `DELETE /api/logs` - Clean up old logs

## Security Considerations

- All communications use HTTPS
- Input validation and sanitization
- Rate limiting on edge functions
- CORS configuration for cross-origin requests
- Service Worker scope restrictions

## Performance Features

- **Edge Caching**: Vercel Edge Cache for fast content delivery
- **Service Worker Cache**: Browser-level caching for static assets
- **Request Deduplication**: Avoid duplicate requests
- **Connection Pooling**: Efficient network resource usage

## Monitoring

Access logs and metrics through:
- `/api/logs` - Application logs
- Vercel Analytics dashboard
- Edge Function metrics

## Development

### Project Structure

```
├── app/                 # Next.js app directory
│   ├── globals.css     # Global styles
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Main page
├── api/                # Vercel Functions
│   ├── config/         # Configuration management
│   ├── logs/           # Logging system
│   └── proxy/          # Core proxy logic
├── lib/                # Utility functions
├── public/             # Static assets
│   ├── sw.js          # Service Worker
│   └── manifest.json  # PWA manifest
└── types/              # TypeScript definitions
```

### Adding New Features

1. **Proxy Rules**: Add rules in `/api/proxy/route.ts`
2. **Transformations**: Extend the `ScramjetEngine` class
3. **Caching**: Modify caching strategies in Service Worker
4. **Configuration**: Update config interfaces and validation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the API reference

## Changelog

### Version 2.1.0
- Enhanced Scramjet evasion techniques
- Improved caching strategies
- Added comprehensive logging
- Updated to Next.js 14
- Added PWA support
