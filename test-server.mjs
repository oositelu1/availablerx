import { createServer } from 'http';

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Server is working\!');
});

const port = 3000;
server.listen(port, '127.0.0.1', () => {
  console.log('Test server running at http://127.0.0.1:' + port + '/');
});
