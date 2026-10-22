// app/service/src/server.js
const express = require('express');
const promClient = require('prom-client');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 8080;
const VERSION = process.env.APP_VERSION || 'v1';

// =========================
// PROMETHEUS METRICS SETUP
// =========================
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 1.5, 2, 5]
});

const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const palettesGenerated = new promClient.Counter({
  name: 'color_palettes_generated_total',
  help: 'Total number of color palettes generated',
  labelNames: ['version']
});

register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestsTotal);
register.registerMetric(palettesGenerated);

// =========================
// MIDDLEWARE
// =========================
app.use(express.json({ limit: '100kb' }));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Metrics collection middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || 'unmatched';
    httpRequestDuration.labels(req.method, route, res.statusCode).observe(duration);
    httpRequestsTotal.labels(req.method, route, res.statusCode).inc();
  });
  next();
});

// =========================
// COLOR GENERATION LOGIC
// =========================
function generatePalette(version = VERSION) {
  // Simple version-based color themes for visual canary demonstration
  // v1 = warm tones, v2 = cool tones (makes progressive delivery obvious)
  const colorSchemes = {
    v1: [0, 15, 30, 45, 350], // Warm: reds, oranges, yellows
    v2: [200, 180, 220, 240, 280] // Cool: blues, greens, purples
  };

  const baseHues = colorSchemes[version] || colorSchemes.v1;

  if (!colorSchemes[version]) {
    console.warn(`Unknown version: ${version}, defaulting to v1`);
  }

  return baseHues.map(hue => {
    const saturation = Math.max(65, Math.min(85, 65 + Math.random() * 20));
    const lightness = Math.max(50, Math.min(70, 50 + Math.random() * 20));
    return `hsl(${hue}, ${saturation.toFixed(1)}%, ${lightness.toFixed(1)}%)`;
  });
}

function unsafeColorValidation(input) {
  // Simulated security vulnerability for SAST/DAST demo purposes
  // In real scenarios, this would be actual SQL injection or XSS
  if (input && typeof input === 'string') {
    // Deliberately weak validation that security tools should flag
    if (input.includes('DROP') || input.includes('DELETE') || input.includes('--') || input.includes('<script>')) {
      throw new Error('Invalid input detected');
    }
  }
  return true;
}

// =========================
// HTML TEMPLATE
// =========================
function generateHTML(palette, version) {
  const versionInfo = version === 'v2'
    ? { title: 'Cool Palette', theme: 'Cool tones (Blues & Greens)' }
    : { title: 'Warm Palette', theme: 'Warm tones (Reds & Oranges)' };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Color Palette Generator - ${version}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #050505 0%, #1a1333 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      padding: 40px;
      max-width: 900px;
      width: 100%;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .version-badge {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 15px;
    }
    .emoji { font-size: 48px; margin-bottom: 10px; }
    h1 { color: #2d3748; font-size: 32px; margin-bottom: 8px; }
    .subtitle { color: #718096; font-size: 16px; }
    .palette {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 20px;
      margin: 30px 0;
    }
    .color-card {
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .color-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 8px 20px rgba(0,0,0,0.2);
    }
    .color-swatch {
      height: 120px;
      width: 100%;
    }
    .color-info {
      padding: 12px;
      background: #f7fafc;
      text-align: center;
    }
    .color-label {
      font-size: 12px;
      color: #718096;
      margin-bottom: 4px;
    }
    .color-value {
      font-size: 14px;
      font-weight: 600;
      color: #2d3748;
      font-family: 'Courier New', monospace;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin: 30px 0;
      padding: 20px;
      background: #f7fafc;
      border-radius: 12px;
    }
    .info-item {
      text-align: center;
    }
    .info-label {
      font-size: 12px;
      color: #718096;
      margin-bottom: 4px;
    }
    .info-value {
      font-size: 20px;
      font-weight: 700;
      color: #2d3748;
    }
    .actions {
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
    }
    .btn {
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      text-decoration: none;
      display: inline-block;
    }
    .btn-primary {
      background: #667eea;
      color: white;
    }
    .btn-primary:hover {
      background: #5568d3;
      transform: translateY(-2px);
    }
    .btn-secondary {
      background: #e2e8f0;
      color: #2d3748;
    }
    .btn-secondary:hover {
      background: #cbd5e0;
      transform: translateY(-2px);
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 2px solid #e2e8f0;
      color: #718096;
      font-size: 14px;
    }
    .toast {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #48bb78;
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      display: none;
      animation: slideIn 0.3s ease;
    }
    @keyframes slideIn {
      from { transform: translateX(400px); }
      to { transform: translateX(0); }
    }
    @media (max-width: 600px) {
      .container { padding: 20px; }
      .palette { grid-template-columns: 1fr; }
      .info-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="version-badge">Version ${version}</div>
      <div class="emoji">${versionInfo.emoji}</div>
      <h1>${versionInfo.title}</h1>
      <p class="subtitle">${versionInfo.theme}</p>
    </div>
    
    <div class="palette">
      ${palette.map((color, idx) => `
        <div class="color-card" onclick="copyColor('${color}')">
          <div class="color-swatch" style="background: ${color};"></div>
          <div class="color-info">
            <div class="color-label">Color #${idx + 1}</div>
            <div class="color-value">${color}</div>
          </div>
        </div>
      `).join('')}
    </div>
    
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Version</div>
        <div class="info-value">${version}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Colors</div>
        <div class="info-value">${palette.length}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Theme</div>
        <div class="info-value">${version === 'v2' ? 'Cool' : 'Warm'}</div>
      </div>
    </div>
    
    <div class="actions">
      <button class="btn btn-primary" onclick="location.reload()">Generate New Palette</button>
      <a href="/api" class="btn btn-secondary">View JSON API</a>
      <a href="/metrics" class="btn btn-secondary">Metrics</a>
    </div>
    
    <div class="footer">
      <strong>Color Palette API</strong> | DevSecOps Pipeline Demo<br>
      Click any color to copy • Refresh for new palette
    </div>
  </div>
  
  <div class="toast" id="toast">Color copied to clipboard!</div>
  
  <script>
    function copyColor(color) {
      navigator.clipboard.writeText(color).then(() => {
        const toast = document.getElementById('toast');
        toast.style.display = 'block';
        setTimeout(() => {
          toast.style.display = 'none';
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy:', err);
      });
    }
  </script>
</body>
</html>`;
}

// =========================
// ROUTES
// =========================

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    version: VERSION,
    timestamp: new Date().toISOString()
  });
});

// Readiness check
app.get('/ready', (req, res) => {
  res.status(200).json({
    status: 'ready',
    version: VERSION
  });
});

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  if (process.env.METRICS_TOKEN) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${process.env.METRICS_TOKEN}`) {
      return res.status(403).end();
    }
  }
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Rate limiter - excludes monitoring endpoints
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const monitoringPaths = ['/health', '/ready', '/metrics'];
    return monitoringPaths.includes(req.path);
  },
  // Use a store that can be reset for testing
  ...(process.env.NODE_ENV === 'test' && {
    skipFailedRequests: false,
    skipSuccessfulRequests: false
  })
});

app.use(limiter);

// Main endpoint: Visual HTML palette
app.get('/', (req, res) => {
  try {
    const palette = generatePalette(VERSION);
    palettesGenerated.labels(VERSION).inc();
    const html = generateHTML(palette, VERSION);
    res.status(200).send(html);
  } catch (error) {
    console.error('Error generating palette:', error);
    res.status(500).json({
      error: 'Failed to generate palette',
      version: VERSION
    });
  }
});

// JSON API endpoint
app.get('/api', (req, res) => {
  try {
    const palette = generatePalette(VERSION);
    palettesGenerated.labels(VERSION).inc();
    res.status(200).json({
      version: VERSION,
      palette: palette,
      timestamp: new Date().toISOString(),
      message: `Palette generated by ${VERSION}`,
      theme: VERSION === 'v2' ? 'cool' : 'warm'
    });
  } catch (error) {
    console.error('Error generating palette:', error);
    res.status(500).json({
      error: 'Failed to generate palette',
      version: VERSION
    });
  }
});

// POST endpoint with validation
app.post('/palette', (req, res) => {
  try {
    const { seedColor } = req.body;

    // Always validate input (security vulnerability fix)
    unsafeColorValidation(seedColor);

    const palette = generatePalette(VERSION);
    palettesGenerated.labels(VERSION).inc();

    res.status(200).json({
      version: VERSION,
      palette: palette,
      seedColor: seedColor || 'random',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Validation error:', error);
    res.status(400).json({
      error: error.message,
      version: VERSION
    });
  }
});

// Simulate error for rollback demo
app.get('/error', (req, res) => {
  res.status(500).json({
    error: 'Intentional error for testing rollback',
    version: VERSION
  });
});

// Version endpoint
app.get('/version', (req, res) => {
  res.status(200).json({
    version: VERSION,
    node: process.version,
    uptime: process.uptime()
  });
});

// 404 handler - must be after all other routes
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    version: VERSION,
    message: 'The requested resource does not exist'
  });
});

// Global error handler - must be last
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  // Handle JSON parse errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'Invalid JSON',
      version: VERSION
    });
  }
  
  res.status(500).json({
    error: 'Internal server error',
    version: VERSION,
    ...(process.env.NODE_ENV === 'development' && {
      message: err.message,
      stack: err.stack
    })
  });
});

// =========================
// SERVER START
// =========================
let server;
const connections = new Set();

if (require.main === module) {
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Color Palette API ${VERSION} running on port ${PORT}`);
    console.log(`Metrics available at http://localhost:${PORT}/metrics`);
    console.log(`Health check at http://localhost:${PORT}/health`);
    console.log(`Visual UI at http://localhost:${PORT}/`);
    console.log(`JSON API at http://localhost:${PORT}/api`);
    console.log(`Environment: ${process.env.NODE_ENV || 'test'}`);
  });

  // Track connections for graceful shutdown
  server.on('connection', (conn) => {
    connections.add(conn);
    conn.on('close', () => {
      connections.delete(conn);
    });
  });

  // Graceful shutdown with timeout
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');

    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });

    // Force close lingering connections after 10s
    setTimeout(() => {
      console.warn('Forcing shutdown, closing open connections');
      connections.forEach((conn) => conn.destroy());
      process.exit(1);
    }, 10000);
  });
}

module.exports = app;