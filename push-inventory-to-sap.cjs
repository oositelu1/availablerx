// Simple Inventory Push to SAP
const https = require('https');

const config = {
  baseUrl: 'https://my347887.sapbydesign.com',
  username: 'FOSITELU',
  password: 'Babyboo100100!!!'
};

// Product data from validated DocumentTracker item
const inventoryItem = {
  gtin: '00363391105046',
  lotNumber: 'LOT2024ABC',
  serialNumber: 'SN123456789',
  expirationDate: '2026-12-31',
  quantity: 1,
  warehouseLocation: 'MAIN'
};

console.log('Pushing Inventory to SAP');
console.log('========================\n');
console.log('Product Details:');
console.log(`GTIN: ${inventoryItem.gtin}`);
console.log(`Lot #: ${inventoryItem.lotNumber}`);
console.log(`Serial: ${inventoryItem.serialNumber}`);
console.log(`Expiration: ${inventoryItem.expirationDate}`);
console.log(`Quantity: ${inventoryItem.quantity}`);
console.log('');

// SAP request helper
function sapRequest(method, endpoint, data = null) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
    const url = new URL(`${config.baseUrl}${endpoint}`);
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + (url.search || ''),
      method: method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));
    }
    
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: res.headers,
          data: responseData
        });
      });
    });
    
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function pushInventory() {
  try {
    // The inventory data structure for SAP
    const inventoryData = {
      MaterialID: inventoryItem.gtin,
      LocationID: inventoryItem.warehouseLocation,
      IdentifiedStockID: inventoryItem.serialNumber,
      BatchID: inventoryItem.lotNumber,
      ExpirationDate: inventoryItem.expirationDate,
      Quantity: {
        Amount: inventoryItem.quantity,
        unitCode: 'EA'
      },
      InventoryMovementType: 'GOODS_RECEIPT',
      SourceDocument: 'DOCUMENTTRACKER',
      PostingDate: new Date().toISOString().split('T')[0]
    };
    
    console.log('Inventory Data to Push:');
    console.log(JSON.stringify(inventoryData, null, 2));
    console.log('');
    
    // Try different possible endpoints
    const endpoints = [
      '/sap/byd/odata/cust/v1/inventory/',
      '/sap/byd/odata/cust/v1/vmumaterial/InventoryCollection',
      '/sap/byd/odata/analytics/ds/Inventory.svc/'
    ];
    
    console.log('Testing SAP Endpoints...\n');
    
    for (const endpoint of endpoints) {
      console.log(`Trying: ${endpoint}`);
      try {
        const response = await sapRequest('GET', endpoint);
        console.log(`Status: ${response.status} ${response.statusText}`);
        
        if (response.status === 200) {
          console.log('✅ Endpoint available!');
          
          // Show metadata
          if (endpoint.includes('$metadata')) {
            console.log('Metadata:', response.data.substring(0, 200) + '...');
          }
        } else {
          console.log('❌ Not accessible');
        }
      } catch (error) {
        console.log('❌ Error:', error.message);
      }
      console.log('');
    }
    
    console.log('\nNOTE: To complete the integration:');
    console.log('1. Work with your SAP admin to identify the correct inventory endpoint');
    console.log('2. Determine the exact data structure required by your SAP instance');
    console.log('3. Common operations include:');
    console.log('   - Goods Receipt (incoming inventory)');
    console.log('   - Physical Inventory Count');
    console.log('   - Stock Transfer');
    console.log('\nThe validated product data from DocumentTracker is ready to push!');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Function that would be called from DocumentTracker
function pushValidatedProductToSAP(product) {
  console.log('\n--- This function would be called from DocumentTracker ---');
  console.log('After successful validation (EPCIS + Barcode match):');
  console.log('1. Extract product details');
  console.log('2. Format for SAP');
  console.log('3. Push to SAP inventory');
  console.log('4. Store SAP response in DocumentTracker');
  console.log('5. Update UI to show sync status');
}

// Run the demo
pushInventory();