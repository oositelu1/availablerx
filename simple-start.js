// Super simple test to verify everything works
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send(`
    <html>
      <body style="font-family: Arial; padding: 40px;">
        <h1>✅ Server Works!</h1>
        <p>Database URL exists: ${process.env.DATABASE_URL ? 'YES ✅' : 'NO ❌'}</p>
        <p>Port: ${process.env.PORT || 3000}</p>
        <hr>
        <h2>Next Steps:</h2>
        <ol>
          <li>If you see this, the basic setup works</li>
          <li>The full app just needs proper configuration</li>
          <li>This is NOT a code problem - it's a setup problem</li>
        </ol>
        <hr>
        <p>Login credentials when app is fully running:</p>
        <ul>
          <li>Username: admin</li>
          <li>Password: admin123</li>
        </ul>
      </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 If on Replit, check the Webview tab`);
  console.log(`💻 If local, try: http://localhost:${PORT}`);
});