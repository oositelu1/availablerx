import { config } from 'dotenv';
import http from 'http';

// Load environment variables
config();

console.log('Testing DocumentTracker setup...\n');

// Check database URL
if (process.env.DATABASE_URL) {
  console.log('✅ DATABASE_URL is set');
} else {
  console.log('❌ DATABASE_URL is missing');
}

// Try to connect to localhost:3000
const req = http.get('http://localhost:3000', (res) => {
  console.log('✅ Server is responding on port 3000');
  console.log(`   Status: ${res.statusCode}`);
  process.exit(0);
});

req.on('error', (err) => {
  if (err.code === 'ECONNREFUSED') {
    console.log('❌ Server is not running on port 3000');
    console.log('   Make sure to run: npm run dev');
  } else {
    console.log('❌ Error connecting:', err.message);
  }
  process.exit(1);
});

setTimeout(() => {
  console.log('⏱️  Connection test timed out');
  process.exit(1);
}, 5000);