// List products in SAP to find correct GTINs
const https = require('https');

const config = {
  baseUrl: 'https://my347887.sapbydesign.com',
  username: 'FOSITELU',
  password: 'Babyboo100100!!!'
};

console.log('Listing Products in SAP ByDesign');
console.log('================================\n');

function makeRequest(endpoint) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
    const url = new URL(`${config.baseUrl}${endpoint}`);
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + (url.search || ''),
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Status ${res.statusCode}: ${res.statusMessage}`));
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function listProducts() {
  try {
    // Get first 10 products
    const response = await makeRequest('/sap/byd/odata/cust/v1/vmumaterial/MaterialCollection?$top=10&$format=json');
    
    if (response.d && response.d.results) {
      console.log(`Found ${response.d.results.length} products:\n`);
      
      response.d.results.forEach((product, index) => {
        console.log(`${index + 1}. ${product.Description || 'No description'}`);
        console.log(`   Internal ID: ${product.InternalID}`);
        console.log(`   GTIN: ${product.GTIN || 'Not set'}`);
        console.log(`   Base Unit: ${product.BaseMeasureUnitCode || 'N/A'}`);
        console.log(`   Status: ${product.LifeCycleStatusCode || 'N/A'}`);
        console.log('');
      });
      
      console.log('\nTo enable SAP integration:');
      console.log('1. Ensure products have GTIN numbers in SAP');
      console.log('2. Map your EPCIS GTINs to SAP Internal IDs');
      console.log('3. Configure inventory posting endpoints');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

listProducts();