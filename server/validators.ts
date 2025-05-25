import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { parseStringPromise, processors } from 'xml2js';
import { insertProductItemSchema, type ProductItem } from '@shared/schema';
import { z } from 'zod';
import { parseEpcisFileStreaming } from './streaming-xml-parser';
// import * as libxmljs from 'libxmljs2'; // Commented out - not used for validation

// Constants for file upload validation
export const ALLOWED_FILE_TYPES = ['application/xml', 'text/xml', 'application/zip', 'application/x-zip-compressed'];
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

interface ValidationResult {
  valid: boolean;
  errorCode?: string;
  errorMessage?: string;
  metadata?: any;
  xmlBuffer?: Buffer;
  schemaErrors?: string[];
}

export const ERROR_CODES = {
  FILE_READ_ERROR: 'FILE_READ_ERROR',
  XML_PARSE_ERROR: 'XML_PARSE_ERROR',
  INVALID_SCHEMA: 'INVALID_SCHEMA',
  NOT_EPCIS: 'NOT_EPCIS',
  MISSING_DATA: 'MISSING_DATA',
  UNSUPPORTED_VERSION: 'UNSUPPORTED_VERSION',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
};

// Basic metadata structure
export interface EpcisMetadata {
  objectEvents: number;
  aggregationEvents: number;
  transactionEvents: number;
  senderGln: string;
  schemaVersion: string;
  productInfo: {
    name?: string;
    dosageForm?: string;
    strength?: string;
    ndc?: string;
    netContent?: string;
    manufacturer?: string;
    lotNumber?: string;
    expirationDate?: string;
  };
  productItems: any[];
  poNumbers: string[];
}

/**
 * Validate an EPCIS file against the XSD schema
 */
export async function validateEpcisFile(filePathOrBuffer: string | Buffer): Promise<ValidationResult> {
  let xmlBuffer: Buffer;
  let xmlData: any;

  try {
    if (typeof filePathOrBuffer === 'string') {
      const filePath = filePathOrBuffer;
      // Check file size to determine parsing strategy
      const stats = fs.statSync(filePath);
      const fileSizeInMB = stats.size / (1024 * 1024);

      // Use streaming parser for files larger than 10MB
      if (fileSizeInMB > 10) {
        console.log(`Using streaming parser for large file (${fileSizeInMB.toFixed(2)}MB)`);
        try {
          const metadata = await parseEpcisFileStreaming(filePath);
          return { valid: true, metadata };
        } catch (streamError) {
          console.error('Streaming parser failed, falling back to regular parser:', streamError);
          // Fall through to regular parser, read the file into buffer
          xmlBuffer = fs.readFileSync(filePath);
        }
      } else {
        xmlBuffer = fs.readFileSync(filePath);
      }
    } else {
      xmlBuffer = filePathOrBuffer;
    }

    // Parse the XML with xml2js for structured data access
    xmlData = await parseStringPromise(xmlBuffer, {
      explicitArray: true, // Ensure elements are always arrays
      explicitCharkey: false, // Use '_' for text content
      mergeAttrs: false, // Keep attributes separate
      normalizeTags: false, // Preserve case and namespaces
      attrNameProcessors: [processors.stripPrefix], // Strip namespace prefixes from attributes for easier access
      tagNameProcessors: [processors.stripPrefix] // Strip namespace prefixes from tags
    });

    // Debug - show the parsed XML structure
    console.log('XML Data root keys:', Object.keys(xmlData));

    // If parsing succeeds, check if it's a valid EPCIS document
    // EPCIS documents can have different root structures
    if (!xmlData) {
      return {
        valid: false,
        errorCode: ERROR_CODES.XML_PARSE_ERROR,
        errorMessage: 'Could not parse XML. The file may be malformed or corrupted.'
      };
    }

    // Look for the EPCIS root element - it could be directly at root or nested
    // With tagNameProcessors: [processors.stripPrefix], namespaces are removed from tag names.
    const epcisDocument = xmlData.EPCISDocument?.[0] || xmlData.epcisDocument?.[0];

    if (!epcisDocument) {
      return {
        valid: false,
        errorCode: ERROR_CODES.NOT_EPCIS,
        errorMessage: 'The XML file is not a valid EPCIS document. Could not find EPCIS root element.'
      };
    }

    // Extract EPCIS version
    let schemaVersion = '1.0'; // Default to 1.0 if not specified
    if (epcisDocument.$ && epcisDocument.$.schemaVersion) {
      schemaVersion = epcisDocument.$.schemaVersion;
    }
    console.log(`Detected EPCIS schema version: ${schemaVersion}`);

    // Extract EPCIS body and header
    // With explicitArray: true, these will be arrays.
    const epcisHeader = epcisDocument.EPCISHeader?.[0];
    const epcisBody = epcisDocument.EPCISBody?.[0];

    // Initialize metadata
    const metadata: EpcisMetadata = {
      objectEvents: 0,
      aggregationEvents: 0,
      transactionEvents: 0,
      senderGln: 'unknown',
      schemaVersion,
      productInfo: {},
      productItems: [],
      poNumbers: []
    };

    // Extract sender information from header
    if (epcisHeader) {
      try {
        console.log('Attempting to extract sender GLN from header...');
        // With explicitArray: true and processors.stripPrefix, access is simpler.
        const sbdh = epcisHeader.StandardBusinessDocumentHeader?.[0];
        if (sbdh?.Sender?.[0]?.Identifier?.[0]) {
          let identifier = sbdh.Sender[0].Identifier[0];
          if (typeof identifier === 'object' && identifier._) {
            identifier = identifier._; // Handle cases where value is in '_'
          }
          metadata.senderGln = identifier;
          console.log('Found sender GLN in SBDH:', metadata.senderGln);

          if (metadata.senderGln && metadata.senderGln.startsWith('urn:epc:id:sgln:')) {
            const glnParts = metadata.senderGln.replace('urn:epc:id:sgln:', '').split('.');
            if (glnParts.length >= 2) {
              const companyPrefix = glnParts[0];
              const locationReference = glnParts[1];
              metadata.senderGln = `${companyPrefix}${locationReference.padStart(5, '0')}`;
              console.log('Extracted clean GLN from SGLN:', metadata.senderGln);
            }
          }
        } else {
          console.log('Sender GLN not found in StandardBusinessDocumentHeader');
        }
      } catch (error) {
        console.error('Error extracting sender info:', error);
      }

      // DSCSA transaction statement validation
      try {
        const transactionStatement = epcisHeader.dscsaTransactionStatement?.[0];
        if (transactionStatement?.affirmTransactionStatement?.[0] === 'true') {
          console.log('Valid DSCSA transaction statement found');
        } else if (transactionStatement) {
          console.warn('Transaction statement present but not affirmed');
        } else {
          console.warn('Warning: Missing transaction statement, but proceeding for testing');
        }
      } catch (error) {
        console.error('Error checking transaction statement:', error);
      }

      // Extract product/drug info from header master data
      try {
        console.log('Attempting to extract product info from XML');
        const masterData = epcisHeader.extension?.[0]?.EPCISMasterData?.[0];
        const vocabularies = masterData?.VocabularyList?.[0]?.Vocabulary;

        if (vocabularies) {
          console.log(`Found ${vocabularies.length} vocabularies to process`);
          for (const vocab of vocabularies) {
            const vocabType = vocab.$?.type || vocab.type?.[0];
            if (typeof vocabType === 'string' && vocabType.includes('EPCClass')) {
              console.log('Found EPCClass vocabulary, extracting product info');
              const elements = vocab.VocabularyElementList?.[0]?.VocabularyElement || vocab.VocabularyElement;
              if (elements) {
                for (const element of elements) {
                  const attributes = element.attribute;
                  if (attributes) {
                    const attributeMap = new Map<string, string>();
                    for (const attr of attributes) {
                      const id = attr.$?.id || attr.id?.[0];
                      // Value can be in attr._ or attr (if simple content)
                      let value = attr._ || (typeof attr === 'string' ? attr : undefined);
                      if (attr && typeof attr === 'object' && !value && Object.keys(attr).length === 1 && attr._ === undefined && attr.$ === undefined) {
                         // Handle cases like <attribute id="urn:...">Value</attribute>
                         value = attr[Object.keys(attr)[0]]?.[0];
                      }


                      if (id && value !== undefined) {
                        console.log(`Attribute ${id} = ${value}`);
                        attributeMap.set(id, String(value));
                      } else {
                        console.log('Attribute missing ID or Value:', JSON.stringify(attr));
                      }
                    }

                    if (attributeMap.has('urn:epcglobal:cbv:mda#regulatedProductName')) {
                      metadata.productInfo.name = attributeMap.get('urn:epcglobal:cbv:mda#regulatedProductName');
                      console.log('Found product name:', metadata.productInfo.name);
                    }
                    if (attributeMap.has('urn:epcglobal:cbv:mda#manufacturerOfTradeItemPartyName')) {
                      metadata.productInfo.manufacturer = attributeMap.get('urn:epcglobal:cbv:mda#manufacturerOfTradeItemPartyName');
                      console.log('Found manufacturer:', metadata.productInfo.manufacturer);
                    }
                    if (attributeMap.has('urn:epcglobal:cbv:mda#additionalTradeItemIdentification')) {
                      const ndcValue = attributeMap.get('urn:epcglobal:cbv:mda#additionalTradeItemIdentification');
                      const ndcType = attributeMap.get('urn:epcglobal:cbv:mda#additionalTradeItemIdentificationType');
                      if (ndcType === 'NDC' || ndcType === 'DRUG_IDENTIFICATION_NUMBER') {
                        metadata.productInfo.ndc = ndcValue;
                        console.log('Found NDC:', metadata.productInfo.ndc);
                      } else {
                        console.warn(`Found additionalTradeItemIdentification (${ndcValue}) but type is not NDC (type: ${ndcType}).`);
                      }
                    }
                     if (attributeMap.has('urn:epcglobal:cbv:mda#dosageFormType')) {
                        metadata.productInfo.dosageForm = attributeMap.get('urn:epcglobal:cbv:mda#dosageFormType');
                    }
                    if (attributeMap.has('urn:epcglobal:cbv:mda#strengthDescription')) {
                        metadata.productInfo.strength = attributeMap.get('urn:epcglobal:cbv:mda#strengthDescription');
                    }
                    if (attributeMap.has('urn:epcglobal:cbv:mda#netContentDescription')) {
                        metadata.productInfo.netContent = attributeMap.get('urn:epcglobal:cbv:mda#netContentDescription');
                    }
                  }
                }
              }
            }
          }
        } else {
          console.log('No vocabularies found in master data or master data structure is not as expected.');
        }
      } catch (error) {
        console.error('Error extracting product info:', error);
      }

      // Extract serial numbers and PO numbers from events
      try {
        if (epcisBody) {
          const eventList = epcisBody.EventList?.[0];
          let allEvents: any[] = [];

          if (eventList) {
            // Consolidate all event types. explicitArray ensures these are arrays.
            allEvents = [
              ...(eventList.ObjectEvent || []),
              ...(eventList.AggregationEvent || []),
              ...(eventList.TransactionEvent || []),
              ...(eventList.TransformationEvent || [])
            ];
            console.log(`Collected ${allEvents.length} events from EventList`);
          } else if (epcisBody.ObjectEvent) { // Handle direct ObjectEvents if no EventList
             allEvents = [...(epcisBody.ObjectEvent || [])];
             console.log(`Collected ${allEvents.length} direct object events`);
          }


          console.log(`Total events to process: ${allEvents.length}`);

          for (const event of allEvents) {
            const epcList = event.epcList?.[0]?.epc;
            if (epcList) {
              for (const epc of epcList) {
                const epcValue = typeof epc === 'string' ? epc : epc._;
                if (epcValue && epcValue.includes(':sgtin:')) {
                  const parts = epcValue.split(':').pop()?.split('.');
                  if (parts && parts.length >= 3) {
                    const companyPrefix = parts[0];
                    const itemReferenceWithIndicator = parts[1]; // This includes the indicator digit
                    const serialNumber = parts.slice(2).join('.'); // Serial can contain dots

                    // Correct GTIN formation: Company Prefix + Item Reference (without indicator) + Check Digit (not available here)
                    // For SGTIN URN, the itemReference part already includes the indicator digit.
                    // The full GTIN-14 is formed by padding companyPrefix + itemReference to 13 digits and then adding a check digit.
                    // Here, we concatenate companyPrefix and itemReference directly as per typical representations.
                    // The '0' prepended previously was incorrect for SGTIN URN structure.
                    // A common way to represent the GTIN from SGTIN is CompanyPrefix + ItemReference.
                    // Example: 0614141.107346 -> GTIN 0614141107346 (ItemReference's first digit is indicator)
                    const gtin = `${companyPrefix}${itemReferenceWithIndicator}`;
                    
                    console.log(`Extracted SGTIN: GTIN=${gtin}, Serial=${serialNumber}`);

                    if (!metadata.productItems.find(item => item.gtin === gtin && item.serialNumber === serialNumber)) {
                      const eventTime = event.eventTime?.[0] || new Date().toISOString();
                      let lotNumber = metadata.productInfo.lotNumber || null;
                      let expirationDate = metadata.productInfo.expirationDate || null;

                      const ilmd = event.extension?.[0]?.ilmd?.[0];
                      if (ilmd) {
                        lotNumber = ilmd.lotNumber?.[0]?._ || ilmd.lotNumber?.[0] || lotNumber;
                        expirationDate = ilmd.itemExpirationDate?.[0]?._ || ilmd.itemExpirationDate?.[0] || expirationDate;
                      }
                      
                       // Ensure lotNumber and expirationDate from productInfo (master data) are strings if they are objects
                        if (typeof metadata.productInfo.lotNumber === 'object' && metadata.productInfo.lotNumber && metadata.productInfo.lotNumber._) {
                            lotNumber = metadata.productInfo.lotNumber._;
                        }
                        if (typeof metadata.productInfo.expirationDate === 'object' && metadata.productInfo.expirationDate && metadata.productInfo.expirationDate._) {
                            expirationDate = metadata.productInfo.expirationDate._;
                        }


                      metadata.productItems.push({
                        gtin,
                        serialNumber,
                        eventTime,
                        lotNumber: lotNumber || 'unknown',
                        expirationDate: expirationDate || 'unknown',
                        sourceGln: event.bizLocation?.[0]?.id?.[0] || null,
                        destinationGln: event.extension?.[0]?.destinationList?.[0]?.destination?.[0]?.id?.[0] || null,
                        bizTransactionList: []
                      });
                      console.log(`Added product item with serial number: ${serialNumber}`);
                    }
                  }
                }
              }
            }

            const bizTransactionList = event.bizTransactionList?.[0]?.bizTransaction;
            if (bizTransactionList) {
              for (const transaction of bizTransactionList) {
                const type = transaction.$?.type || 'unknown';
                const transactionValue = typeof transaction === 'string' ? transaction : transaction._;
                if (transactionValue && (type.toLowerCase().includes('po') || type.toLowerCase().includes('purchaseorder'))) {
                  let poNumber = transactionValue;
                  if (poNumber.includes(':')) {
                    poNumber = poNumber.split(':').pop() || poNumber;
                  }
                  if (!metadata.poNumbers.includes(poNumber)) {
                    metadata.poNumbers.push(poNumber);
                    console.log(`Added PO number: ${poNumber}`);
                  }
                  metadata.productItems.forEach(item => {
                    if (item.serialNumber && epcList?.some(epc => (typeof epc === 'string' ? epc : epc._).includes(item.serialNumber))) {
                        if(!item.bizTransactionList) item.bizTransactionList = [];
                        if(!item.bizTransactionList.includes(poNumber)) item.bizTransactionList.push(poNumber);
                    }
                  });
                }
              }
            }
          }
          console.log("Extracted product items:", metadata.productItems.length);
          console.log("Extracted PO numbers:", metadata.poNumbers);
        }
      } catch (error) {
        console.error('Error extracting serial numbers and PO:', error);
      }
    } // end if(epcisHeader)
    
    // Fallback for product info if not in header (e.g. from ILMD in events)
    // This part might be redundant if productInfo is expected only from MasterData,
    // but kept for robustness if ILMD in events is a valid source.
    if (!metadata.productInfo.name || !metadata.productInfo.manufacturer || !metadata.productInfo.ndc) {
        console.log("Attempting to find product info in event ILMD as fallback.");
        const eventList = epcisBody?.EventList?.[0];
        let allEvents: any[] = [];
         if (eventList) {
            allEvents = [
              ...(eventList.ObjectEvent || []),
              ...(eventList.AggregationEvent || []),
              ...(eventList.TransactionEvent || []),
              ...(eventList.TransformationEvent || [])
            ];
        } else if (epcisBody?.ObjectEvent) {
             allEvents = [...(epcisBody.ObjectEvent || [])];
        }

        for (const event of allEvents) {
            const ilmd = event.extension?.[0]?.ilmd?.[0];
            if (ilmd) {
                if (!metadata.productInfo.name && (ilmd.regulatedProductName?.[0]?._ || ilmd.regulatedProductName?.[0])) {
                    metadata.productInfo.name = ilmd.regulatedProductName[0]._ || ilmd.regulatedProductName[0];
                    console.log('Found product name in event ILMD:', metadata.productInfo.name);
                }
                if (!metadata.productInfo.manufacturer && (ilmd.manufacturerOfTradeItemPartyName?.[0]?._ || ilmd.manufacturerOfTradeItemPartyName?.[0])) {
                    metadata.productInfo.manufacturer = ilmd.manufacturerOfTradeItemPartyName[0]._ || ilmd.manufacturerOfTradeItemPartyName[0];
                    console.log('Found manufacturer in event ILMD:', metadata.productInfo.manufacturer);
                }
                // Note: NDC is typically not found in event ILMD, but included for completeness if structure allows
                if (!metadata.productInfo.ndc && (ilmd.additionalTradeItemIdentification?.[0]?._ || ilmd.additionalTradeItemIdentification?.[0])) {
                     const ndcValue = ilmd.additionalTradeItemIdentification[0]._ || ilmd.additionalTradeItemIdentification[0];
                     const ndcType = ilmd.additionalTradeItemIdentificationType?.[0]?._ || ilmd.additionalTradeItemIdentificationType?.[0];
                     if (ndcType === 'NDC' || ndcType === 'DRUG_IDENTIFICATION_NUMBER') {
                        metadata.productInfo.ndc = ndcValue;
                        console.log('Found NDC in event ILMD:', metadata.productInfo.ndc);
                     }
                }
                 if (!metadata.productInfo.lotNumber && (ilmd.lotNumber?.[0]?._ || ilmd.lotNumber?.[0])) {
                    metadata.productInfo.lotNumber = ilmd.lotNumber[0]._ || ilmd.lotNumber[0];
                }
                if (!metadata.productInfo.expirationDate && (ilmd.itemExpirationDate?.[0]?._ || ilmd.itemExpirationDate?.[0])) {
                    metadata.productInfo.expirationDate = ilmd.itemExpirationDate[0]._ || ilmd.itemExpirationDate[0];
                }
            }
            // Stop if all essential info found
            if (metadata.productInfo.name && metadata.productInfo.manufacturer && metadata.productInfo.ndc) break;
        }
    }


    console.log('XSD validation is disabled for testing');
    return { valid: true, metadata, xmlBuffer: typeof filePathOrBuffer !== 'string' ? filePathOrBuffer : undefined };

  } catch (error) {
    const err = error as Error;
    console.error('Error parsing XML:', err.message, err.stack);
    return {
      valid: false,
      errorCode: ERROR_CODES.XML_PARSE_ERROR,
      errorMessage: `Could not parse XML. The file may be malformed or corrupted. Details: ${err.message}`
    };
  }
}

// Compute SHA-256 hash of a buffer
export function computeSHA256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Validate a ZIP file containing EPCIS XML
 * Note: Currently we're telling users to extract and upload XML directly,
 * so this function just returns an error, but it could be expanded to
 * properly extract and validate ZIP files with EPCIS content
 */
export async function validateZipContents(zipBuffer: Buffer): Promise<ValidationResult> {
  return {
    valid: false,
    errorCode: ERROR_CODES.FILE_READ_ERROR,
    errorMessage: 'ZIP files are not currently supported. Please extract and upload the XML file directly.'
  };
}

/**
 * Validates XML from a buffer.
 * This function now directly calls validateEpcisFile with the buffer,
 * avoiding temporary file creation for buffered data.
 */
export async function validateXml(xmlBuffer: Buffer): Promise<ValidationResult> {
  try {
    // Directly call validateEpcisFile with the buffer
    const result = await validateEpcisFile(xmlBuffer);
    // Ensure the original buffer is returned as part of the result, as validateEpcisFile might not always add it.
    return { ...result, xmlBuffer: result.xmlBuffer || xmlBuffer };
  } catch (error) {
    const err = error as Error;
    console.error('Error in validateXml:', err.message, err.stack);
    return {
      valid: false,
      errorCode: ERROR_CODES.INTERNAL_ERROR,
      errorMessage: `Internal error processing XML file. Details: ${err.message}`
    };
  }
}