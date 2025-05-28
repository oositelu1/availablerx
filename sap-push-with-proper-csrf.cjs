// SAP Push with Proper CSRF Token Handling
const https = require('https');

const config = {
  baseUrl: 'https://my347887.sapbydesign.com',
  username: 'FOSITELU',
  password: 'Babyboo100100!!!'
};

// Store CSRF token
let csrfToken = null;

console.log('SAP Inbound Delivery with CSRF Token');
console.log('=====================================\n');

// Enhanced SAP request helper
function sapRequest(method, endpoint, data = null, options = {}) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
    const url = new URL(`${config.baseUrl}${endpoint}`);
    
    const requestOptions = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + (url.search || ''),
      method: method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers
      }
    };
    
    // Add CSRF token handling
    if (options.fetchToken) {
      requestOptions.headers['X-CSRF-Token'] = 'fetch';
    } else if (csrfToken && method !== 'GET') {
      requestOptions.headers['X-CSRF-Token'] = csrfToken;
    }
    
    if (data) {
      const jsonData = JSON.stringify(data);
      requestOptions.headers['Content-Length'] = Buffer.byteLength(jsonData);
    }
    
    const req = https.request(requestOptions, (res) => {
      let responseData = '';
      
      // Capture CSRF token from response
      if (res.headers['x-csrf-token']) {
        csrfToken = res.headers['x-csrf-token'];
        console.log(`   Received CSRF Token: ${csrfToken.substring(0, 20)}...`);
      }
      
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

// Validated product from DocumentTracker
const validatedProduct = {
  gtin: '00363391105046',
  lotNumber: 'LOT2024ABC',
  serialNumber: 'SN123456789',
  expirationDate: '2026-12-31',
  quantity: 10,
  productName: 'AMOXICILLIN 500MG',
  warehouseLocation: 'MAIN'
};

async function pushToSAP() {
  try {
    console.log('Product to Push:');
    console.log(`GTIN: ${validatedProduct.gtin}`);
    console.log(`Lot: ${validatedProduct.lotNumber}`);
    console.log(`Serial: ${validatedProduct.serialNumber}`);
    console.log(`Expiration: ${validatedProduct.expirationDate}`);
    console.log(`Quantity: ${validatedProduct.quantity}\n`);
    
    // Step 1: Fetch CSRF Token
    console.log('1. Fetching CSRF Token...');
    await sapRequest(
      'GET',
      '/sap/byd/odata/cust/v1/khinbounddelivery/',
      null,
      { fetchToken: true }
    );
    
    if (!csrfToken) {
      console.log('   ⚠️  No CSRF token received, trying alternate endpoint...');
      await sapRequest(
        'GET',
        '/sap/byd/odata/cust/v1/khinbounddelivery/InboundDeliveryCollection?$top=1',
        null,
        { fetchToken: true }
      );
    }
    
    if (csrfToken) {
      console.log('   ✅ CSRF Token obtained\n');
    } else {
      console.log('   ❌ Failed to get CSRF token\n');
    }
    
    // Step 2: Create Inbound Delivery
    console.log('2. Creating Inbound Delivery...');
    
    // Format dates for SAP (ISO format or SAP date format)
    const currentDate = new Date().toISOString().split('T')[0];
    const expiryDate = validatedProduct.expirationDate;
    
    const inboundDeliveryData = {
      // Basic required fields
      ProcessingTypeCode: "1",
      DeliveryDate: currentDate,
      
      // Location
      ShipToLocationID: validatedProduct.warehouseLocation,
      
      // Items
      Item: [{
        ProductID: validatedProduct.gtin,
        ProductDescription: validatedProduct.productName,
        
        // Batch and serial tracking
        IdentifiedStockID: validatedProduct.serialNumber,
        BatchID: validatedProduct.lotNumber,
        ExpiryDate: expiryDate,
        
        // Quantity
        DeliveryQuantity: validatedProduct.quantity.toString(),
        DeliveryQuantityUnitCode: "EA"
      }]
    };
    
    console.log('   Payload:');
    console.log(JSON.stringify(inboundDeliveryData, null, 2));
    
    // Step 3: POST with CSRF token
    console.log('\n3. Posting to SAP...');
    const response = await sapRequest(
      'POST',
      '/sap/byd/odata/cust/v1/khinbounddelivery/InboundDeliveryCollection',
      inboundDeliveryData
    );
    
    console.log(`   Response: ${response.status} ${response.statusText}`);
    
    if (response.status === 201 || response.status === 200) {
      console.log('   ✅ SUCCESS! Inbound Delivery created');
      try {
        const result = JSON.parse(response.data);
        if (result.d && result.d.ID) {
          console.log(`   Delivery ID: ${result.d.ID}`);
        }
      } catch (e) {
        console.log('   Response:', response.data);
      }
    } else {
      console.log('   ❌ Failed');
      console.log('   Response:', response.data);
    }
    
    // Step 4: Integration Guide
    console.log('\n\n=== DocumentTracker Integration ===');
    console.log('Add this to your sap-integration-service.ts:\n');
    console.log(`
async pushInventoryToSAP(product: ValidatedProduct) {
  // Get CSRF token
  if (!this.csrfToken) {
    const tokenResponse = await this.axiosInstance.get(
      '/sap/byd/odata/cust/v1/khinbounddelivery/',
      { headers: { 'X-CSRF-Token': 'fetch' } }
    );
    this.csrfToken = tokenResponse.headers['x-csrf-token'];
  }
  
  // Create inbound delivery
  const inboundDelivery = {
    ProcessingTypeCode: "1",
    DeliveryDate: new Date().toISOString().split('T')[0],
    ShipToLocationID: product.warehouseLocation,
    Item: [{
      ProductID: product.gtin,
      IdentifiedStockID: product.serialNumber,
      BatchID: product.lotNumber,
      ExpiryDate: product.expirationDate,
      DeliveryQuantity: product.quantity.toString(),
      DeliveryQuantityUnitCode: "EA"
    }]
  };
  
  const response = await this.axiosInstance.post(
    '/sap/byd/odata/cust/v1/khinbounddelivery/InboundDeliveryCollection',
    inboundDelivery,
    { headers: { 'X-CSRF-Token': this.csrfToken } }
  );
  
  return response.data.d;
}
`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the push
pushToSAP();