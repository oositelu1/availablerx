import { createServer } from 'net';

const server = createServer((socket) => {
  console.log('Client connected!');
  socket.write('HTTP/1.1 200 OK\r\n');
  socket.write('Content-Type: text/plain\r\n');
  socket.write('\r\n');
  socket.write('Server is working!\n');
  socket.end();
});

server.on('error', (err) => {
  console.error('Server error:', err);
});

server.listen(3001, '127.0.0.1', () => {
  console.log('Debug server listening on 127.0.0.1:3001');
  console.log('Try: curl http://127.0.0.1:3001');
});