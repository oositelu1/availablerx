import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { s3Monitor } from "./s3-monitor";
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Serve the app on port 3000 (or PORT env variable)
  // this serves both the API and the client.
  const port = process.env.PORT || 3000;
  server.listen(port as number, async () => {
    log(`serving on port ${port}`);
    console.log(`\n🌐 Access your app at:`);
    console.log(`   http://localhost:${port}`);
    console.log(`   http://127.0.0.1:${port}`);
    console.log(`   http://192.168.1.152:${port}`);
    console.log(`\n✨ Try all three URLs above!\n`);
    
    // Start the S3 bucket monitor if AWS credentials are configured
    if (process.env.AWS_REGION && process.env.AWS_S3_BUCKET) {
      try {
        // Dynamic import for ES modules
        const { s3Monitor } = await import('./s3-monitor.js');
        // Check for monitoring interval from environment or default to 5 minutes
        const monitorInterval = parseInt(process.env.S3_MONITOR_INTERVAL || '5');
        log(`Starting S3 bucket monitor with ${monitorInterval} minute interval`);
        s3Monitor.start(monitorInterval);
      } catch (err) {
        const error = err as Error;
        log(`Error starting S3 monitor: ${error.message}`);
      }
    } else {
      log('AWS credentials not configured - S3 monitor not started');
    }
  });
})();
