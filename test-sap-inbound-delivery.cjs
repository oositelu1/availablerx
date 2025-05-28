// Test SAP Inbound Delivery Service
const https = require('https');

const config = {
  baseUrl: 'https://my347887.sapbydesign.com',
  username: 'FOSITELU',
  password: 'Babyboo100100!!!'
};

console.log('SAP Inbound Delivery Service Test');
console.log('=================================\n');

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

async function testInboundDelivery() {
  try {
    // 1. First, let's check the metadata to understand the structure
    console.log('1. Checking Service Metadata...');
    const metadataResponse = await sapRequest('GET', '/sap/byd/odata/cust/v1/khinbounddelivery/$metadata');
    
    if (metadataResponse.status === 200) {
      console.log('✅ Metadata accessible');
      // Save metadata for review
      const fs = require('fs');
      fs.writeFileSync('sap-inbound-delivery-metadata.xml', metadataResponse.data);
      console.log('   Metadata saved to: sap-inbound-delivery-metadata.xml');
    }
    
    // 2. Check available collections
    console.log('\n2. Checking Service Collections...');
    const serviceResponse = await sapRequest('GET', '/sap/byd/odata/cust/v1/khinbounddelivery/');
    
    if (serviceResponse.status === 200) {
      console.log('✅ Service accessible');
      const data = JSON.parse(serviceResponse.data);
      if (data.d && data.d.EntitySets) {
        console.log('   Available collections:');
        data.d.EntitySets.forEach(set => console.log(`   - ${set}`));
      }
    }
    
    // 3. Example validated product from DocumentTracker
    console.log('\n3. Validated Product Data:');
    const validatedProduct = {
      gtin: '00363391105046',
      lotNumber: 'LOT2024ABC',
      serialNumber: 'SN123456789',
      expirationDate: '2026-12-31',
      quantity: 10,
      productName: 'AMOXICILLIN 500MG',
      warehouseLocation: 'MAIN'
    };
    
    console.log(JSON.stringify(validatedProduct, null, 2));
    
    // 4. Format for inbound delivery
    console.log('\n4. Formatted for Inbound Delivery:');
    const inboundDeliveryData = {
      // Common fields for inbound delivery
      DeliveryDate: new Date().toISOString(),
      SupplierID: 'DOCUMENTTRACKER',
      Items: [{
        MaterialID: validatedProduct.gtin,
        MaterialDescription: validatedProduct.productName,
        BatchID: validatedProduct.lotNumber,
        SerialNumberID: validatedProduct.serialNumber,
        ExpirationDate: validatedProduct.expirationDate,
        DeliveredQuantity: {
          Amount: validatedProduct.quantity,
          unitCode: 'EA'
        },
        PlantID: validatedProduct.warehouseLocation
      }]
    };
    
    console.log(JSON.stringify(inboundDeliveryData, null, 2));
    
    // 5. Try to get existing inbound deliveries (if collection exists)
    console.log('\n5. Checking for Inbound Delivery Collections...');
    const possibleCollections = [
      'InboundDeliveryCollection',
      'InboundDelivery',
      'DeliveryCollection',
      'khInboundDeliveryCollection'
    ];
    
    for (const collection of possibleCollections) {
      try {
        const response = await sapRequest('GET', `/sap/byd/odata/cust/v1/khinbounddelivery/${collection}?$top=1`);
        if (response.status === 200) {
          console.log(`✅ Found collection: ${collection}`);
          const data = JSON.parse(response.data);
          console.log(`   Sample structure:`, JSON.stringify(data.d.results?.[0] || data.d, null, 2).substring(0, 200) + '...');
          break;
        } else {
          console.log(`❌ ${collection}: ${response.status}`);
        }
      } catch (error) {
        console.log(`❌ ${collection}: Error`);
      }
    }
    
    console.log('\n6. Integration Notes:');
    console.log('   - Use the metadata to understand exact field names');
    console.log('   - Map DocumentTracker fields to SAP fields');
    console.log('   - Create inbound delivery when products are validated');
    console.log('   - This automatically updates SAP inventory');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the test
testInboundDelivery();