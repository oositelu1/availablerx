// Simple SAP connection test
const https = require('https');

// Your SAP credentials from .env.local
const config = {
  baseUrl: 'https://my347887.sapbydesign.com',
  username: 'FOSITELU',
  password: 'Babyboo100100!!!'
};

console.log('Testing SAP ByDesign Connection...\n');

// Create basic auth
const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');

// Parse URL
const url = new URL(`${config.baseUrl}/sap/byd/odata/v1/`);

// Request options
const options = {
  hostname: url.hostname,
  port: 443,
  path: url.pathname,
  method: 'GET',
  headers: {
    'Authorization': `Basic ${auth}`,
    'Accept': 'application/json'
  }
};

// Make request
const req = https.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log(`Status Message: ${res.statusMessage}\n`);
  
  if (res.statusCode === 200) {
    console.log('✅ SUCCESS: Connected to SAP ByDesign!');
  } else if (res.statusCode === 401) {
    console.log('❌ FAILED: Invalid credentials');
  } else {
    console.log('❌ FAILED: Connection error');
  }
  
  // Get response data
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('\nResponse preview:', data.substring(0, 200) + '...');
    }
  });
});

req.on('error', (error) => {
  console.error('Connection error:', error.message);
});

req.end();