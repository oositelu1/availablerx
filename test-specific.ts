import fs from 'fs';
import { parseStringPromise } from 'xml2js';

/**
 * Test script to directly extract product details from a specific EPCIS XML file
 */
async function testExtractProductDetails() {
  try {
    const filePath = './attached_assets/shipment_b12392f1-4f3a-49bf-87ae-91893b46fab0.epcis.xml';
    const xmlBuffer = fs.readFileSync(filePath);
    
    console.log('Reading XML file:', filePath);
    
    // Parse with options that match our extractor
    const parsedXml = await parseStringPromise(xmlBuffer, {
      explicitArray: true,
      explicitCharkey: true,
      mergeAttrs: false,
      normalizeTags: false,
      xmlns: true,
      tagNameProcessors: []
    });
    
    console.log('XML parsed successfully');
    console.log('Root keys:', Object.keys(parsedXml));
    
    // Initialize result
    const result: { name?: string; manufacturer?: string; ndc?: string } = {};
    
    // Handle the special case with ns3:EPCISDocument at root
    const epcisDocument = parsedXml['ns3:EPCISDocument'] || parsedXml['epcis:EPCISDocument'] || parsedXml['EPCISDocument'];
    if (!epcisDocument) {
      console.log('No EPCISDocument found at root');
      return;
    }
    
    console.log('Found EPCISDocument. Keys:', Object.keys(epcisDocument));
    
    // Get EPCISHeader 
    const epcisHeader = epcisDocument['EPCISHeader'] || epcisDocument['epcis:EPCISHeader'];
    if (!epcisHeader || !epcisHeader[0]) {
      console.log('No EPCISHeader found');
      return;
    }
    
    console.log('Found EPCISHeader. Keys:', Object.keys(epcisHeader[0]));
    
    // Get extension in header
    const headerExtension = epcisHeader[0]['extension'];
    if (!headerExtension || !headerExtension[0]) {
      console.log('No extension found in header');
    } else {
      console.log('Found header extension. Keys:', Object.keys(headerExtension[0]));
      
      // Get EPCISMasterData 
      const masterData = headerExtension[0]['EPCISMasterData'];
      if (!masterData || !masterData[0]) {
        console.log('No EPCISMasterData found');
      } else {
        console.log('Found EPCISMasterData. Keys:', Object.keys(masterData[0]));
        
        // Get VocabularyList
        const vocabList = masterData[0]['VocabularyList'];
        if (!vocabList || !vocabList[0]) {
          console.log('No VocabularyList found');
        } else {
          console.log('Found VocabularyList. Keys:', Object.keys(vocabList[0]));
          
          // Get Vocabulary elements
          const vocabularies = vocabList[0]['Vocabulary'];
          if (!vocabularies) {
            console.log('No Vocabulary found');
          } else {
            console.log(`Found ${vocabularies.length} vocabularies`);
            
            // Process each vocabulary
            for (let i = 0; i < vocabularies.length; i++) {
              const vocabulary = vocabularies[i];
              if (vocabulary.$ && vocabulary.$.type) {
                console.log(`Vocabulary ${i} type:`, vocabulary.$.type);
                
                // Check for type value property or direct string
                let vocabType = '';
                if (typeof vocabulary.$.type === 'object' && vocabulary.$.type.value) {
                  vocabType = vocabulary.$.type.value;
                } else if (typeof vocabulary.$.type === 'string') {
                  vocabType = vocabulary.$.type;
                }
                
                console.log('Vocabulary type value:', vocabType);
                
                // Look for EPCClass vocabulary which contains product info
                if (vocabType === 'urn:epcglobal:epcis:vtype:EPCClass') {
                  console.log('Found EPCClass vocabulary!');
                  
                  // Get VocabularyElementList
                  const elemList = vocabulary['VocabularyElementList'];
                  if (!elemList || !elemList[0]) {
                    console.log('No VocabularyElementList found');
                  } else {
                    console.log('Found VocabularyElementList');
                    
                    // Get VocabularyElement entries
                    const elements = elemList[0]['VocabularyElement'];
                    if (!elements) {
                      console.log('No VocabularyElement found');
                    } else {
                      console.log(`Found ${elements.length} VocabularyElement entries`);
                      
                      // Process each vocabulary element
                      for (let j = 0; j < elements.length; j++) {
                        const element = elements[j];
                        console.log(`VocabularyElement ${j} id:`, element.$ ? element.$.id : 'unknown');
                        
                        // Get attributes
                        const attributes = element['attribute'];
                        if (!attributes) {
                          console.log('No attributes found');
                        } else {
                          console.log(`Found ${attributes.length} attributes`);
                          
                          // Process each attribute
                          for (let k = 0; k < attributes.length; k++) {
                            const attr = attributes[k];
                            if (attr.$ && attr.$.id) {
                              // Get attribute ID
                              let attrId = '';
                              if (typeof attr.$.id === 'object' && attr.$.id.value) {
                                attrId = attr.$.id.value;
                              } else if (typeof attr.$.id === 'string') {
                                attrId = attr.$.id;
                              }
                              
                              // Get attribute value
                              let attrValue = '';
                              if (attr._ !== undefined) {
                                attrValue = attr._;
                              } else if (attr.$ && attr.$._) {
                                attrValue = attr.$._; 
                              } else if (attr.$ && attr.$.value) {
                                attrValue = attr.$.value;
                              }
                              
                              console.log(`Attribute ${k}: id=${attrId}, value=${attrValue}`);
                              
                              // Extract product name
                              if (attrId === 'urn:epcglobal:cbv:mda#regulatedProductName') {
                                console.log('★★★ Found product name:', attrValue);
                                result.name = attrValue;
                              }
                              
                              // Extract manufacturer
                              if (attrId === 'urn:epcglobal:cbv:mda#manufacturerOfTradeItemPartyName') {
                                console.log('★★★ Found manufacturer:', attrValue);
                                result.manufacturer = attrValue;
                              }
                              
                              // Extract NDC
                              if (attrId === 'urn:epcglobal:cbv:mda#additionalTradeItemIdentification') {
                                console.log('★★★ Found NDC:', attrValue);
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
    
    console.log('Final extraction result:', result);
    
  } catch (error) {
    console.error('Error in test script:', error);
  }
}

// Run the test function
testExtractProductDetails();