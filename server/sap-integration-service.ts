import axios, { AxiosInstance } from 'axios';
import { z } from 'zod';
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

    // Create axios instance with base configuration
    this.axiosInstance = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Add request interceptor to handle authentication
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        const token = await this.getAuthToken();
        if (token) {
          config.headers['Authorization'] = `Bearer ${token}`;
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
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get or refresh authentication token
   */
  private async getAuthToken(): Promise<string | null> {
    // Check if we have a valid token
    if (this.authToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.authToken.access_token;
    }

    try {
      // Use OAuth2 if client credentials are provided
      if (this.config.clientId && this.config.clientSecret) {
        const tokenUrl = `${this.config.baseUrl}/sap/bc/sec/oauth2/token`;
        const params = new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          scope: 'API'
        });

        const response = await axios.post(tokenUrl, params, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });

        this.authToken = response.data;
        // Set token expiry with 5 minute buffer
        this.tokenExpiry = new Date(Date.now() + (this.authToken.expires_in - 300) * 1000);
        return this.authToken.access_token;
      } else {
        // Fall back to basic auth
        const basicAuth = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
        this.axiosInstance.defaults.headers.common['Authorization'] = `Basic ${basicAuth}`;
        return null;
      }
    } catch (error) {
      console.error('SAP Authentication failed:', error);
      throw new Error('Failed to authenticate with SAP ByDesign');
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

      // Using khinbounddelivery for receiving inventory
      const endpoint = '/sap/byd/odata/cust/v1/khinbounddelivery/InboundDeliveryCollection';

      // Prepare the inbound delivery data
      // Note: The exact field names may need adjustment based on the service metadata
      const inboundDelivery = {
        // Basic delivery information
        DeliveryDate: new Date().toISOString(),
        SupplierID: 'EPCIS_SYSTEM', // You may need to map this to actual supplier
        
        // Item details
        Item: [{
          ProductID: validatedData.MaterialID,
          ProductDescription: validatedData.ProductName,
          Quantity: validatedData.Quantity,
          QuantityUnitCode: validatedData.UnitOfMeasure,
          
          // Batch/Serial information
          IdentifiedStockID: validatedData.SerialNumber,
          IdentifiedStockType: 'SERIAL',
          BatchID: validatedData.LotNumber,
          ExpiryDate: `${validatedData.ExpirationDate}T00:00:00Z`,
          
          // Additional identifiers
          GTIN: validatedData.GTIN,
          NDC: validatedData.NDC,
          
          // Location
          ReceivingLocationID: validatedData.WarehouseLocation || this.config.tenantId,
          
          // Status
          ItemStatus: 'RECEIVED'
        }],
        
        // Additional metadata
        SourceType: validatedData.SourceType,
        ProcessingDateTime: new Date().toISOString()
      };

      // Make the API call
      const response = await this.axiosInstance.post(endpoint, inboundDelivery);

      console.log('SAP inventory push successful:', response.data);

      return {
        ObjectID: response.data.ObjectID || response.data.ID,
        MaterialID: validatedData.MaterialID,
        Status: 'SUCCESS',
        Message: 'Product successfully added to SAP inventory'
      };

    } catch (error: any) {
      console.error('Failed to push to SAP inventory:', error);
      
      // Handle specific SAP errors
      if (error.response?.data) {
        const sapError = error.response.data;
        throw new Error(`SAP Error: ${sapError.error?.message?.value || 'Unknown SAP error'}`);
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
      await this.getAuthToken();
      
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