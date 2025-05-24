const fs = require('fs');
const path = require('path');

// Import the validators module
const validators = require('./dist/index.js');

async function testValidation() {
  try {
    console.log('Testing EPCIS validation...');
    
    // Test with sample EPCIS file
    const filePath = './attached_assets/shipment_2da14bd1-1cf0-40ba-bde0-7c767f6e6abf.epcis.xml';
    
    if (!fs.existsSync(filePath)) {
      console.error('Sample file not found:', filePath);
      return;
    }
    
    console.log('Validating file:', filePath);
    
    // Read file and validate
    const xmlBuffer = fs.readFileSync(filePath);
    
    // Try to use validateXml if available
    if (validators.validateXml) {
      const result = await validators.validateXml(xmlBuffer);
      console.log('Validation result:', result.valid);
      if (result.metadata) {
        console.log('Product info:', result.metadata.productInfo);
        console.log('Number of product items:', result.metadata.productItems?.length || 0);
      }
    } else {
      console.log('validateXml not found in exports');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testValidation();