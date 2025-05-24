import express from 'express';

const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>✅ Server is working!</h1>
        <p>DocumentTracker test server is running on port ${port}</p>
        <p>If you can see this, your setup is working correctly.</p>
        <p>The issue might be with the main app startup.</p>
      </body>
    </html>
  `);
});

app.listen(port, () => {
  console.log(`Test server running at http://localhost:${port}`);
  console.log('Open your browser to http://localhost:3000');
  console.log('Press Ctrl+C to stop');
});