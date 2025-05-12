import { readFile } from 'fs/promises';
import { validateXml } from './server/validators';

async function testFullValidation() {
  try {
    const xmlBuffer = await readFile('./attached_assets/shipment_2da14bd1-1cf0-40ba-bde0-7c767f6e6abf.epcis.xml');
    console.log('Validating EPCIS file with our updated validators...');
    const result = await validateXml(xmlBuffer);
    console.log('Validation result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

testFullValidation();
