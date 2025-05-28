// Test pushing inventory to SAP ByDesign
const https = require('https');

// Your SAP credentials
const config = {
  baseUrl: 'https://my347887.sapbydesign.com',
  username: 'FOSITELU',
  password: 'Babyboo100100!!!'
};

// Sample product data to push
const testProduct = {
  gtin: '00301430957010',
  productName: 'SODIUM FERRIC GLUCONATE',
  serialNumber: 'SN123456789',
  lotNumber: 'LOT2024001',
  expirationDate: '2026-12-31',
  quantity: 10,
  warehouseLocation: 'MAIN'
};

console.log('SAP Inventory Push Test');
console.log('=======================\n');
console.log('Test Product:', testProduct);
console.log('\n');

// Function to make HTTP request
function makeRequest(method, endpoint, data = null) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
    const url = new URL(`${config.baseUrl}${endpoint}`);
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      const jsonData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(jsonData);
    }
    
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          statusMessage: res.statusMessage,
          data: responseData
        });
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function runTest() {
  try {
    // Step 1: Check if product exists in SAP
    console.log('1. Checking if product exists in SAP...');
    const searchResult = await makeRequest(
      'GET', 
      `/sap/byd/odata/cust/v1/vmumaterial/MaterialCollection?$filter=GTIN eq '${testProduct.gtin}'`
    );
    
    console.log(`   Status: ${searchResult.status}`);
    
    if (searchResult.status === 200) {
      const data = JSON.parse(searchResult.data);
      const results = data.d?.results || [];
      
      if (results.length > 0) {
        console.log('   ✅ Product found in SAP!');
        console.log(`   Material ID: ${results[0].InternalID}`);
        console.log(`   Description: ${results[0].Description}`);
        
        // Step 2: Create inventory adjustment
        console.log('\n2. Creating inventory adjustment...');
        
        // This is a simplified example - actual implementation would need:
        // - Proper inventory document creation
        // - Location/warehouse mapping
        // - Unit of measure handling
        
        const inventoryData = {
          MaterialInternalID: results[0].InternalID,
          LocationID: testProduct.warehouseLocation,
          InventoryRestrictedUseIndicator: false,
          LotNumber: testProduct.lotNumber,
          ExpirationDate: testProduct.expirationDate,
          Quantity: {
            Amount: testProduct.quantity,
            unitCode: 'EA' // Each
          },
          SerialNumbers: [testProduct.serialNumber]
        };
        
        console.log('   Inventory data:', JSON.stringify(inventoryData, null, 2));
        
        // Note: The actual endpoint for inventory posting would depend on your SAP configuration
        // Common endpoints might be:
        // - /sap/byd/odata/cust/v1/vmumaterial/GoodsMovementCollection
        // - /sap/byd/odata/analytics/ds/Inventory.svc/
        
        console.log('\n   ⚠️  Note: Actual inventory posting requires specific SAP endpoint configuration');
        console.log('   Common integration patterns:');
        console.log('   - Goods Receipt for incoming inventory');
        console.log('   - Goods Issue for outgoing inventory');
        console.log('   - Physical Inventory Count for adjustments');
        
      } else {
        console.log('   ❌ Product not found in SAP');
        console.log('   The product must be created in SAP before inventory can be posted');
      }
    } else {
      console.log('   ❌ Failed to search for product');
    }
    
    // Step 3: Show integration workflow
    console.log('\n3. DocumentTracker Integration Workflow:');
    console.log('   a) When EPCIS file is uploaded and validated');
    console.log('   b) Extract product details (GTIN, Serial, Lot, etc.)');
    console.log('   c) Check if products exist in SAP');
    console.log('   d) Create inventory movements in SAP');
    console.log('   e) Update DocumentTracker with SAP transaction IDs');
    
    console.log('\n4. Next Steps:');
    console.log('   - Configure specific SAP endpoints for your inventory process');
    console.log('   - Map DocumentTracker locations to SAP warehouse codes');
    console.log('   - Set up automated sync on EPCIS file validation');
    console.log('   - Handle error cases and retries');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

runTest();