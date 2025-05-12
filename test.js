import { readFile } from 'fs/promises';
import { validateXml } from './server/validators.js';

async function testXmlValidation() {
  try {
    const xmlBuffer = await readFile('./test.xml');
    console.log('Validating XML...');
    const result = await validateXml(xmlBuffer);
    console.log('Validation result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

testXmlValidation();
