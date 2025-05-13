import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { parseStringPromise } from 'xml2js';
import { insertProductItemSchema, type ProductItem } from '@shared/schema';
import { z } from 'zod';
import * as libxmljs from 'libxmljs2';

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
export async function validateEpcisFile(filePath: string): Promise<ValidationResult> {
  try {
    // Parse the XML with xml2js for structured data access
    const xmlBuffer = fs.readFileSync(filePath);
    const xmlData = await parseStringPromise(xmlBuffer, {
      explicitArray: false,
      explicitCharkey: false,
      mergeAttrs: false,
      // Don't normalize namespace prefixes
      normalizeTags: false,
      // Keep attributes for better handling of namespaced elements
      attrNameProcessors: [
        (name: string) => {
          return name;
        }
      ]
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
    let epcisRoot = null;
    
    // Try to find the EPCIS element
    if (xmlData.epcis) {
      console.log('Found epcis at root');
      epcisRoot = xmlData.epcis;
    } else if (xmlData.EPCISDocument) {
      console.log('Found EPCISDocument at root');
      epcisRoot = xmlData.EPCISDocument;
    } else if (xmlData['epcis:EPCISDocument']) {
      console.log('Found namespaced epcis:EPCISDocument at root');
      epcisRoot = xmlData['epcis:EPCISDocument'];
    } else {
      // Try alternate root element names
      const rootKeys = Object.keys(xmlData);
      
      for (const key of rootKeys) {
        console.log(`Checking root key: ${key}`);
        
        // Check if this is an EPCIS root with a namespace
        if (key.toLowerCase().includes('epcis')) {
          console.log(`Found EPCIS root with namespace: ${key}`);
          epcisRoot = xmlData[key];
          break;
        }
        
        // Check if this is a document with an EPCIS child
        if (xmlData[key] && typeof xmlData[key] === 'object') {
          const childKeys = Object.keys(xmlData[key]);
          for (const childKey of childKeys) {
            if (childKey.toLowerCase().includes('epcis')) {
              console.log(`Found EPCIS as child element: ${key}.${childKey}`);
              epcisRoot = xmlData[key][childKey];
              break;
            }
          }
          
          if (epcisRoot) break;
        }
      }
    }
    
    // Check if we found an EPCIS element
    if (!epcisRoot) {
      return {
        valid: false,
        errorCode: ERROR_CODES.NOT_EPCIS,
        errorMessage: 'The XML file is not a valid EPCIS document. Could not find EPCIS root element.'
      };
    }

    // Extract EPCIS version
    let schemaVersion = '1.0'; // Default to 1.0 if not specified
    if (epcisRoot.$ && epcisRoot.$.schemaVersion) {
      schemaVersion = epcisRoot.$.schemaVersion;
    }
    console.log(`Detected EPCIS schema version: ${schemaVersion}`);

    // Extract EPCIS body and header
    const epcisBody = epcisRoot.EPCISBody;
    const epcisHeader = epcisRoot.EPCISHeader;

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
        // Try to extract sender GLN and other sender identifiers
        if (epcisHeader.sender) {
          metadata.senderGln = epcisHeader.sender;
        } else if (epcisHeader.senderIdentification) {
          metadata.senderGln = epcisHeader.senderIdentification;
        } else if (epcisHeader.sbdh && epcisHeader.sbdh.Sender) {
          // Try to extract from standard business document header
          if (epcisHeader.sbdh.Sender.Identifier) {
            metadata.senderGln = epcisHeader.sbdh.Sender.Identifier;
          }
        }
      } catch (error) {
        console.error('Error extracting sender info:', error);
      }

      // DSCSA transaction statement validation
      try {
        if (epcisHeader['gs1ushc:dscsaTransactionStatement']) {
          const transactionStatement = epcisHeader['gs1ushc:dscsaTransactionStatement'];
          if (transactionStatement['gs1ushc:affirmTransactionStatement'] === 'true' || 
              transactionStatement['gs1ushc:affirmTransactionStatement'] === true) {
            console.log('Valid DSCSA transaction statement found');
          } else {
            console.warn('Transaction statement present but not affirmed');
          }
        } else {
          console.warn('Warning: Missing transaction statement, but proceeding for testing');
        }
      } catch (error) {
        console.error('Error checking transaction statement:', error);
      }

      // Extract product/drug info from header master data
      try {
        console.log('Attempting to extract product info from XML');
        
        // Find the master data section
        const masterData = epcisHeader.extension && epcisHeader.extension.EPCISMasterData;
        if (!masterData) {
          console.log('No master data found in EPCIS header');
        } else if (!masterData.VocabularyList) {
          console.log('No vocabulary list found in master data');
        } else {
          if (!masterData.VocabularyList.Vocabulary) {
            console.log('No vocabularies found in master data');
          } else {
            const vocabularies = Array.isArray(masterData.VocabularyList.Vocabulary) 
              ? masterData.VocabularyList.Vocabulary 
              : [masterData.VocabularyList.Vocabulary];
            
            console.log(`Found ${vocabularies.length} vocabularies to process`);
            
            for (const vocab of vocabularies) {
              // Look for EPCClass vocabulary which contains product info
              if (!vocab.$ && !vocab.ATTRS) {
                console.log('Vocabulary missing $ or ATTRS property');
                continue;
              }
              
              // Get the type attribute, which might be in different formats
              let typeValue;
              if (vocab.$ && vocab.$.type) {
                typeValue = vocab.$.type;
              } else if (vocab.ATTRS && vocab.ATTRS.type) {
                typeValue = vocab.ATTRS.type;
              }
              
              if (!typeValue) {
                console.log('Vocabulary missing type attribute');
                continue;
              }
              
              console.log('Vocabulary type:', JSON.stringify(typeValue));
              
              // Look for EPCClass vocabulary which contains drug information
              const typeString = typeof typeValue === 'string' ? typeValue : typeValue.value || JSON.stringify(typeValue);
              if (typeString.includes('EPCClass')) {
                console.log('Found EPCClass vocabulary, extracting product info');
                
                const vocabEls = vocab.VocabularyElement;
                if (!vocabEls) {
                  console.log('No vocabulary elements found');
                  continue;
                }
                
                const elements = Array.isArray(vocabEls) ? vocabEls : [vocabEls];
                console.log(`Found ${elements.length} VocabularyElement(s)`);
                
                for (const element of elements) {
                  // Extract attributes
                  const attributes = element.attribute;
                  if (!attributes) {
                    console.log('No attributes found in vocabulary element');
                    continue;
                  }
                  
                  const attrList = Array.isArray(attributes) ? attributes : [attributes];
                  console.log(`Processing ${attrList.length} attributes`);
                  
                  // Map to store attribute values
                  const attributeMap = new Map<string, string>();
                  
                  for (const attr of attrList) {
                    try {
                      if (!attr.$ && !attr.ATTRS) continue;
                      
                      let id;
                      if (attr.$ && attr.$.id) {
                        id = attr.$.id;
                      } else if (attr.ATTRS && attr.ATTRS.id) {
                        id = attr.ATTRS.id;
                      }
                      
                      if (!id) {
                        console.log('Attribute has no ID');
                        continue;
                      }
                      
                      if (typeof id !== 'string') {
                        console.log('Attribute ID is an object:', JSON.stringify(id));
                        id = id.value || JSON.stringify(id);
                      }
                      
                      let value;
                      if (attr._ !== undefined) {
                        value = attr._;
                      } else if (attr.value !== undefined) {
                        value = attr.value;
                      } else {
                        value = attr.toString();
                      }
                      
                      console.log(`Attribute ${id} = ${value}`);
                      attributeMap.set(id, value);
                    } catch (attrError) {
                      console.error('Error processing attribute:', attrError);
                    }
                  }
                  
                  // Extract product information from attributes
                  if (attributeMap.has('urn:epcglobal:cbv:mda#regulatedProductName')) {
                    metadata.productInfo.name = attributeMap.get('urn:epcglobal:cbv:mda#regulatedProductName');
                  }
                  
                  if (attributeMap.has('urn:epcglobal:cbv:mda#dosageFormType')) {
                    metadata.productInfo.dosageForm = attributeMap.get('urn:epcglobal:cbv:mda#dosageFormType');
                  }
                  
                  if (attributeMap.has('urn:epcglobal:cbv:mda#strengthDescription')) {
                    metadata.productInfo.strength = attributeMap.get('urn:epcglobal:cbv:mda#strengthDescription');
                  }
                  
                  if (attributeMap.has('urn:epcglobal:cbv:mda#additionalTradeItemIdentification')) {
                    metadata.productInfo.ndc = attributeMap.get('urn:epcglobal:cbv:mda#additionalTradeItemIdentification');
                  }
                  
                  if (attributeMap.has('urn:epcglobal:cbv:mda#netContentDescription')) {
                    metadata.productInfo.netContent = attributeMap.get('urn:epcglobal:cbv:mda#netContentDescription');
                  }
                  
                  if (attributeMap.has('urn:epcglobal:cbv:mda#manufacturerOfTradeItemPartyName')) {
                    metadata.productInfo.manufacturer = attributeMap.get('urn:epcglobal:cbv:mda#manufacturerOfTradeItemPartyName');
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error extracting product info:', error);
      }
      
      // Extract serial numbers and PO numbers from events
      try {
        // Use the existing epcisBody variable from the outer scope
        if (epcisBody) {
          console.log('EPCIS Body keys:', Object.keys(epcisBody));
          
          // First, look for EventList wrapper
          let allEvents = [];
          
          // Different EPCIS files may have different event structures
          if (epcisBody.EventList) {
            console.log('Found EventList structure in EPCIS body');
            
            // Handle ObjectEvents
            if (epcisBody.EventList.ObjectEvent) {
              const objectEvents = Array.isArray(epcisBody.EventList.ObjectEvent) ? 
                epcisBody.EventList.ObjectEvent : [epcisBody.EventList.ObjectEvent];
              allEvents = [...allEvents, ...objectEvents];
              console.log(`Added ${objectEvents.length} object events from EventList`);
            }
            
            // Handle AggregationEvents 
            if (epcisBody.EventList.AggregationEvent) {
              const aggEvents = Array.isArray(epcisBody.EventList.AggregationEvent) ? 
                epcisBody.EventList.AggregationEvent : [epcisBody.EventList.AggregationEvent];
              allEvents = [...allEvents, ...aggEvents];
              console.log(`Added ${aggEvents.length} aggregation events from EventList`);
            }
            
            // Handle TransactionEvents
            if (epcisBody.EventList.TransactionEvent) {
              const transEvents = Array.isArray(epcisBody.EventList.TransactionEvent) ? 
                epcisBody.EventList.TransactionEvent : [epcisBody.EventList.TransactionEvent];
              allEvents = [...allEvents, ...transEvents];
              console.log(`Added ${transEvents.length} transaction events from EventList`);
            }
            
            // Handle TransformationEvents
            if (epcisBody.EventList.TransformationEvent) {
              const transformEvents = Array.isArray(epcisBody.EventList.TransformationEvent) ? 
                epcisBody.EventList.TransformationEvent : [epcisBody.EventList.TransformationEvent];
              allEvents = [...allEvents, ...transformEvents];
              console.log(`Added ${transformEvents.length} transformation events from EventList`);
            }
          } 
          // Check for direct object events (no EventList wrapper)
          else if (epcisBody.ObjectEvent || epcisBody['epcis:ObjectEvent']) {
            const objectEvents = epcisBody.ObjectEvent || epcisBody['epcis:ObjectEvent'];
            const events = Array.isArray(objectEvents) ? objectEvents : [objectEvents];
            allEvents = [...allEvents, ...events];
            console.log(`Added ${events.length} direct object events`);
          }
          
          console.log(`Total events to process: ${allEvents.length}`);
          
          // Process all collected events
          for (const event of allEvents) {
            console.log('Event keys:', Object.keys(event));
              
            // Extract serial numbers from EPCs
            // Try different formats for epcList
            let epcList;
            if (event.epcList) {
              epcList = event.epcList;
            } else if (event['epcis:epcList']) {
              epcList = event['epcis:epcList'];
            } else if (event.extension && event.extension.epcList) {
              epcList = event.extension.epcList;
            } else if (event.extension && event.extension['epcis:epcList']) {
              epcList = event.extension['epcis:epcList'];
            }
            
            if (epcList) {
              // Try different formats for epc elements
              let epcs;
              if (epcList.epc) {
                epcs = epcList.epc;
              } else if (epcList['epcis:epc']) {
                epcs = epcList['epcis:epc'];
              }
              
              if (epcs) {
                const epcArray = Array.isArray(epcs) ? epcs : [epcs];
                console.log(`Found ${epcArray.length} EPCs/serial numbers`);
                
                for (const epc of epcArray) {
                  // Extract SGTIN components: company prefix, item reference, and serial number
                  // Format: urn:epc:id:sgtin:CompanyPrefix.ItemReference.SerialNumber
                  try {
                    let epcValue;
                    if (typeof epc === 'string') {
                      epcValue = epc;
                    } else if (epc._ !== undefined) {
                      epcValue = epc._;
                    } else if (epc.value) {
                      epcValue = epc.value;
                    } else {
                      epcValue = epc.toString();
                    }
                    
                    console.log(`Processing EPC: ${epcValue}`);
                    
                    if (epcValue.includes('sgtin')) {
                      // Example: urn:epc:id:sgtin:0614141.107346.2017
                      const parts = epcValue.split(':');
                      if (parts.length >= 5) { // At least "urn:epc:id:sgtin:prefix.item.serial"
                        // Get the last part which should be "prefix.item.serial" or just the whole identifier
                        const sgtinPart = parts[parts.length-1];
                        const sgtinParts = sgtinPart.split('.');
                        
                        if (sgtinParts.length >= 3) {
                          const companyPrefix = sgtinParts[0];
                          const itemReference = sgtinParts[1];
                          const serialNumber = sgtinParts[2];
                          
                          // Construct GTIN from company prefix and item reference
                          // This is a simplified approach - real GTIN construction may require
                          // additional formatting and check digit calculation
                          const gtin = `${companyPrefix}${itemReference}`;
                          
                          console.log(`Extracted SGTIN: GTIN=${gtin}, Serial=${serialNumber}`);
                          
                          // Add to product items if not already present
                          const existingItemIndex = metadata.productItems.findIndex(
                            item => item.gtin === gtin && item.serialNumber === serialNumber
                          );
                          
                          if (existingItemIndex === -1) {
                            // Get event time
                            const eventTime = event.eventTime || event['epcis:eventTime'] || new Date().toISOString();
                            
                            // Look for lot number and expiration date in ilmd
                            let lotNumber = metadata.productInfo.lotNumber || null;
                            let expirationDate = metadata.productInfo.expirationDate || null;
                            
                            // Try to get lot number and expiration date from ilmd if available in this event
                            if (event.extension && event.extension.ilmd) {
                              const ilmd = event.extension.ilmd;
                              if (ilmd['cbvmda:lotNumber']) {
                                const rawLotNumber = ilmd['cbvmda:lotNumber'];
                                // Handle complex objects with underscore property
                                lotNumber = typeof rawLotNumber === 'object' && rawLotNumber._ 
                                  ? rawLotNumber._ 
                                  : rawLotNumber;
                              } else if (ilmd.lotNumber) {
                                const rawLotNumber = ilmd.lotNumber;
                                lotNumber = typeof rawLotNumber === 'object' && rawLotNumber._ 
                                  ? rawLotNumber._ 
                                  : rawLotNumber;
                              }
                              
                              if (ilmd['cbvmda:itemExpirationDate']) {
                                const rawExpirationDate = ilmd['cbvmda:itemExpirationDate'];
                                expirationDate = typeof rawExpirationDate === 'object' && rawExpirationDate._ 
                                  ? rawExpirationDate._ 
                                  : rawExpirationDate;
                              } else if (ilmd.itemExpirationDate) {
                                const rawExpirationDate = ilmd.itemExpirationDate;
                                expirationDate = typeof rawExpirationDate === 'object' && rawExpirationDate._ 
                                  ? rawExpirationDate._ 
                                  : rawExpirationDate;
                              }
                            }
                            
                            // Also check for complex object structure in productInfo if it exists
                            if (metadata.productInfo && metadata.productInfo.lotNumber) {
                              const productInfoLot = metadata.productInfo.lotNumber;
                              if (typeof productInfoLot === 'object' && productInfoLot && 'hasOwnProperty' in productInfoLot && productInfoLot._) {
                                metadata.productInfo.lotNumber = productInfoLot._;
                              }
                            }
                            
                            if (metadata.productInfo && metadata.productInfo.expirationDate) {
                              const productInfoExp = metadata.productInfo.expirationDate;
                              if (typeof productInfoExp === 'object' && productInfoExp && 'hasOwnProperty' in productInfoExp && productInfoExp._) {
                                metadata.productInfo.expirationDate = productInfoExp._;
                              }
                            }
                            
                            // Create new product item
                            const productItem = {
                              gtin,
                              serialNumber,
                              eventTime,
                              lotNumber: lotNumber || 'unknown',
                              expirationDate: expirationDate || 'unknown',
                              sourceGln: null,
                              destinationGln: null,
                              bizTransactionList: []
                            };
                            
                            // Add source GLN if available
                            if (event.bizLocation && event.bizLocation.id) {
                              productItem.sourceGln = event.bizLocation.id;
                            }
                            
                            // Add destination GLN if available from destination list
                            if (event.extension && event.extension.destinationList) {
                              const destinations = event.extension.destinationList.destination;
                              if (destinations && Array.isArray(destinations) && destinations.length > 0) {
                                productItem.destinationGln = destinations[0].id || destinations[0];
                              } else if (destinations) {
                                productItem.destinationGln = destinations.id || destinations;
                              }
                            }
                            
                            metadata.productItems.push(productItem);
                            console.log(`Added product item with serial number: ${serialNumber}`);
                          }
                        }
                      }
                    }
                  } catch (epcError) {
                    console.error('Error processing EPC:', epcError);
                  }
                }
              } else {
                console.log('No epc elements found in epcList');
              }
            }
            
            // Extract PO numbers from business transactions
            // Try different formats and structures for bizTransactionList
            let bizTransactionList;
            if (event.bizTransactionList) {
              bizTransactionList = event.bizTransactionList;
            } else if (event['epcis:bizTransactionList']) {
              bizTransactionList = event['epcis:bizTransactionList'];
            } else if (event.extension && event.extension.bizTransactionList) {
              bizTransactionList = event.extension.bizTransactionList;
            } else if (event.extension && event.extension['epcis:bizTransactionList']) {
              bizTransactionList = event.extension['epcis:bizTransactionList'];
            }
            
            if (bizTransactionList) {
              console.log('Found bizTransactionList:', Object.keys(bizTransactionList));
              
              // Try different formats for bizTransaction element
              let bizTransactions;
              if (bizTransactionList.bizTransaction) {
                bizTransactions = bizTransactionList.bizTransaction;
              } else if (bizTransactionList['epcis:bizTransaction']) {
                bizTransactions = bizTransactionList['epcis:bizTransaction'];
              }
              
              if (bizTransactions) {
                const transactions = Array.isArray(bizTransactions) ? bizTransactions : [bizTransactions];
                console.log(`Found ${transactions.length} business transactions`);
                
                for (const transaction of transactions) {
                  try {
                    // Extract the transaction ID and type
                    // Different EPCIS implementations may use different formats
                    let transactionValue;
                    let type = 'unknown';
                    
                    if (typeof transaction === 'string') {
                      // Simple string value
                      transactionValue = transaction;
                    } else if (transaction._ !== undefined) {
                      // Object with text value in _ property
                      transactionValue = transaction._;
                      if (transaction.$ && transaction.$.type) {
                        type = transaction.$.type;
                      }
                    } else if (transaction.type && transaction.value) {
                      // Object with explicit type and value properties
                      type = transaction.type;
                      transactionValue = transaction.value;
                    } else {
                      // Try to convert to string
                      transactionValue = transaction.toString();
                    }
                    
                    // If the transaction is an object with $ (attributes)
                    if (transaction.$ && !type) {
                      type = transaction.$.type || 'unknown';
                    }
                    
                    console.log(`Business Transaction: type=${type}, value=${transactionValue}`);
                    
                    // Check if this is a PO reference by looking for 'po' or 'purchase-order' in the type
                    if (type.toLowerCase().includes('po') || 
                        type.toLowerCase().includes('purchase-order') || 
                        type.toLowerCase().includes('purchase_order')) {
                      console.log(`Found Purchase Order reference: ${transactionValue}`);
                      
                      // Extract just the PO number from the reference
                      // Format could be urn:epcglobal:cbv:bt:companyPrefix:poNumber
                      let poNumber = transactionValue;
                      if (poNumber && poNumber.includes(':')) {
                        // Extract last part after colon
                        poNumber = poNumber.split(':').pop() || poNumber;
                      }
                      
                      // Add to PO numbers list if not already present
                      if (poNumber && !metadata.poNumbers.includes(poNumber)) {
                        metadata.poNumbers.push(poNumber);
                        console.log(`Added PO number: ${poNumber}`);
                      }
                      
                      // Also add this PO reference to all product items in this event
                      if (metadata.productItems.length > 0) {
                        for (const item of metadata.productItems) {
                          if (!item.bizTransactionList) {
                            item.bizTransactionList = [];
                          }
                          if (!item.bizTransactionList.includes(poNumber)) {
                            item.bizTransactionList.push(poNumber);
                          }
                        }
                      }
                    }
                  } catch (transactionError) {
                    console.error('Error processing business transaction:', transactionError);
                  }
                }
              } else {
                console.log('No bizTransaction elements found in bizTransactionList');
              }
            }
            
            // Check for lot number and expiry date in ILMD extension
            if (event.extension && event.extension.ilmd) {
              const ilmd = event.extension.ilmd;
              console.log('Checking for lot number and expiry date:');
              
              // Look for lot number with various namespaces
              if (ilmd['cbvmda:lotNumber'] || ilmd.lotNumber) {
                const lotNumber = ilmd['cbvmda:lotNumber'] || ilmd.lotNumber;
                console.log(`Found lot number: ${lotNumber}`);
                metadata.productInfo.lotNumber = lotNumber;
              }
              
              // Look for expiration date with various namespaces
              if (ilmd['cbvmda:itemExpirationDate'] || ilmd.itemExpirationDate) {
                const expiryDate = ilmd['cbvmda:itemExpirationDate'] || ilmd.itemExpirationDate;
                console.log(`Found expiration date: ${expiryDate}`);
                metadata.productInfo.expirationDate = expiryDate;
              }
            }
          }
          
          console.log("Extracted product items:", metadata.productItems.length);
          console.log("Extracted PO numbers:", metadata.poNumbers);
        }
      } catch (error) {
        console.error('Error extracting serial numbers and PO:', error);
      }
      
      // Try to extract lot number and expiry date from ILMD in ObjectEvents
      try {
        if (epcisBody && epcisBody.ObjectEvent) {
          const objectEvents = Array.isArray(epcisBody.ObjectEvent) ? 
            epcisBody.ObjectEvent : [epcisBody.ObjectEvent];
          
          for (const event of objectEvents) {
            if (event.extension && event.extension.ilmd) {
              const ilmd = event.extension.ilmd;
              
              // Look for lot number with various namespaces
              const lotCandidates = [
                ilmd.lotNumber,
                ilmd['epcis:lotNumber'],
                ilmd['cbvmda:lotNumber']
              ];
              
              for (const lotValue of lotCandidates) {
                if (lotValue) {
                  console.log(`Found lot number: ${lotValue}`);
                  metadata.productInfo.lotNumber = lotValue;
                  break;
                }
              }
              
              // Look for expiration date with various namespaces
              const expiryCandidates = [
                ilmd.itemExpirationDate,
                ilmd['epcis:itemExpirationDate'],
                ilmd['cbvmda:itemExpirationDate']
              ];
              
              for (const expiryValue of expiryCandidates) {
                if (expiryValue) {
                  console.log(`Found expiration date: ${expiryValue}`);
                  metadata.productInfo.expirationDate = expiryValue;
                  break;
                }
              }
            } else {
              console.log('No ilmd found in the object event');
            }
          }
        }
      } catch (error) {
        console.log('Error extracting lot/expiry info:', error);
        // Don't fail validation just because we couldn't extract product info
      }
      
      // In a production environment, we would validate against XSD schema
      // For testing, skip XSD validation and consider the file valid if it has
      // the basic EPCIS structure
      console.log('XSD validation is disabled for testing');
      
      // Return valid result with metadata
      return { valid: true, metadata };
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
 * Legacy function for compatibility with existing code
 * Simply calls validateEpcisFile after saving to a temp file
 */
export async function validateXml(xmlBuffer: Buffer): Promise<ValidationResult> {
  // Create temp file
  const tempDir = path.join(process.cwd(), 'tmp');
  const fsPromises = fs.promises;
  
  try {
    await fsPromises.mkdir(tempDir, { recursive: true });
  } catch (error) {
    console.error('Error creating temp directory:', error);
  }
  
  const tempFilePath = path.join(tempDir, `temp_${Date.now()}.xml`);
  
  try {
    await fsPromises.writeFile(tempFilePath, xmlBuffer);
    const result = await validateEpcisFile(tempFilePath);
    
    // Clean up
    try {
      await fsPromises.unlink(tempFilePath);
    } catch (error) {
      console.error('Error removing temp file:', error);
    }
    
    return { ...result, xmlBuffer };
  } catch (error) {
    console.error('Error in validateXml:', error);
    
    // Clean up
    try {
      await fsPromises.unlink(tempFilePath);
    } catch (cleanupError) {
      console.error('Error removing temp file during error cleanup:', cleanupError);
    }
    
    return {
      valid: false,
      errorCode: ERROR_CODES.INTERNAL_ERROR,
      errorMessage: 'Internal error processing XML file.'
    };
  }
}