import { readFile } from 'fs/promises';
import { validateEpcisFile } from './server/validators';

async function testEPCISValidation() {
  console.log('Testing EPCIS XML processing...\n');
  
  const testFile = './attached_assets/shipment_2da14bd1-1cf0-40ba-bde0-7c767f6e6abf.epcis.xml';
  
  try {
    console.log('Validating file:', testFile);
    const result = await validateEpcisFile(testFile);
    
    console.log('\n=== VALIDATION RESULT ===');
    console.log('Valid:', result.valid);
    
    if (!result.valid) {
      console.log('Error Code:', result.errorCode);
      console.log('Error Message:', result.errorMessage);
      if (result.schemaErrors) {
        console.log('Schema Errors:', result.schemaErrors);
      }
    } else {
      console.log('\n=== METADATA ===');
      if (result.metadata) {
        console.log('Schema Version:', result.metadata.schemaVersion);
        console.log('Sender GLN:', result.metadata.senderGln);
        console.log('Object Events:', result.metadata.objectEvents);
        console.log('Aggregation Events:', result.metadata.aggregationEvents);
        console.log('Transaction Events:', result.metadata.transactionEvents);
        
        console.log('\n=== PRODUCT INFO ===');
        console.log('Product Name:', result.metadata.productInfo.name);
        console.log('Manufacturer:', result.metadata.productInfo.manufacturer);
        console.log('NDC:', result.metadata.productInfo.ndc);
        console.log('Dosage Form:', result.metadata.productInfo.dosageForm);
        console.log('Strength:', result.metadata.productInfo.strength);
        console.log('Net Content:', result.metadata.productInfo.netContent);
        console.log('Lot Number:', result.metadata.productInfo.lotNumber);
        console.log('Expiration Date:', result.metadata.productInfo.expirationDate);
        
        console.log('\n=== PRODUCT ITEMS ===');
        console.log('Total Product Items:', result.metadata.productItems.length);
        if (result.metadata.productItems.length > 0) {
          console.log('First 3 items:');
          result.metadata.productItems.slice(0, 3).forEach((item, index) => {
            console.log(`\nItem ${index + 1}:`);
            console.log('  GTIN:', item.gtin);
            console.log('  Serial Number:', item.serialNumber);
            console.log('  Lot Number:', item.lotNumber);
            console.log('  Expiration Date:', item.expirationDate);
            console.log('  Source GLN:', item.sourceGln);
            console.log('  Destination GLN:', item.destinationGln);
            console.log('  Business Transactions:', item.bizTransactionList);
          });
        }
        
        console.log('\n=== PURCHASE ORDERS ===');
        console.log('PO Numbers:', result.metadata.poNumbers);
      }
    }
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the test
testEPCISValidation().catch(console.error);