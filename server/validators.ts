import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { promisify } from 'util';
import { exec as execCb } from 'child_process';
import AdmZip from 'adm-zip';
import xml2js from 'xml2js';
import tmp from 'tmp';
import libxmljs2 from 'libxmljs2';

const exec = promisify(execCb);

// Supported file types
export const ALLOWED_FILE_TYPES = ['application/zip', 'application/xml', 'text/xml'];
export const MAX_FILE_SIZE = process.env.MAX_FILE_SIZE ? parseInt(process.env.MAX_FILE_SIZE) : 100 * 1024 * 1024; // 100MB

// Validation error codes
export const ERROR_CODES = {
  INVALID_FILE_TYPE: 'INVALID-FILE-TYPE',
  FILE_TOO_LARGE: 'FILE-TOO-LARGE',
  MULTI_XML: 'MULTI-XML',
  NO_XML: 'NO-XML',
  XML_PARSE_ERROR: 'XML-PARSE-ERROR',
  XSD_VALIDATION_FAILED: 'XSD-VALIDATION-FAILED',
  VERSION_MISMATCH: 'VERSION-MISMATCH',
  TS_MISSING: 'TS-MISSING'
};

// Path to XSD schemas
const XSD_DIR = path.join(process.cwd(), 'schemas');

// Ensure XSD directory exists
async function ensureXsdDir() {
  try {
    await fs.mkdir(XSD_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating XSD directory:', error);
  }
}

// Download XSD schemas if they don't exist
async function getXsdSchemas() {
  await ensureXsdDir();
  
  const epcisXsdPath = path.join(XSD_DIR, 'EPCglobal-epcis-1_2.xsd');
  const cbvXsdPath = path.join(XSD_DIR, 'EPCglobal-cbv-1_2.xsd');
  
  try {
    // Check if files exist
    await fs.access(epcisXsdPath);
    await fs.access(cbvXsdPath);
  } catch (error) {
    // Files don't exist, download them
    console.log('Downloading XSD schemas...');
    
    // Create temporary directory for downloads
    const tmpDir = tmp.dirSync({ unsafeCleanup: true });
    
    try {
      // Download EPCIS 1.2 XSD schemas
      await exec(`curl -s -o ${tmpDir.name}/EPCglobal-epcis-1_2.xsd https://www.gs1.org/docs/epc/epcis_1_2-standard-20160919.xsd`);
      await exec(`curl -s -o ${tmpDir.name}/EPCglobal-cbv-1_2.xsd https://www.gs1.org/docs/epc/CBV-Standard-1-2-2-r-2016-09-29.xsd`);
      
      // Move to final location
      await fs.copyFile(`${tmpDir.name}/EPCglobal-epcis-1_2.xsd`, epcisXsdPath);
      await fs.copyFile(`${tmpDir.name}/EPCglobal-cbv-1_2.xsd`, cbvXsdPath);
      
      console.log('XSD schemas downloaded successfully');
    } catch (downloadError) {
      console.error('Error downloading XSD schemas:', downloadError);
      throw new Error('Failed to download required XSD schemas');
    } finally {
      // Clean up temp directory
      tmpDir.removeCallback();
    }
  }
  
  return { epcisXsdPath, cbvXsdPath };
}

// Check if a ZIP file contains exactly one XML file
export async function validateZipContents(zipBuffer: Buffer): Promise<{ valid: boolean, xmlBuffer?: Buffer, errorCode?: string, errorMessage?: string }> {
  try {
    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();
    
    // Filter for XML files
    const xmlEntries = zipEntries.filter(entry => 
      !entry.isDirectory && entry.name.toLowerCase().endsWith('.xml')
    );
    
    if (xmlEntries.length === 0) {
      return { 
        valid: false, 
        errorCode: ERROR_CODES.NO_XML,
        errorMessage: 'ZIP file does not contain any XML files. Please include exactly one XML file.'
      };
    }
    
    if (xmlEntries.length > 1) {
      return { 
        valid: false, 
        errorCode: ERROR_CODES.MULTI_XML,
        errorMessage: 'ZIP file contains multiple XML files. Please compress only one XML file before sending.'
      };
    }
    
    // Extract the single XML file content
    const xmlBuffer = xmlEntries[0].getData();
    
    return { valid: true, xmlBuffer };
  } catch (error) {
    console.error('Error validating ZIP contents:', error);
    return { 
      valid: false, 
      errorCode: ERROR_CODES.XML_PARSE_ERROR,
      errorMessage: 'Could not read ZIP file contents. The file may be corrupted.'
    };
  }
}

// Validate XML against XSD schema
export async function validateXml(xmlBuffer: Buffer): Promise<{ 
  valid: boolean, 
  errorCode?: string, 
  errorMessage?: string,
  schemaErrors?: string[],
  metadata?: {
    objectEvents?: number,
    aggregationEvents?: number,
    transactionEvents?: number,
    senderGln?: string,
    schemaVersion?: string
  }
}> {
  try {
    // Parse XML to check basic structure and extract metadata
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(xmlBuffer.toString());
    
    // Check if it's an EPCIS document
    if (!result.EPCISDocument) {
      return {
        valid: false,
        errorCode: ERROR_CODES.XML_PARSE_ERROR,
        errorMessage: 'The file is not a valid EPCIS document.'
      };
    }
    
    // Extract schema version
    const schemaVersion = result.EPCISDocument.$.schemaVersion;
    if (schemaVersion !== '1.2') {
      return {
        valid: false,
        errorCode: ERROR_CODES.VERSION_MISMATCH,
        errorMessage: `Invalid EPCIS version: ${schemaVersion}. Expected: 1.2`
      };
    }
    
    // Check for transaction statement (DSCSA requirement)
    let hasTransactionStatement = false;
    if (result.EPCISDocument.EPCISBody && 
        result.EPCISDocument.EPCISBody.TransactionEvent) {
      
      const events = Array.isArray(result.EPCISDocument.EPCISBody.TransactionEvent) 
        ? result.EPCISDocument.EPCISBody.TransactionEvent 
        : [result.EPCISDocument.EPCISBody.TransactionEvent];
      
      for (const event of events) {
        if (event.bizTransactionList && event.bizTransactionList.bizTransaction) {
          const transactions = Array.isArray(event.bizTransactionList.bizTransaction)
            ? event.bizTransactionList.bizTransaction
            : [event.bizTransactionList.bizTransaction];
          
          for (const transaction of transactions) {
            if (transaction.$.type && transaction.$.type.includes('transactionStatement')) {
              hasTransactionStatement = true;
              break;
            }
          }
        }
        if (hasTransactionStatement) break;
      }
    }
    
    if (!hasTransactionStatement) {
      return {
        valid: false,
        errorCode: ERROR_CODES.TS_MISSING,
        errorMessage: 'Missing required transaction statement (<ds:transactionStatement>).'
      };
    }
    
    // Extract event counts for metadata
    const metadata: any = {};
    
    if (result.EPCISDocument.EPCISBody) {
      // Count ObjectEvents
      if (result.EPCISDocument.EPCISBody.ObjectEvent) {
        metadata.objectEvents = Array.isArray(result.EPCISDocument.EPCISBody.ObjectEvent) 
          ? result.EPCISDocument.EPCISBody.ObjectEvent.length 
          : 1;
      } else {
        metadata.objectEvents = 0;
      }
      
      // Count AggregationEvents
      if (result.EPCISDocument.EPCISBody.AggregationEvent) {
        metadata.aggregationEvents = Array.isArray(result.EPCISDocument.EPCISBody.AggregationEvent) 
          ? result.EPCISDocument.EPCISBody.AggregationEvent.length 
          : 1;
      } else {
        metadata.aggregationEvents = 0;
      }
      
      // Count TransactionEvents
      if (result.EPCISDocument.EPCISBody.TransactionEvent) {
        metadata.transactionEvents = Array.isArray(result.EPCISDocument.EPCISBody.TransactionEvent) 
          ? result.EPCISDocument.EPCISBody.TransactionEvent.length 
          : 1;
      } else {
        metadata.transactionEvents = 0;
      }
    }
    
    // Extract sender GLN (Global Location Number)
    // Look for the sender ID in standard locations
    if (result.EPCISDocument.EPCISHeader && 
        result.EPCISDocument.EPCISHeader.sender) {
      metadata.senderGln = result.EPCISDocument.EPCISHeader.sender;
    }
    
    // Save schema version
    metadata.schemaVersion = schemaVersion;
    
    // Validate against XSD schema using libxmljs2
    try {
      const { epcisXsdPath } = await getXsdSchemas();
      
      const xmlDoc = libxmljs2.parseXml(xmlBuffer.toString());
      const xsdDoc = libxmljs2.parseXml(await fs.readFile(epcisXsdPath, 'utf8'));
      
      const isValid = xmlDoc.validate(xsdDoc);
      
      if (!isValid) {
        // Get validation errors for user feedback
        const schemaErrors = xmlDoc.validationErrors.map(error => 
          `Line ${error.line}: ${error.message}`
        ).slice(0, 10); // Limit to first 10 errors
        
        return {
          valid: false,
          errorCode: ERROR_CODES.XSD_VALIDATION_FAILED,
          errorMessage: 'XML does not validate against the EPCIS 1.2 schema.',
          schemaErrors,
          metadata  // Still return metadata even for invalid XML
        };
      }
      
      return { valid: true, metadata };
    } catch (validationError) {
      console.error('XSD validation error:', validationError);
      return {
        valid: false,
        errorCode: ERROR_CODES.XSD_VALIDATION_FAILED,
        errorMessage: 'Error validating XML against schema: ' + validationError.message,
        metadata  // Still return metadata even for invalid XML
      };
    }
  } catch (error) {
    console.error('Error parsing XML:', error);
    return {
      valid: false,
      errorCode: ERROR_CODES.XML_PARSE_ERROR,
      errorMessage: 'Could not parse XML. The file may be malformed or corrupted.'
    };
  }
}

// Compute SHA-256 hash of a buffer
export function computeSHA256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
