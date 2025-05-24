// Simple setup script for local development
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up DocumentTracker for local development...\n');

// Create a simple .env.development file
const envContent = `# Local Development Configuration
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/documenttracker"
SESSION_SECRET="dev-secret-key-change-in-production"

# Optional: Email settings (leave empty for development)
SENDGRID_API_KEY=""
SENDGRID_FROM_EMAIL="noreply@localhost"
SENDGRID_FROM_NAME="DocumentTracker Dev"

# Optional: AWS settings (leave empty for development)
AWS_REGION=""
AWS_S3_BUCKET=""
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
`;

// Check if .env exists
if (!fs.existsSync('.env')) {
  fs.writeFileSync('.env', envContent);
  console.log('✅ Created .env file');
} else {
  console.log('⚠️  .env file already exists');
  console.log('   You need to add DATABASE_URL to your .env file');
  console.log('   Add this line:');
  console.log('   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/documenttracker"');
}

console.log('\n📝 Next steps:');
console.log('1. Install PostgreSQL if you haven\'t already:');
console.log('   Mac: brew install postgresql');
console.log('   Windows: Download from https://www.postgresql.org/download/windows/');
console.log('   Linux: sudo apt-get install postgresql');
console.log('');
console.log('2. Start PostgreSQL:');
console.log('   Mac: brew services start postgresql');
console.log('   Others: Check PostgreSQL documentation');
console.log('');
console.log('3. Create the database:');
console.log('   createdb documenttracker');
console.log('');
console.log('4. Run the app:');
console.log('   npm run dev');
console.log('');
console.log('5. Open your browser to:');
console.log('   http://localhost:3000');
console.log('');
console.log('Default login: admin / admin123');