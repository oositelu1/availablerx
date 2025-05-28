// Push to SAP with CSRF Token handling
const https = require('https');

const config = {
  baseUrl: 'https://my347887.sapbydesign.com',
  username: 'FOSITELU',
  password: 'Babyboo100100!!!'
};

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

console.log('SAP Integration with CSRF Token');
console.log('===============================\n');

// SAP request helper with CSRF token support
function sapRequest(method, endpoint, data = null, csrfToken = null) {
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
    
    // Add CSRF token for POST/PUT/DELETE
    if (csrfToken && method !== 'GET') {
      options.headers['x-csrf-token'] = csrfToken;
    }
    
    // Request CSRF token on GET
    if (method === 'GET' && !csrfToken) {
      options.headers['x-csrf-token'] = 'Fetch';
    }
    
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
          data: responseData,
          csrfToken: res.headers['x-csrf-token']
        });
      });
    });
    
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function pushToSAP() {
  try {
    // 1. Get CSRF Token
    console.log('1. Getting CSRF Token...');
    const tokenResponse = await sapRequest(
      'GET', 
      '/sap/byd/odata/cust/v1/khinbounddelivery/InboundDeliveryCollection?$top=1'
    );
    
    const csrfToken = tokenResponse.csrfToken;
    console.log(`✅ Got CSRF Token: ${csrfToken ? csrfToken.substring(0, 20) + '...' : 'None'}`);
    
    // 2. Create Inbound Delivery
    console.log('\n2. Creating Inbound Delivery...');
    
    const inboundDelivery = {
      ProcessingTypeCode: '1',
      DeliveryDate: `/Date(${Date.now()})/`,
      ShipToLocation: {
        LocationID: validatedProduct.warehouseLocation
      },
      Note: [{ 
        Text: `DocumentTracker Import - Validated: ${new Date().toISOString()}`
      }],
      Item: [{
        ProductID: validatedProduct.gtin,
        ProductDescription: { 
          Description: validatedProduct.productName 
        },
        IdentifiedStockID: validatedProduct.serialNumber,
        IdentifiedStockBatchID: validatedProduct.lotNumber,
        DeliveryQuantity: {
          Quantity: validatedProduct.quantity.toString(),
          unitCode: 'EA'
        }
      }]
    };
    
    console.log('Posting data:');
    console.log(JSON.stringify(inboundDelivery, null, 2));
    
    // 3. POST with CSRF token
    console.log('\n3. Posting to SAP...');
    const createResponse = await sapRequest(
      'POST',
      '/sap/byd/odata/cust/v1/khinbounddelivery/InboundDeliveryCollection',
      inboundDelivery,
      csrfToken
    );
    
    console.log(`Response: ${createResponse.status} ${createResponse.statusText}`);
    
    if (createResponse.status === 201) {
      console.log('✅ SUCCESS! Inbound Delivery created');
      const result = JSON.parse(createResponse.data);
      console.log(`Delivery ID: ${result.d.ID}`);
      console.log('\nProduct successfully pushed to SAP inventory!');
    } else {
      console.log('❌ Failed:', createResponse.data);
    }
    
    // 4. Show integration code
    console.log('\n=== DocumentTracker Integration Code ===\n');
    console.log(`
// In your SAP integration service:
async createInboundDelivery(product) {
  // Get CSRF token
  const tokenResponse = await this.axiosInstance.get(
    '/sap/byd/odata/cust/v1/khinbounddelivery/InboundDeliveryCollection?$top=1',
    { headers: { 'x-csrf-token': 'Fetch' } }
  );
  
  const csrfToken = tokenResponse.headers['x-csrf-token'];
  
  // Create delivery
  const response = await this.axiosInstance.post(
    '/sap/byd/odata/cust/v1/khinbounddelivery/InboundDeliveryCollection',
    {
      ProcessingTypeCode: '1',
      DeliveryDate: \`/Date(\${Date.now()})/\`,
      ShipToLocation: { LocationID: product.warehouseLocation },
      Item: [{
        ProductID: product.gtin,
        IdentifiedStockID: product.serialNumber,
        IdentifiedStockBatchID: product.lotNumber,
        DeliveryQuantity: {
          Quantity: product.quantity.toString(),
          unitCode: 'EA'
        }
      }]
    },
    { headers: { 'x-csrf-token': csrfToken } }
  );
  
  return response.data.d;
}
`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the integration
pushToSAP();