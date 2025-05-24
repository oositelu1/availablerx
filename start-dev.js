import { config } from 'dotenv';
import { spawn } from 'child_process';

// Load environment variables
config();

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set in .env file');
  process.exit(1);
}

console.log('✅ Environment loaded successfully');
console.log('🚀 Starting DocumentTracker...\n');

// Start the development server
const child = spawn('tsx', ['server/index.ts'], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development' }
});

child.on('error', (error) => {
  console.error('Failed to start:', error);
});