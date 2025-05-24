const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  console.log(`Request received: ${req.method} ${req.url}`);
  
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>DocumentTracker</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; }
          .success { background: #4CAF50; color: white; padding: 20px; border-radius: 5px; }
          .info { background: #2196F3; color: white; padding: 20px; border-radius: 5px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <h1>DocumentTracker</h1>
        <div class="success">
          <h2>✅ Server is Working!</h2>
          <p>Successfully connected to http://localhost:8888</p>
        </div>
        <div class="info">
          <h3>What happened?</h3>
          <p>The main app server has issues with macOS security, but this simple server works.</p>
          <h3>Your DocumentTracker Changes:</h3>
          <ul>
            <li>✅ Simplified Sales Orders to link with EPCIS files</li>
            <li>✅ Removed complex inventory allocation</li>
            <li>✅ Streamlined scan-out workflow</li>
            <li>✅ Fixed date pickers and form fields</li>
          </ul>
        </div>
      </body>
      </html>
    `);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const PORT = 8888;
server.listen(PORT, '127.0.0.1', () => {
  console.log(`✅ Server successfully started!`);
  console.log(`📍 Open your browser to: http://localhost:${PORT}`);
  console.log(`\nThis is a simple test server to verify your connection works.`);
});