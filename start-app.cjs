const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = 8080; // Using 8080 to avoid conflicts

// Serve static files from the client build
app.use(express.static(path.join(__dirname, 'dist/public')));

// API route for testing
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    database: process.env.DATABASE_URL ? 'connected' : 'not connected',
    time: new Date()
  });
});

// Serve the app
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'dist/public/index.html');
  
  // Check if built files exist
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // If no build, show setup instructions
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>DocumentTracker Setup</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              max-width: 800px;
              margin: 0 auto;
              padding: 40px 20px;
              background: #f5f5f5;
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            h1 { color: #333; }
            .success { 
              background: #4caf50; 
              color: white; 
              padding: 15px; 
              border-radius: 5px;
              margin: 20px 0;
            }
            .warning {
              background: #ff9800;
              color: white;
              padding: 15px;
              border-radius: 5px;
              margin: 20px 0;
            }
            code {
              background: #f5f5f5;
              padding: 2px 6px;
              border-radius: 3px;
              font-family: 'Courier New', monospace;
            }
            .login-info {
              background: #e3f2fd;
              padding: 20px;
              border-radius: 5px;
              margin: 20px 0;
            }
            button {
              background: #2196f3;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 5px;
              cursor: pointer;
              font-size: 16px;
            }
            button:hover {
              background: #1976d2;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🚀 DocumentTracker</h1>
            
            <div class="success">
              ✅ Server is running successfully on port ${PORT}!
            </div>
            
            <div class="warning">
              ⚠️ The React app hasn't been built yet. 
            </div>
            
            <h2>Quick Setup:</h2>
            <ol>
              <li>Open a <strong>new Terminal tab</strong> (Cmd+T)</li>
              <li>Run these commands:
                <pre>cd /Users/fisayoositelu/Downloads/DocumentTracker
npm run build</pre>
              </li>
              <li>Wait for build to complete (about 30 seconds)</li>
              <li>Refresh this page</li>
            </ol>
            
            <div class="login-info">
              <h3>📋 Login Credentials (save these!):</h3>
              <p><strong>Username:</strong> admin</p>
              <p><strong>Password:</strong> admin123</p>
            </div>
            
            <h3>🔧 Test API:</h3>
            <button onclick="testAPI()">Test API Connection</button>
            <div id="api-result"></div>
            
            <script>
              async function testAPI() {
                try {
                  const response = await fetch('/api/health');
                  const data = await response.json();
                  document.getElementById('api-result').innerHTML = 
                    '<pre style="background:#f5f5f5;padding:10px;margin-top:10px;">' + 
                    JSON.stringify(data, null, 2) + 
                    '</pre>';
                } catch (error) {
                  document.getElementById('api-result').innerHTML = 
                    '<p style="color:red;">Error: ' + error.message + '</p>';
                }
              }
            </script>
          </div>
        </body>
      </html>
    `);
  }
});

// Start server - this will work!
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('\n========================================');
  console.log('✅ DocumentTracker is running!');
  console.log('========================================');
  console.log(`\n📱 Open your browser to:`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   http://127.0.0.1:${PORT}`);
  console.log('\nPress Ctrl+C to stop\n');
});

// Handle errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use!`);
    console.error('Another application is using this port.');
    console.error('\nTry these solutions:');
    console.error('1. Close any other servers running');
    console.error('2. Or change the PORT number in this file\n');
  } else {
    console.error('Server error:', error);
  }
  process.exit(1);
});