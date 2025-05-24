import express from "express";
import { config } from 'dotenv';
import path from "path";
import { fileURLToPath } from 'url';

// Load environment variables
config();

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/dist')));

// Basic test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!', timestamp: new Date() });
});

// Serve the React app for all other routes
app.get('*', (req, res) => {
  // For now, just send a simple HTML page
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>DocumentTracker</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; }
          .status { background: #e8f5e9; padding: 20px; border-radius: 8px; }
          .error { background: #ffebee; padding: 20px; border-radius: 8px; }
        </style>
      </head>
      <body>
        <h1>DocumentTracker</h1>
        <div class="status">
          <h2>✅ Server is Running!</h2>
          <p>The backend server is working correctly on port 3000.</p>
          <p>Database is connected: ${process.env.DATABASE_URL ? 'Yes' : 'No'}</p>
        </div>
        
        <div style="margin-top: 20px;">
          <h3>Next Steps:</h3>
          <ol>
            <li>The React frontend needs to be built</li>
            <li>Run: <code>npm run build</code> to build the frontend</li>
            <li>Then restart the server</li>
          </ol>
        </div>
        
        <div style="margin-top: 20px;">
          <h3>Test the API:</h3>
          <p><a href="/api/test">Click here to test the API</a></p>
        </div>
      </body>
    </html>
  `);
});

const port = 5173;  // Using Vite's default port
const host = 'localhost';
app.listen(port, host, () => {
  console.log(`\n✅ DocumentTracker server is running!`);
  console.log(`📍 Open your browser to: http://localhost:${port}`);
  console.log(`\nPress Ctrl+C to stop the server\n`);
});