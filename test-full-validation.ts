import { readFile } from 'fs/promises';
import { validateXml } from './server/validators';
import { parseStringPromise } from 'xml2js';

async function testFullValidation() {
  try {
    const xmlBuffer = await readFile('./attached_assets/shipment_2da14bd1-1cf0-40ba-bde0-7c767f6e6abf.epcis.xml');
    console.log('Validating EPCIS file with our updated validators...');
    
    // Try various parsing configurations to find which one works
    console.log('\nTesting XML parsing with different configurations...');
    
    // Test with explicit namespaces
    try {
      console.log('\nTest 1: explicit namespaces');
      const parseResult1 = await parseStringPromise(xmlBuffer.toString(), {
        explicitArray: false,
        mergeAttrs: false,
        attrkey: '$',
        xmlns: true  // Enable namespace processing
      });
      
      console.log('Root keys:', Object.keys(parseResult1));
      // Check if we have any keys that contain "epcis" or "EPCIS"
      const epcisKeys = Object.keys(parseResult1).filter(k => 
        k.toLowerCase().includes('epcis'));
      
      if (epcisKeys.length > 0) {
        console.log('Found EPCIS elements:', epcisKeys);
        for (const key of epcisKeys) {
          console.log(`EPCIS element ${key} has properties:`, 
            Object.keys(parseResult1[key]));
          
          // Check for EPCISBody
          if (parseResult1[key].EPCISBody) {
            console.log('EPCISBody found with properties:', 
              Object.keys(parseResult1[key].EPCISBody));
          }
        }
      } else {
        console.log('No EPCIS elements found at root level');
      }
    } catch (error) {
      console.error('Test 1 error:', error.message);
    }
    
    // Test with explicitArray: true to see nested structure
    try {
      console.log('\nTest 2: with explicitArray: true');
      const parseResult2 = await parseStringPromise(xmlBuffer.toString(), {
        explicitArray: true,
        mergeAttrs: false,
        attrkey: '$',
        xmlns: true
      });
      
      console.log('Root keys:', Object.keys(parseResult2));
    } catch (error) {
      console.error('Test 2 error:', error.message);
    }
    
    // Test with namespace processing disabled
    try {
      console.log('\nTest 3: without namespace processing');
      const parseResult3 = await parseStringPromise(xmlBuffer.toString(), {
        explicitArray: false,
        mergeAttrs: false,
        attrkey: '$',
        xmlns: false  // Disable namespace processing
      });
      
      console.log('Root keys:', Object.keys(parseResult3));
    } catch (error) {
      console.error('Test 3 error:', error.message);
    }
    
    // Now try the full validation
    console.log('\nNow testing full validation...');
    const result = await validateXml(xmlBuffer);
    console.log('Validation result status:', result.valid);
    if (!result.valid) {
      console.log('Error code:', result.errorCode);
      console.log('Error message:', result.errorMessage);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testFullValidation();
