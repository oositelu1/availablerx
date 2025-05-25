import http from 'http';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<h1>Node.js is working on localhost!</h1>');
});

// Try different host configurations
const host = '0.0.0.0'; // This binds to all interfaces
const port = 3333;

server.listen(port, host, () => {
  console.log(`Server running at http://localhost:${port}/`);
  console.log(`Also available at http://127.0.0.1:${port}/`);
  console.log(`And at http://192.168.1.152:${port}/`);
});