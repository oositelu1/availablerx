// Push Validated Products to SAP via Inbound Delivery
const https = require('https');

const config = {
  baseUrl: 'https://my347887.sapbydesign.com',
  username: 'FOSITELU',
  password: 'Babyboo100100!!!'
};

console.log('Push to SAP Inbound Delivery');
console.log('============================\n');

// Validated product from DocumentTracker
const validatedProduct = {
  gtin: '00363391105046',
  lotNumber: 'LOT2024ABC', 
  serialNumber: 'SN123456789',
  expirationDate: '2026-12-31',
  quantity: 10,
  productName: 'AMOXICILLIN 500MG',
  warehouseLocation: 'MAIN',
  validatedAt: new Date().toISOString(),
  validatedBy: 'DocumentTracker'
};

console.log('Validated Product:');
console.log(`GTIN: ${validatedProduct.gtin}`);
console.log(`Lot #: ${validatedProduct.lotNumber}`);
console.log(`Serial: ${validatedProduct.serialNumber}`);
console.log(`Expiration: ${validatedProduct.expirationDate}`);
console.log(`Quantity: ${validatedProduct.quantity}`);
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

async function createInboundDelivery() {
  try {
    // First, let's get a sample to understand the structure
    console.log('1. Getting sample inbound delivery structure...');
    const sampleResponse = await sapRequest('GET', '/sap/byd/odata/cust/v1/khinbounddelivery/InboundDeliveryCollection?$top=1');
    
    if (sampleResponse.status === 200) {
      const sampleData = JSON.parse(sampleResponse.data);
      if (sampleData.d && sampleData.d.results && sampleData.d.results.length > 0) {
        console.log('✅ Found sample structure');
        
        // Extract key fields from sample
        const sample = sampleData.d.results[0];
        console.log('\nKey fields identified:');
        console.log(`- ID: ${sample.ID}`);
        console.log(`- DeliveryDate: ${sample.DeliveryDate}`);
        console.log(`- ShipToParty: ${sample.ShipToParty}`);
        console.log(`- ShipToLocation: ${sample.ShipToLocation}`);
      }
    }
    
    // 2. Create inbound delivery for validated product
    console.log('\n2. Creating Inbound Delivery...');
    
    const inboundDelivery = {
      // Header information
      DeliveryDate: `/Date(${Date.now()})/`, // SAP date format
      ProcessingTypeCode: '1', // Standard inbound delivery
      ShipToLocation: validatedProduct.warehouseLocation,
      Note: `DocumentTracker validation: ${validatedProduct.validatedAt}`,
      
      // Item details - this would need to be adjusted based on actual SAP structure
      ItemCollection: [{
        ProductID: validatedProduct.gtin,
        ProductDescription: validatedProduct.productName,
        IdentifiedStockID: validatedProduct.serialNumber,
        BatchID: validatedProduct.lotNumber,
        ExpiryDate: `/Date(${new Date(validatedProduct.expirationDate).getTime()})/`,
        DeliveryQuantity: {
          Amount: validatedProduct.quantity.toString(),
          unitCode: 'EA'
        }
      }]
    };
    
    console.log('Inbound Delivery Data:');
    console.log(JSON.stringify(inboundDelivery, null, 2));
    
    // 3. POST to create inbound delivery
    console.log('\n3. Posting to SAP...');
    const createResponse = await sapRequest(
      'POST',
      '/sap/byd/odata/cust/v1/khinbounddelivery/InboundDeliveryCollection',
      inboundDelivery
    );
    
    console.log(`Response Status: ${createResponse.status} ${createResponse.statusText}`);
    
    if (createResponse.status === 201) {
      console.log('✅ Inbound Delivery created successfully!');
      const result = JSON.parse(createResponse.data);
      console.log(`Delivery ID: ${result.d.ID}`);
      
      // This ID would be stored back in DocumentTracker
      return {
        success: true,
        deliveryId: result.d.ID,
        message: 'Product pushed to SAP inventory'
      };
    } else {
      console.log('❌ Failed to create delivery');
      console.log('Response:', createResponse.data);
      
      // Common issues:
      console.log('\nTroubleshooting:');
      console.log('- Check if material/product exists in SAP');
      console.log('- Verify warehouse/location codes');
      console.log('- Ensure date formats are correct');
      console.log('- Check required fields in metadata');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Integration function for DocumentTracker
function integrateWithDocumentTracker() {
  console.log('\n=== DocumentTracker Integration ===');
  console.log('Add this to your validation completion handler:\n');
  
  console.log(`
// After successful EPCIS + Barcode validation
if (validationResult.status === 'VALIDATED') {
  
  // Push to SAP
  const sapResult = await sapService.createInboundDelivery({
    gtin: product.gtin,
    lotNumber: product.lotNumber,
    serialNumber: product.serialNumber,
    expirationDate: product.expirationDate,
    quantity: product.quantity,
    productName: product.name,
    warehouseLocation: 'MAIN'
  });
  
  // Store SAP delivery ID
  await storage.updateProductItem(productId, {
    sapDeliveryId: sapResult.deliveryId,
    sapSyncStatus: 'SYNCED',
    sapSyncDate: new Date()
  });
  
  console.log('Product pushed to SAP:', sapResult.deliveryId);
}
`);
}

// Run the test
createInboundDelivery().then(() => {
  integrateWithDocumentTracker();
});