import { readFile } from 'fs/promises';
import { parseString } from 'xml2js';

async function testXmlVersion() {
  try {
    // Read the XML file
    console.log('Reading XML file...');
    const xmlBuffer = await readFile('./attached_assets/shipment_2da14bd1-1cf0-40ba-bde0-7c767f6e6abf.epcis.xml');
    
    // Parse with xml2js to check attributes
    console.log('Parsing XML to check schema version...');
    parseString(xmlBuffer.toString(), { 
      explicitArray: false,
      attrkey: 'ATTRS',
      xmlns: true
    }, (err, result) => {
      if (err) {
        console.error('Error parsing XML:', err);
        return;
      }
      
      // Log the document with its attributes
      if (result['epcis:EPCISDocument']) {
        const doc = result['epcis:EPCISDocument'];
        console.log('EPCIS Document attributes:', JSON.stringify(doc.ATTRS, null, 2));
        console.log('Schema version:', doc.ATTRS.schemaVersion);
      } else if (result.EPCISDocument) {
        const doc = result.EPCISDocument;
        console.log('EPCIS Document attributes:', JSON.stringify(doc.ATTRS, null, 2));
        console.log('Schema version:', doc.ATTRS.schemaVersion);
      } else {
        console.log('Document structure:', Object.keys(result));
      }
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

testXmlVersion();
