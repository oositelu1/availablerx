import { createReadStream } from 'fs';
import { Transform } from 'stream';
import { parseStringPromise } from 'xml2js';
import type { EpcisMetadata } from './validators';

/**
 * Streaming XML parser for large EPCIS files
 * Processes files in chunks to avoid memory issues
 */
export class StreamingEpcisParser {
  private metadata: EpcisMetadata;
  private currentElement: string = '';
  private buffer: string = '';
  private inEventList: boolean = false;
  private eventCount: number = 0;
  
  constructor() {
    this.metadata = {
      objectEvents: 0,
      aggregationEvents: 0,
      transactionEvents: 0,
      senderGln: 'unknown',
      schemaVersion: '1.0',
      productInfo: {},
      productItems: [],
      poNumbers: []
    };
  }
  
  /**
   * Parse EPCIS file using streaming to handle large files efficiently
   */
  async parseFile(filePath: string): Promise<EpcisMetadata> {
    return new Promise((resolve, reject) => {
      const stream = createReadStream(filePath, { encoding: 'utf8' });
      const parser = this.createParserStream();
      
      stream
        .pipe(parser)
        .on('finish', () => resolve(this.metadata))
        .on('error', reject);
    });
  }
  
  /**
   * Create a transform stream that processes XML chunks
   */
  private createParserStream(): Transform {
    return new Transform({
      transform: (chunk: Buffer, encoding, callback) => {
        this.buffer += chunk.toString();
        
        // Process complete elements when we have them
        this.processBuffer();
        
        callback();
      },
      
      flush: (callback) => {
        // Process any remaining buffer
        if (this.buffer.length > 0) {
          this.processBuffer();
        }
        callback();
      }
    });
  }
  
  /**
   * Process buffered XML data
   */
  private processBuffer(): void {
    // Extract and process header if not yet processed
    if (this.metadata.senderGln === 'unknown') {
      const headerMatch = this.buffer.match(/<EPCISHeader>([\s\S]*?)<\/EPCISHeader>/);
      if (headerMatch) {
        this.processHeader(headerMatch[1]);
      }
    }
    
    // Extract and process vocabulary (master data)
    if (!this.metadata.productInfo.name) {
      const vocabMatch = this.buffer.match(/<VocabularyList>([\s\S]*?)<\/VocabularyList>/);
      if (vocabMatch) {
        this.processVocabulary(vocabMatch[1]);
      }
    }
    
    // Process events in chunks
    this.processEvents();
    
    // Keep only unprocessed data in buffer
    // Remove processed complete events to free memory
    const lastEventEnd = this.buffer.lastIndexOf('</ObjectEvent>');
    if (lastEventEnd > -1) {
      this.buffer = this.buffer.substring(lastEventEnd + 14);
    }
  }
  
  /**
   * Process EPCIS header
   */
  private async processHeader(headerXml: string): Promise<void> {
    try {
      const parsed = await parseStringPromise(`<EPCISHeader>${headerXml}</EPCISHeader>`, {
        explicitArray: false,
        normalizeTags: false
      });
      
      // Extract sender GLN
      const header = parsed.EPCISHeader;
      if (header?.['sbdh:StandardBusinessDocumentHeader']?.['sbdh:Sender']?.['sbdh:Identifier']) {
        const identifier = header['sbdh:StandardBusinessDocumentHeader']['sbdh:Sender']['sbdh:Identifier'];
        if (identifier.startsWith('urn:epc:id:sgln:')) {
          this.metadata.senderGln = this.extractGLNFromSGLN(identifier);
        }
      }
      
      // Check for transaction statement
      if (header?.['gs1ushc:dscsaTransactionStatement']?.['gs1ushc:affirmTransactionStatement'] === 'true') {
        console.log('Valid DSCSA transaction statement found');
      }
    } catch (error) {
      console.error('Error processing header:', error);
    }
  }
  
  /**
   * Process vocabulary/master data
   */
  private async processVocabulary(vocabXml: string): Promise<void> {
    try {
      const parsed = await parseStringPromise(`<VocabularyList>${vocabXml}</VocabularyList>`, {
        explicitArray: false,
        normalizeTags: false
      });
      
      const vocabularies = Array.isArray(parsed.VocabularyList?.Vocabulary) 
        ? parsed.VocabularyList.Vocabulary 
        : [parsed.VocabularyList?.Vocabulary].filter(Boolean);
      
      for (const vocab of vocabularies) {
        if (vocab?.type?.includes('EPCClass') || vocab?.$?.type?.includes('EPCClass')) {
          // Extract first product info found
          const elements = vocab.VocabularyElementList?.VocabularyElement || [];
          const firstElement = Array.isArray(elements) ? elements[0] : elements;
          
          if (firstElement?.attribute) {
            const attributes = Array.isArray(firstElement.attribute) 
              ? firstElement.attribute 
              : [firstElement.attribute];
            
            for (const attr of attributes) {
              const id = attr.id || attr.$?.id;
              const value = attr._ || attr.value || attr;
              
              if (id?.includes('regulatedProductName')) {
                this.metadata.productInfo.name = value;
              } else if (id?.includes('manufacturerOfTradeItemPartyName')) {
                this.metadata.productInfo.manufacturer = value;
              } else if (id?.includes('additionalTradeItemIdentification')) {
                this.metadata.productInfo.ndc = value;
              }
            }
          }
          break; // Only process first product
        }
      }
    } catch (error) {
      console.error('Error processing vocabulary:', error);
    }
  }
  
  /**
   * Process events incrementally
   */
  private processEvents(): void {
    // Process ObjectEvents
    const objectEventRegex = /<ObjectEvent>([\s\S]*?)<\/ObjectEvent>/g;
    let match;
    
    while ((match = objectEventRegex.exec(this.buffer)) !== null) {
      this.metadata.objectEvents++;
      this.processObjectEvent(match[1]);
      
      // Limit product items to prevent memory overflow
      if (this.metadata.productItems.length >= 1000) {
        console.log('Product item limit reached, skipping additional items');
        break;
      }
    }
    
    // Count other event types
    this.metadata.aggregationEvents = (this.buffer.match(/<AggregationEvent>/g) || []).length;
    this.metadata.transactionEvents = (this.buffer.match(/<TransactionEvent>/g) || []).length;
  }
  
  /**
   * Process a single ObjectEvent
   */
  private async processObjectEvent(eventXml: string): Promise<void> {
    try {
      // Extract key information using regex for efficiency
      const epcMatch = eventXml.match(/<epc>(.*?)<\/epc>/);
      if (epcMatch && epcMatch[1].includes('sgtin')) {
        const sgtin = this.parseSGTIN(epcMatch[1]);
        if (sgtin && this.metadata.productItems.length < 1000) {
          // Extract lot and expiry if present
          const lotMatch = eventXml.match(/<cbvmda:lotNumber>(.*?)<\/cbvmda:lotNumber>/);
          const expiryMatch = eventXml.match(/<cbvmda:itemExpirationDate>(.*?)<\/cbvmda:itemExpirationDate>/);
          
          this.metadata.productItems.push({
            gtin: sgtin.gtin,
            serialNumber: sgtin.serial,
            eventTime: new Date().toISOString(),
            lotNumber: lotMatch?.[1] || 'unknown',
            expirationDate: expiryMatch?.[1] || 'unknown',
            sourceGln: null,
            destinationGln: null,
            bizTransactionList: []
          });
        }
      }
      
      // Extract PO numbers
      const poMatch = eventXml.match(/btt:po.*?>(.*?)</);
      if (poMatch) {
        const poNumber = poMatch[1].split(':').pop() || poMatch[1];
        if (!this.metadata.poNumbers.includes(poNumber)) {
          this.metadata.poNumbers.push(poNumber);
        }
      }
    } catch (error) {
      console.error('Error processing object event:', error);
    }
  }
  
  /**
   * Parse SGTIN from EPC string
   */
  private parseSGTIN(epc: string): { gtin: string; serial: string } | null {
    const match = epc.match(/urn:epc:id:sgtin:(\d+)\.(\d+)\.(.+)/);
    if (match) {
      const [, companyPrefix, itemReference, serialNumber] = match;
      const gtin = `0${companyPrefix}${itemReference}`;
      return { gtin, serial: serialNumber };
    }
    return null;
  }
  
  /**
   * Extract GLN from SGLN
   */
  private extractGLNFromSGLN(sgln: string): string {
    const parts = sgln.replace('urn:epc:id:sgln:', '').split('.');
    if (parts.length >= 2) {
      return `${parts[0]}${parts[1].padStart(5, '0')}`;
    }
    return sgln;
  }
}

// Export convenience function
export async function parseEpcisFileStreaming(filePath: string): Promise<EpcisMetadata> {
  const parser = new StreamingEpcisParser();
  return parser.parseFile(filePath);
}