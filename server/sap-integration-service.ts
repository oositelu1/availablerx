import axios, { AxiosInstance } from 'axios';
import { z } from 'zod';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { ProductItem } from '@shared/schema';

// SAP ByDesign Inventory Field Schema
const SAPInventorySchema = z.object({
  MaterialID: z.string(),
  ProductName: z.string(),
  NDC: z.string().optional(),
  GTIN: z.string(),
  LotNumber: z.string(),
  SerialNumber: z.string(),
  ExpirationDate: z.string(), // SAP expects date in YYYY-MM-DD format
  Quantity: z.number().default(1),
  UnitOfMeasure: z.string().default('EA'), // Each
  WarehouseLocation: z.string().optional(),
  ReceivedDate: z.string().optional(),
  SourceType: z.string().default('EPCIS'),
});

type SAPInventoryData = z.infer<typeof SAPInventorySchema>;

// Configuration interface
interface SAPConfig {
  baseUrl: string;
  tenantId: string;
  clientId?: string;
  clientSecret?: string;
  username: string;
  password: string;
  timeout?: number;
}

// Response types
interface SAPAuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

interface SAPInventoryResponse {
  ObjectID: string;
  MaterialID: string;
  Status: string;
  Message?: string;
}

export class SAPIntegrationService {
  private config: SAPConfig;
  private axiosInstance: AxiosInstance;
  private authToken: SAPAuthToken | null = null;
  private tokenExpiry: Date | null = null;
  private cookieJar: CookieJar;
  private csrfToken: string | null = null;
  private csrfTokenExpiry: Date | null = null;

  constructor(config?: Partial<SAPConfig>) {
    this.config = {
      baseUrl: process.env.SAP_BYD_BASE_URL || '',
      tenantId: process.env.SAP_BYD_TENANT_ID || '',
      clientId: process.env.SAP_BYD_CLIENT_ID,
      clientSecret: process.env.SAP_BYD_CLIENT_SECRET,
      username: process.env.SAP_BYD_USER || '',
      password: process.env.SAP_BYD_PASSWORD || '',
      timeout: 30000,
      ...config
    };

    // Validate configuration
    if (!this.config.baseUrl || !this.config.username || !this.config.password) {
      throw new Error('SAP Integration: Missing required configuration');
    }

    // Create cookie jar for session management
    this.cookieJar = new CookieJar();

    // Create axios instance with cookie support
    this.axiosInstance = wrapper(axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      jar: this.cookieJar,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }));

    // Add request interceptor to handle authentication and CSRF tokens
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        // Add basic auth for all requests
        const basicAuth = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
        config.headers['Authorization'] = `Basic ${basicAuth}`;
        
        // For POST/PUT/DELETE requests, we need CSRF token
        if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() || '')) {
          // Get the endpoint from the config URL
          const endpoint = config.url || '';
          const csrfToken = await this.fetchCSRFToken(endpoint);
          
          if (csrfToken) {
            config.headers['X-CSRF-Token'] = csrfToken;
            console.log('Request prepared with CSRF token');
            console.log('CSRF token being sent:', csrfToken ? 'Present' : 'Missing');
          } else {
            console.warn('No CSRF token available for write operation');
          }
        }
        
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired, clear it and retry
          this.authToken = null;
          this.tokenExpiry = null;
          
          // Retry the original request
          const originalRequest = error.config;
          if (!originalRequest._retry) {
            originalRequest._retry = true;
            return this.axiosInstance(originalRequest);
          }
        } else if (error.response?.status === 403 && error.response?.data?.error?.message?.value?.includes('CSRF')) {
          // CSRF token invalid, clear session and retry
          console.log('CSRF token validation failed, clearing session');
          this.csrfToken = null;
          this.csrfTokenExpiry = null;
          this.cookieJar.removeAllCookiesSync();
          
          // Retry the original request
          const originalRequest = error.config;
          if (!originalRequest._retryCSRF) {
            originalRequest._retryCSRF = true;
            return this.axiosInstance(originalRequest);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Basic auth is handled in request interceptor
   */
  private async getAuthToken(): Promise<string | null> {
    return null; // Using basic auth via interceptor
  }

  /**
   * Fetch CSRF token for write operations
   */
  private async fetchCSRFToken(endpoint?: string): Promise<string | null> {
    // Check if we have a valid token
    if (this.csrfToken && this.csrfTokenExpiry && this.csrfTokenExpiry > new Date()) {
      console.log('Using cached CSRF token');
      return this.csrfToken;
    }

    try {
      const tokenEndpoint = endpoint || '/sap/byd/odata/cust/v1/khinbounddelivery/';
      
      console.log('Fetching CSRF token from:', tokenEndpoint);
      
      // Make GET request to fetch CSRF token
      const response = await this.axiosInstance.get(tokenEndpoint, {
        headers: {
          'X-CSRF-Token': 'fetch',  // MUST be lowercase 'fetch'
          'Accept': 'application/json'
        }
      });
      
      // Extract CSRF token (check both cases)
      const csrfToken = response.headers['x-csrf-token'] || response.headers['X-CSRF-Token'];
      console.log('CSRF Response Status:', response.status);
      console.log('CSRF token received:', csrfToken ? 'Yes' : 'No');
      console.log('CSRF token value:', csrfToken);
      
      if (csrfToken && csrfToken !== 'Required' && csrfToken !== 'fetch') {
        this.csrfToken = csrfToken;
        this.csrfTokenExpiry = new Date(Date.now() + 25 * 60 * 1000);
        console.log('CSRF token stored successfully');
        return csrfToken;
      }
      
      console.warn('No valid CSRF token received from primary endpoint');
      
      // Try alternate endpoints
      const alternateEndpoints = [
        '/sap/byd/odata/cust/v1/khinbounddelivery/InboundDeliveryCollection?$top=1',
        '/sap/byd/odata/cust/v1/khgoodsandactivityconfirmation/GoodsAndActivityConfirmationCollection'
      ];
      
      for (const altEndpoint of alternateEndpoints) {
        try {
          console.log('Trying alternate endpoint:', altEndpoint);
          const altResponse = await this.axiosInstance.get(altEndpoint, {
            headers: {
              'X-CSRF-Token': 'fetch',
              'Accept': 'application/json'
            }
          });
          
          const altToken = altResponse.headers['x-csrf-token'] || altResponse.headers['X-CSRF-Token'];
          if (altToken && altToken !== 'Required' && altToken !== 'fetch') {
            this.csrfToken = altToken;
            this.csrfTokenExpiry = new Date(Date.now() + 25 * 60 * 1000);
            console.log('CSRF token obtained from alternate endpoint');
            return altToken;
          }
        } catch (e) {
          console.log('Alternate endpoint failed:', e.message);
          continue;
        }
      }
      
      return null;
      
    } catch (error: any) {
      console.error('Failed to fetch CSRF token:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      
      // Clear token on error
      this.csrfToken = null;
      this.csrfTokenExpiry = null;
      return null;
    }
  }

  /**
   * Map DocumentTracker product data to SAP inventory format
   */
  private mapProductToSAPInventory(product: any): SAPInventoryData {
    // Extract NDC from GTIN if not provided
    let ndc = product.ndc;
    if (!ndc && product.gtin) {
      // Remove check digit and leading zeros for NDC
      ndc = product.gtin.substring(2, 13);
    }

    return {
      MaterialID: product.gtin, // Using GTIN as Material ID
      ProductName: product.productName || 'Unknown Product',
      NDC: ndc,
      GTIN: product.gtin,
      LotNumber: product.lotNumber,
      SerialNumber: product.serialNumber,
      ExpirationDate: product.expirationDate,
      Quantity: 1, // Each scanned item is quantity 1
      UnitOfMeasure: 'EA',
      WarehouseLocation: product.warehouseLocation || 'MAIN',
      ReceivedDate: new Date().toISOString().split('T')[0],
      SourceType: 'EPCIS'
    };
  }

  /**
   * Push validated product to SAP inventory
   */
  async pushToInventory(validatedProduct: any): Promise<SAPInventoryResponse> {
    try {
      console.log('Pushing product to SAP inventory:', validatedProduct);

      // Map product data to SAP format
      const sapData = this.mapProductToSAPInventory(validatedProduct);
      
      // Validate the data
      const validatedData = SAPInventorySchema.parse(sapData);

      // Using khgoodsandactivityconfirmation for confirming goods receipt
      const endpoint = '/sap/byd/odata/cust/v1/khgoodsandactivityconfirmation/GoodsAndActivityConfirmationCollection';

      // Prepare the goods and activity confirmation data
      // Structure optimized for EPCIS validation workflow
      const goodsConfirmation = {
        // Basic confirmation information
        PostingDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
        
        // Product identification - using GTIN as primary identifier
        ProductID: validatedData.GTIN, // Using GTIN as the product ID
        ProductDescription: validatedData.ProductName,
        
        // Quantity confirmed
        Quantity: validatedData.Quantity.toString(),
        QuantityUnitCode: validatedData.UnitOfMeasure,
        
        // Batch/Serial tracking (critical for pharmaceuticals)
        BatchID: validatedData.LotNumber,
        SerialNumberID: validatedData.SerialNumber,
        
        // Expiration date in SAP format
        ExpirationDate: validatedData.ExpirationDate, // Already in YYYY-MM-DD format
        
        // Activity type - confirming goods receipt from EPCIS validation
        ActivityTypeCode: 'GOODS_RECEIPT',
        
        // Location where goods are received
        LocationID: validatedData.WarehouseLocation || this.config.tenantId,
        
        // Reference back to EPCIS for traceability
        ExternalReference: 'EPCIS_VALIDATION',
        ExternalReferenceID: `${validatedData.GTIN}_${validatedData.SerialNumber}`,
        
        // Additional fields that might be needed
        Note: `Validated via EPCIS on ${new Date().toISOString()}`,
        
        // Custom fields for additional tracking if supported
        CustomFields: {
          NDC: validatedData.NDC,
          SourceSystem: 'EPCIS',
          ValidationTimestamp: new Date().toISOString()
        }
      };

      console.log('Sending goods confirmation to SAP:', JSON.stringify(goodsConfirmation, null, 2));

      // Make the API call
      const response = await this.axiosInstance.post(endpoint, goodsConfirmation);

      console.log('SAP inventory push successful:', response.data);

      return {
        ObjectID: response.data.ObjectID || response.data.ID,
        MaterialID: validatedData.MaterialID,
        Status: 'SUCCESS',
        Message: 'Product successfully added to SAP inventory'
      };

    } catch (error: any) {
      console.error('Failed to push to SAP inventory:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Error headers:', error.response?.headers);
      
      // Handle specific SAP errors
      if (error.response?.data) {
        const sapError = error.response.data;
        console.error('SAP Error details:', JSON.stringify(sapError, null, 2));
        
        // Check for different error formats
        const errorMessage = sapError.error?.message?.value || 
                           sapError.error?.message || 
                           sapError.message || 
                           JSON.stringify(sapError);
                           
        throw new Error(`SAP Error: ${errorMessage}`);
      }
      
      throw new Error(`Failed to push product to SAP: ${error.message}`);
    }
  }

  /**
   * Verify product exists in SAP
   */
  async verifyProductInSAP(gtin: string): Promise<boolean> {
    try {
      // Using vmumaterial endpoint from your URL
      const endpoint = `/sap/byd/odata/cust/v1/vmumaterial/MaterialCollection?$filter=GTIN eq '${gtin}'`;
      const response = await this.axiosInstance.get(endpoint);
      
      return response.data.d.results.length > 0;
    } catch (error) {
      console.error('Failed to verify product in SAP:', error);
      return false;
    }
  }

  /**
   * Get current stock level for a product
   */
  async getStockLevel(gtin: string, lotNumber?: string): Promise<number> {
    try {
      let endpoint = `/sap/byd/odata/cust/v1/inventory/StockOverviewByMaterial?$filter=ProductID eq '${gtin}'`;
      
      if (lotNumber) {
        endpoint += ` and LogisticsLotID eq '${lotNumber}'`;
      }

      const response = await this.axiosInstance.get(endpoint);
      
      if (response.data.d.results.length > 0) {
        return response.data.d.results.reduce((total: number, item: any) => {
          return total + (item.Quantity || 0);
        }, 0);
      }
      
      return 0;
    } catch (error) {
      console.error('Failed to get stock level from SAP:', error);
      return 0;
    }
  }

  /**
   * Test SAP connection
   */
  async testConnection(): Promise<boolean> {
    try {
      // Try to access the metadata endpoint you provided
      const response = await this.axiosInstance.get('/sap/byd/odata/cust/v1/vmumaterial/$metadata');
      
      return response.status === 200;
    } catch (error) {
      console.error('SAP connection test failed:', error);
      return false;
    }
  }
}

// Create singleton instance
let sapService: SAPIntegrationService | null = null;

export function getSAPService(): SAPIntegrationService {
  if (!sapService) {
    sapService = new SAPIntegrationService();
  }
  return sapService;
}