// Test SAP Material endpoint
const https = require('https');

// Your SAP credentials
const config = {
  baseUrl: 'https://my347887.sapbydesign.com',
  username: 'FOSITELU',
  password: 'Babyboo100100!!!'
};

console.log('Testing SAP ByDesign Material Endpoint...\n');

// Test different endpoints
const endpoints = [
  '/sap/byd/odata/cust/v1/vmumaterial/',
  '/sap/byd/odata/cust/v1/vmumaterial/MaterialCollection',
  '/sap/byd/odata/v1/c4codata/',
  '/sap/byd/odata/analytics/ds/Inventory.svc/'
];

function testEndpoint(endpoint) {
  return new Promise((resolve) => {
    const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
    const url = new URL(`${config.baseUrl}${endpoint}`);
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log(`Endpoint: ${endpoint}`);
        console.log(`Status: ${res.statusCode} ${res.statusMessage}`);
        if (res.statusCode === 200) {
          console.log('✅ SUCCESS!');
          console.log(`Response preview: ${data.substring(0, 100)}...`);
        } else if (res.statusCode === 401) {
          console.log('❌ Authentication failed');
        } else {
          console.log('❌ Failed');
        }
        console.log('---\n');
        resolve();
      });
    });
    
    req.on('error', (error) => {
      console.log(`Endpoint: ${endpoint}`);
      console.log(`Error: ${error.message}`);
      console.log('---\n');
      resolve();
    });
    
    req.end();
  });
}

// Test all endpoints
async function runTests() {
  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
  }
  
  console.log('\nTesting complete!');
  console.log('\nIf all endpoints failed with 401, check your credentials.');
  console.log('If they failed with 404, the endpoint path might be incorrect.');
  console.log('If they failed with 400, there might be missing parameters.');
}

runTests();