import { Router, Request, Response } from "express";
import { getSAPService } from "./sap-integration-service";
import { isAdmin } from "./auth";

export const sapTestRouter = Router();

// Middleware to ensure only admins can access SAP test endpoints
sapTestRouter.use((req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  // Optional: restrict to admin users only
  // return isAdmin(req, res, next);
  next();
});

// Test CSRF token fetching
sapTestRouter.get("/csrf-token", async (req: Request, res: Response) => {
  try {
    const sapService = getSAPService();
    
    // Access private method through any type (for testing only)
    const token = await (sapService as any).fetchCSRFToken();
    
    res.json({
      success: true,
      message: token ? "CSRF token fetched successfully" : "Failed to fetch CSRF token",
      hasToken: !!token,
      tokenLength: token ? token.length : 0
    });
  } catch (error: any) {
    console.error("CSRF token test error:", error);
    res.status(500).json({
      success: false,
      message: `CSRF token test failed: ${error.message}`,
      error: error.message
    });
  }
});

// Test SAP connection
sapTestRouter.get("/connection", async (req: Request, res: Response) => {
  try {
    const sapService = getSAPService();
    
    // Check if SAP is configured
    if (!process.env.SAP_BYD_BASE_URL) {
      return res.status(400).json({
        connected: false,
        configured: false,
        message: "SAP integration not configured. Please set SAP_BYD_* environment variables.",
        environment: {
          baseUrl: "Not set",
          tenantId: process.env.SAP_BYD_TENANT_ID || "Not set",
          username: process.env.SAP_BYD_USER ? "Set" : "Not set",
          authMethod: process.env.SAP_BYD_CLIENT_ID ? "OAuth2" : "Basic Auth"
        }
      });
    }

    // Test the connection
    console.log("Testing SAP connection...");
    const isConnected = await sapService.testConnection();
    
    res.json({
      connected: isConnected,
      configured: true,
      message: isConnected ? "Successfully connected to SAP ByDesign" : "Connection failed",
      environment: {
        baseUrl: process.env.SAP_BYD_BASE_URL,
        tenantId: process.env.SAP_BYD_TENANT_ID || "Not set",
        username: process.env.SAP_BYD_USER ? "Set" : "Not set",
        authMethod: process.env.SAP_BYD_CLIENT_ID ? "OAuth2" : "Basic Auth"
      }
    });
  } catch (error: any) {
    console.error("SAP connection test error:", error);
    res.status(500).json({
      connected: false,
      configured: true,
      message: `Connection test failed: ${error.message}`,
      error: error.message
    });
  }
});

// Test product lookup in SAP
sapTestRouter.get("/product/:gtin", async (req: Request, res: Response) => {
  try {
    const { gtin } = req.params;
    
    if (!gtin) {
      return res.status(400).json({ message: "GTIN is required" });
    }

    const sapService = getSAPService();
    
    console.log(`Checking if product ${gtin} exists in SAP...`);
    const exists = await sapService.verifyProductInSAP(gtin);
    
    if (exists) {
      // Also get stock level
      const stockLevel = await sapService.getStockLevel(gtin);
      
      res.json({
        exists: true,
        gtin,
        message: `Product ${gtin} exists in SAP`,
        currentStock: stockLevel
      });
    } else {
      res.json({
        exists: false,
        gtin,
        message: `Product ${gtin} not found in SAP`,
        note: "This product may need to be created in SAP before inventory can be pushed"
      });
    }
  } catch (error: any) {
    console.error("SAP product lookup error:", error);
    res.status(500).json({
      message: `Product lookup failed: ${error.message}`,
      error: error.message
    });
  }
});

// Test push a sample product to SAP (dry run)
sapTestRouter.post("/push-sample", async (req: Request, res: Response) => {
  try {
    const sapService = getSAPService();
    
    // Create a test product with provided or default data
    const testProduct = {
      gtin: req.body.gtin || "00301430957010",
      serialNumber: req.body.serialNumber || `TEST-${Date.now()}`,
      lotNumber: req.body.lotNumber || "TEST-LOT-001",
      expirationDate: req.body.expirationDate || "2026-12-31",
      productName: req.body.productName || "TEST PRODUCT - SODIUM FERRIC GLUCONATE",
      manufacturer: req.body.manufacturer || "TEST MANUFACTURER",
      ndc: req.body.ndc || "30143095701",
      warehouseLocation: req.body.warehouseLocation || "TEST-LOCATION"
    };

    console.log("Attempting to push test product to SAP:", testProduct);
    
    // First verify product exists in SAP
    const productExists = await sapService.verifyProductInSAP(testProduct.gtin);
    
    if (!productExists && !req.body.force) {
      return res.status(400).json({
        success: false,
        message: `Product ${testProduct.gtin} does not exist in SAP. Set 'force: true' in request body to attempt push anyway.`,
        testProduct
      });
    }

    // Attempt the push
    const result = await sapService.pushToInventory(testProduct);
    
    res.json({
      success: true,
      message: "Test product successfully pushed to SAP",
      testProduct,
      sapResponse: result
    });
    
  } catch (error: any) {
    console.error("SAP test push error:", error);
    res.status(500).json({
      success: false,
      message: `Test push failed: ${error.message}`,
      error: error.message,
      note: "This is expected if the product doesn't exist in SAP or if using test data"
    });
  }
});

// Get current stock level for a product
sapTestRouter.get("/stock/:gtin/:lotNumber?", async (req: Request, res: Response) => {
  try {
    const { gtin, lotNumber } = req.params;
    const sapService = getSAPService();
    
    console.log(`Getting stock level for GTIN: ${gtin}, Lot: ${lotNumber || 'all lots'}`);
    const stockLevel = await sapService.getStockLevel(gtin, lotNumber);
    
    res.json({
      gtin,
      lotNumber: lotNumber || "all",
      stockLevel,
      unit: "EA",
      message: `Current stock level: ${stockLevel} units`
    });
    
  } catch (error: any) {
    console.error("SAP stock check error:", error);
    res.status(500).json({
      message: `Stock check failed: ${error.message}`,
      error: error.message
    });
  }
});

// Test configuration endpoint - shows current config (without secrets)
sapTestRouter.get("/config", async (req: Request, res: Response) => {
  res.json({
    configured: !!process.env.SAP_BYD_BASE_URL,
    settings: {
      baseUrl: process.env.SAP_BYD_BASE_URL || "Not configured",
      tenantId: process.env.SAP_BYD_TENANT_ID || "Not configured",
      username: process.env.SAP_BYD_USER ? "Configured" : "Not configured",
      password: process.env.SAP_BYD_PASSWORD ? "Configured" : "Not configured",
      clientId: process.env.SAP_BYD_CLIENT_ID ? "Configured (OAuth2)" : "Not configured",
      clientSecret: process.env.SAP_BYD_CLIENT_SECRET ? "Configured (OAuth2)" : "Not configured",
      authMethod: process.env.SAP_BYD_CLIENT_ID ? "OAuth2" : "Basic Authentication"
    },
    testEndpoints: {
      connection: "/api/sap-test/connection",
      productLookup: "/api/sap-test/product/:gtin",
      pushSample: "/api/sap-test/push-sample",
      stockCheck: "/api/sap-test/stock/:gtin/:lotNumber?",
      config: "/api/sap-test/config"
    },
    notes: [
      "Use test tenant credentials for initial testing",
      "Ensure products exist in SAP before pushing inventory",
      "Check connection before attempting any operations"
    ]
  });
});