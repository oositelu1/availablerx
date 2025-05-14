import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { exec as execCb } from 'child_process';
import tmp from 'tmp';
import axios from 'axios';
import { storage } from './storage';
import { validateXml, computeSHA256, ERROR_CODES } from './validators';
import { InsertFile, InsertTransmission, File } from '@shared/schema';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { sendFileShareNotification } from './email-service';
import { parseStringPromise } from 'xml2js';

const exec = promisify(execCb);

// Create a temporary directory for file processing
const TMP_DIR = path.join(process.cwd(), 'tmp');

// Ensure temp directory exists
async function ensureTempDir() {
  try {
    await fs.mkdir(TMP_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating temp directory:', error);
  }
}

// Generate a unique file name
function generateUniqueFileName(): string {
  return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Extract product details directly from EPCIS XML buffer
 * Focuses on extracting product name and manufacturer information
 */
async function extractProductDetails(xmlBuffer: Buffer): Promise<{ name?: string; manufacturer?: string; ndc?: string }> {
  try {
    // Parse the XML with specific options to preserve namespaces
    const parsedXml = await parseStringPromise(xmlBuffer, {
      explicitArray: true,      // Changed to true to handle arrays consistently
      explicitCharkey: true,    // Changed to true to ensure text content is consistent
      mergeAttrs: false,        // Keep attributes separate
      normalizeTags: false,     // Preserve case and namespaces
      xmlns: true,              // Track namespaces
      tagNameProcessors: []     // Don't process tag names
    });
    
    console.log('Extracting product details from XML');
    
    // Initialize result
    const result: { name?: string; manufacturer?: string; ndc?: string } = {};
    
    // Extract from EPCISHeader/extension/EPCISMasterData
    try {
      // Handle both namespace and non-namespace versions
      const epcisDocument = parsedXml['epcis:EPCISDocument'] || parsedXml['EPCISDocument'];
      if (!epcisDocument) {
        console.log('No EPCISDocument found at root');
        return result;
      }
      
      // First try to find master data in the header
      const epcisHeader = epcisDocument['EPCISHeader'] || epcisDocument['epcis:EPCISHeader'];
      if (epcisHeader && epcisHeader[0]) {
        const extension = epcisHeader[0]['extension'];
        if (extension && extension[0]) {
          const masterData = extension[0]['EPCISMasterData'];
          if (masterData && masterData[0]) {
            const vocabList = masterData[0]['VocabularyList'];
            if (vocabList && vocabList[0]) {
              const vocabularies = vocabList[0]['Vocabulary'];
              if (vocabularies) {
                // Process each vocabulary
                for (const vocabulary of vocabularies) {
                  // Look for EPCClass vocabulary which contains product info
                  if (vocabulary.$ && vocabulary.$.type === 'urn:epcglobal:epcis:vtype:EPCClass') {
                    console.log('Found EPCClass vocabulary in master data');
                    const elemList = vocabulary['VocabularyElementList'];
                    if (elemList && elemList[0]) {
                      const elements = elemList[0]['VocabularyElement'];
                      if (elements) {
                        // Process each vocabulary element
                        for (const element of elements) {
                          const attributes = element['attribute'];
                          if (attributes) {
                            // Check each attribute for product info
                            for (const attr of attributes) {
                              if (attr.$ && attr.$.id) {
                                const attrId = attr.$.id;
                                let attrValue = '';
                                
                                // Extract the value (might be in different forms)
                                if (attr._) {
                                  attrValue = attr._;
                                } else if (attr.$ && attr.$._) {
                                  attrValue = attr.$._; 
                                } else if (attr.$ && attr.$.value) {
                                  attrValue = attr.$.value;
                                }
                                
                                // Match product name
                                if (attrId === 'urn:epcglobal:cbv:mda#regulatedProductName') {
                                  console.log('Found product name in EPCISHeader:', attrValue);
                                  result.name = attrValue;
                                }
                                
                                // Match manufacturer
                                if (attrId === 'urn:epcglobal:cbv:mda#manufacturerOfTradeItemPartyName') {
                                  console.log('Found manufacturer in EPCISHeader:', attrValue);
                                  result.manufacturer = attrValue;
                                }
                                
                                // Match NDC
                                if (attrId === 'urn:epcglobal:cbv:mda#additionalTradeItemIdentification') {
                                  console.log('Found NDC in EPCISHeader:', attrValue);
                                  result.ndc = attrValue;
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      
      // If we haven't found the data yet, try to extract from events in EPCISBody
      if (!result.name || !result.manufacturer) {
        console.log('Looking for product data in EPCISBody events');
        const epcisBody = epcisDocument['EPCISBody'] || epcisDocument['epcis:EPCISBody'];
        if (epcisBody && epcisBody[0]) {
          // Look in extension/EPCISMasterData in body
          if (epcisBody[0]['extension'] && epcisBody[0]['extension'][0]['EPCISMasterData']) {
            const masterData = epcisBody[0]['extension'][0]['EPCISMasterData'];
            const vocabList = masterData[0]['VocabularyList'];
            if (vocabList && vocabList[0]) {
              const vocabularies = vocabList[0]['Vocabulary'];
              for (const vocab of vocabularies) {
                if (vocab.$ && vocab.$.type === 'urn:epcglobal:epcis:vtype:EPCClass') {
                  console.log('Found EPCClass vocabulary in Body extension');
                  const elemList = vocab['VocabularyElementList'];
                  if (elemList && elemList[0]) {
                    const elements = elemList[0]['VocabularyElement'];
                    if (elements) {
                      for (const elem of elements) {
                        const attributes = elem['attribute'];
                        if (attributes) {
                          // Check each attribute for product info
                          for (const attr of attributes) {
                            if (attr.$ && attr.$.id) {
                              const attrId = attr.$.id;
                              let attrValue = '';
                              
                              // Extract value from different possible locations
                              if (attr._ !== undefined) {
                                attrValue = attr._;
                              } else if (attr['$'] && attr['$']['_']) {
                                attrValue = attr['$']['_'];
                              } else if (attr['$'] && attr['$']['value']) {
                                attrValue = attr['$']['value'];
                              } else if (Array.isArray(attr) && attr.length > 0 && attr[0]._) {
                                attrValue = attr[0]._;
                              }
                              
                              // Product name
                              if (attrId === 'urn:epcglobal:cbv:mda#regulatedProductName') {
                                console.log('Found product name in body extension:', attrValue);
                                result.name = attrValue;
                              }
                              
                              // Manufacturer
                              if (attrId === 'urn:epcglobal:cbv:mda#manufacturerOfTradeItemPartyName') {
                                console.log('Found manufacturer in body extension:', attrValue);
                                result.manufacturer = attrValue;
                              }
                              
                              // NDC
                              if (attrId === 'urn:epcglobal:cbv:mda#additionalTradeItemIdentification') {
                                console.log('Found NDC in body extension:', attrValue);
                                result.ndc = attrValue;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
          
          // Also check for ilmd extension in object events
          const eventList = epcisBody[0]['EventList'];
          if (eventList && eventList[0]) {
            // Check all types of events for ilmd extension
            const objectEvents = eventList[0]['ObjectEvent'] || [];
            for (const event of objectEvents) {
              if (event['ilmd'] && event['ilmd'][0]) {
                const ilmd = event['ilmd'][0];
                // Look for lot and expiry data attributes that might contain product info
                Object.keys(ilmd).forEach(key => {
                  // These sometimes contain product info
                  if (key.includes('cbvmda:regulatedProductName')) {
                    const value = ilmd[key][0]._;
                    if (value) {
                      console.log('Found product name in ilmd:', value);
                      result.name = value;
                    }
                  }
                  if (key.includes('cbvmda:manufacturerOfTradeItemPartyName')) {
                    const value = ilmd[key][0]._;
                    if (value) {
                      console.log('Found manufacturer in ilmd:', value);
                      result.manufacturer = value;
                    }
                  }
                });
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Error while parsing XML structure:', err);
    }
    
    console.log('Product extraction result:', result);
    return result;
  } catch (error) {
    console.error('Error extracting product details:', error);
    return {};
  }
}

// Process uploaded file
export async function processFile(
  fileBuffer: Buffer, 
  originalFilename: string, 
  fileType: string,
  userId: number
): Promise<{
  success: boolean;
  file?: File;
  errorCode?: string;
  errorMessage?: string;
  schemaErrors?: string[];
}> {
  // Ensure temp directory exists
  await ensureTempDir();
  
  try {
    // Determine file type from extension if MIME type is ambiguous
    const extension = path.extname(originalFilename).toLowerCase();
    const isZip = fileType === 'application/zip' || extension === '.zip';
    const isXml = fileType.includes('xml') || extension === '.xml';
    
    if (!isZip && !isXml) {
      return {
        success: false,
        errorCode: ERROR_CODES.INTERNAL_ERROR, // Using INTERNAL_ERROR since INVALID_FILE_TYPE doesn't exist
        errorMessage: 'Unsupported file type. Please upload a ZIP or XML file.'
      };
    }
    
    let xmlBuffer: Buffer;
    
    // We don't handle ZIP files currently, only direct XML
    if (isZip) {
      return {
        success: false,
        errorCode: ERROR_CODES.FILE_READ_ERROR,
        errorMessage: 'ZIP files are not supported. Please extract and upload the XML file directly.'
      };
    } else {
      // It's an XML file, use it directly
      xmlBuffer = fileBuffer;
    }
    
    // Save XML to temp file for validation
    await ensureTempDir();
    const tempFilePath = path.join(TMP_DIR, `temp_${Date.now()}.xml`);
    await fs.writeFile(tempFilePath, xmlBuffer);
    
    // Validate the XML content against EPCIS 1.2 schema
    // Use validateXml which has the improved namespacing support
    const xmlValidation = await validateXml(xmlBuffer);
    
    // Clean up temp file - we don't need it anymore since validateXml handles temp files
    try {
      await fs.unlink(tempFilePath);
    } catch (error) {
      console.error('Error removing temp file:', error);
    }
    
    if (!xmlValidation.valid) {
      return {
        success: false,
        errorCode: xmlValidation.errorCode,
        errorMessage: xmlValidation.errorMessage,
        schemaErrors: xmlValidation.schemaErrors
      };
    }
    
    // Generate SHA-256 for the original file
    const sha256 = computeSHA256(fileBuffer);
    
    // Create a unique storage path for the file
    const uniqueFileName = generateUniqueFileName();
    const storagePath = `${uniqueFileName}${isZip ? '.zip' : '.xml'}`;
    
    // Extract product name and manufacturer directly from the XML
    try {
      const extractResult = await extractProductDetails(xmlBuffer);
      console.log('Direct extraction result:', extractResult);
      
      if (xmlValidation.metadata && xmlValidation.metadata.productInfo) {
        if (extractResult.name) {
          console.log('Setting product name from direct extraction:', extractResult.name);
          xmlValidation.metadata.productInfo.name = extractResult.name;
        }
        
        if (extractResult.manufacturer) {
          console.log('Setting manufacturer from direct extraction:', extractResult.manufacturer);
          xmlValidation.metadata.productInfo.manufacturer = extractResult.manufacturer;
        }
      } else if (xmlValidation.metadata) {
        xmlValidation.metadata.productInfo = {
          name: extractResult.name || undefined, 
          manufacturer: extractResult.manufacturer || undefined
        };
      }
    } catch (error) {
      console.error('Error during direct product extraction:', error);
    }
    
    // Save file data
    const fileData: InsertFile = {
      originalName: originalFilename,
      storagePath: storagePath,
      fileSize: fileBuffer.length,
      fileType: isZip ? 'ZIP' : 'XML',
      sha256,
      status: 'validated',
      metadata: xmlValidation.metadata,
      uploadedBy: userId
    };
    
    // Store the file in the database
    const file = await storage.createFile(fileData);
    
    // Store the actual file data
    await storage.storeFileData(fileBuffer, file.id);
    
    // Extract and store product items if available
    if (xmlValidation.metadata?.productItems && Array.isArray(xmlValidation.metadata.productItems)) {
      try {
        console.log(`Extracting ${xmlValidation.metadata.productItems.length} product items from EPCIS file`);
        
        for (const item of xmlValidation.metadata.productItems) {
          try {
            // Check required fields are present
            if (!item.gtin || !item.serialNumber || !item.lotNumber || !item.expirationDate) {
              console.warn('Skipping product item with missing required fields:', item);
              continue;
            }
            
            // Extract values from potentially complex objects
            let lotNumber = item.lotNumber;
            let expirationDate = item.expirationDate;
            let serialNumber = item.serialNumber;
            let gtin = item.gtin;
            
            // Handle complex objects with underscore property
            if (typeof lotNumber === 'object' && lotNumber && 'hasOwnProperty' in lotNumber && lotNumber._) {
              lotNumber = lotNumber._;
            }
            
            if (typeof expirationDate === 'object' && expirationDate && 'hasOwnProperty' in expirationDate && expirationDate._) {
              expirationDate = expirationDate._;
            }
            
            if (typeof serialNumber === 'object' && serialNumber && 'hasOwnProperty' in serialNumber && serialNumber._) {
              serialNumber = serialNumber._;
            }
            
            if (typeof gtin === 'object' && gtin && 'hasOwnProperty' in gtin && gtin._) {
              gtin = gtin._;
            }
            
            // Create a product item record
            await storage.createProductItem({
              fileId: file.id,
              gtin: gtin,
              serialNumber: serialNumber,
              lotNumber: lotNumber,
              // Convert to ISO string and extract just the date part (YYYY-MM-DD)
              expirationDate: expirationDate 
                ? new Date(expirationDate).toISOString().split('T')[0]
                : new Date().toISOString().split('T')[0],
              eventTime: new Date(item.eventTime || Date.now()),
              sourceGln: item.sourceGln || null,
              destinationGln: item.destinationGln || null,
              bizTransactionList: item.bizTransactionList || null,
              poId: null // Will be associated later
            });
          } catch (itemErr) {
            console.error('Error storing product item:', itemErr);
          }
        }
      } catch (extractErr) {
        console.error('Error extracting product items:', extractErr);
      }
    }
    
    return {
      success: true,
      file
    };
  } catch (error) {
    console.error('Error processing file:', error);
    return {
      success: false,
      errorCode: 'PROCESSING_ERROR',
      errorMessage: 'An unexpected error occurred while processing the file. Please try again.'
    };
  }
}

// Send a file to a trading partner
export async function sendFile(
  fileId: number,
  partnerId: number,
  userId: number,
  transportType: 'AS2' | 'HTTPS' | 'PRESIGNED' = 'AS2'
): Promise<{
  success: boolean;
  transmission?: any;
  errorMessage?: string;
}> {
  try {
    // Get file and partner information
    const file = await storage.getFile(fileId);
    const partner = await storage.getPartner(partnerId);
    
    if (!file) {
      return { success: false, errorMessage: 'File not found' };
    }
    
    if (!partner) {
      return { success: false, errorMessage: 'Partner not found' };
    }
    
    // Create transmission record
    const transmission: InsertTransmission = {
      fileId,
      partnerId,
      status: 'queued',
      transportType: transportType,
      sentBy: userId
    };
    
    const transmissionRecord = await storage.createTransmission(transmission);
    
    // Get the file data
    // For PRESIGNED transport type, we don't actually need the file data for sending
    // Only check file data for other transport types
    let fileData: Buffer | undefined = undefined;
    
    if (transportType !== 'PRESIGNED') {
      fileData = await storage.retrieveFileData(fileId);
      
      if (!fileData) {
        await storage.updateTransmission(transmissionRecord.id, {
          status: 'failed',
          errorMessage: 'File content could not be retrieved'
        });
        return { success: false, errorMessage: 'File content could not be retrieved' };
      }
    }
    
    // Send via appropriate transport method
    try {
      let deliveryConfirmation = '';
      
      if (transportType === 'AS2') {
        // In a real implementation, this would use a proper AS2 library
        // For now, we'll simulate it with a success message
        
        // TODO: Implement AS2 sending with node-as2 or similar library
        deliveryConfirmation = `AS2-MDN: ${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
      } else if (transportType === 'HTTPS') {
        // For HTTPS, try to send via HTTP POST
        if (!partner.endpointUrl) {
          throw new Error('Partner has no endpoint URL configured');
        }
        
        // Create headers
        const headers: Record<string, string> = {
          'Content-Type': file.fileType === 'ZIP' ? 'application/zip' : 'application/xml',
        };
        
        // If using basic auth
        if (partner.authToken) {
          headers['Authorization'] = `Basic ${partner.authToken}`;
        }
        
        // Send the file
        const response = await axios.post(partner.endpointUrl, fileData, {
          headers,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 30000, // 30 second timeout
        });
        
        deliveryConfirmation = `HTTP ${response.status}: ${response.statusText}`;
      } else if (transportType === 'PRESIGNED') {
        // Create a pre-signed link for the file
        // Generate a UUID for the pre-signed URL
        const uuid = crypto.randomUUID ? crypto.randomUUID() : uuidv4();
        
        // Calculate expiration (48 hours from now)
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 48);
        
        // Create a pre-signed link
        const presignedLink = await storage.createPresignedLink({
          fileId: fileId,
          partnerId: partnerId,
          createdBy: userId,
          uuid: uuid,
          urlHash: crypto.createHash('sha256').update(uuid).digest('hex'),
          expiresAt: expiresAt,
          isOneTimeUse: false,
          ipRestriction: null
        });
        
        // Generate the full download URL using the current request context (will be included in context when function is called from routes.ts)
        // This is handled by storage.generatePresignedUrl in sendFile, no need to manually create it here
        const downloadUrl = await storage.generatePresignedUrl(fileId);
        
        // Send email notification to the partner
        try {
          const emailSent = await sendFileShareNotification(
            partner,
            file.originalName,
            downloadUrl,
            expiresAt
          );
          
          if (emailSent) {
            console.log(`Email notification sent to ${partner.name} <${partner.contactEmail}>`);
            deliveryConfirmation = `Pre-Signed URL created: ${uuid}, email sent to ${partner.contactEmail}, link expires: ${expiresAt.toISOString()}`;
          } else {
            console.warn(`Failed to send email notification to ${partner.name} <${partner.contactEmail}>`);
            deliveryConfirmation = `Pre-Signed URL created: ${uuid}, expires: ${expiresAt.toISOString()} (email delivery failed)`;
          }
        } catch (emailError) {
          console.error('Error sending email notification:', emailError);
          deliveryConfirmation = `Pre-Signed URL created: ${uuid}, expires: ${expiresAt.toISOString()} (email delivery error)`;
        }
      }
      
      // Update transmission record with success
      await storage.updateTransmission(transmissionRecord.id, {
        status: 'sent',
        deliveryConfirmation
      });
      
      // Update file status
      await storage.updateFile(fileId, { status: 'sent' });
      
      return { 
        success: true,
        transmission: {
          ...transmissionRecord,
          status: 'sent',
          deliveryConfirmation
        }
      };
    } catch (error) {
      const sendError = error as Error;
      console.error('Error sending file:', sendError);
      
      // Update transmission with failure
      await storage.updateTransmission(transmissionRecord.id, {
        status: 'failed',
        errorMessage: sendError.message || 'Unknown error occurred',
        retryCount: 0,
        nextRetryAt: new Date(Date.now() + 60000) // Retry in 1 minute
      });
      
      // Update file status
      await storage.updateFile(fileId, { status: 'failed' });
      
      return { 
        success: false, 
        errorMessage: `Failed to send file: ${sendError.message || 'Unknown error occurred'}` 
      };
    }
  } catch (error) {
    console.error('Error in send file process:', error);
    return { 
      success: false, 
      errorMessage: 'An unexpected error occurred while sending the file'
    };
  }
}

// Retry a failed transmission
export async function retryTransmission(transmissionId: number): Promise<{
  success: boolean;
  transmission?: any;
  errorMessage?: string;
}> {
  try {
    const transmission = await storage.getTransmission(transmissionId);
    
    if (!transmission) {
      return { success: false, errorMessage: 'Transmission not found' };
    }
    
    if (transmission.status === 'sent') {
      return { success: true, transmission };
    }
    
    // Update retry count and status
    const updatedTransmission = await storage.updateTransmission(transmissionId, {
      status: 'retrying',
      retryCount: (transmission.retryCount || 0) + 1
    });
    
    // Call sendFile to actually retry the transmission
    const result = await sendFile(
      transmission.fileId,
      transmission.partnerId,
      transmission.sentBy,
      transmission.transportType as 'AS2' | 'HTTPS' | 'PRESIGNED'
    );
    
    return result;
  } catch (error) {
    console.error('Error retrying transmission:', error);
    return { 
      success: false, 
      errorMessage: 'An unexpected error occurred while retrying the transmission'
    };
  }
}
