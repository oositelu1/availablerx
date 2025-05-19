import { Router, Request, Response } from "express";
import { storage } from "./storage";

export const inventoryRouter = Router();

// Middleware to check if user is authenticated
inventoryRouter.use((req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
});

// Get inventory stats
inventoryRouter.get("/stats", async (req: Request, res: Response) => {
  try {
    // While we implement the database integration, provide mock data
    const stats = {
      total: 145,
      available: 93,
      allocated: 12,
      shipped: 35,
      expired: 3,
      damaged: 2
    };
    res.json(stats);
  } catch (error: any) {
    console.error("Error fetching inventory stats:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get inventory ledger
inventoryRouter.get("/ledger", async (req: Request, res: Response) => {
  try {
    // Sample mock transaction data for demonstration
    const transactions = [
      {
        id: 1,
        inventoryId: 101,
        gtin: '00301430957010',
        serialNumber: '10016550749981',
        lotNumber: '24052241',
        expirationDate: '2026-09-30',
        transactionType: 'receive',
        fromStatus: null,
        toStatus: 'available',
        reference: 'File #47',
        transactionDate: new Date('2025-05-15T10:30:00'),
        performedBy: 2,
      },
      {
        id: 2,
        inventoryId: 102,
        gtin: '00301430957010',
        serialNumber: '10018521666433',
        lotNumber: '24052241',
        expirationDate: '2026-09-30',
        transactionType: 'receive',
        fromStatus: null,
        toStatus: 'available',
        reference: 'File #47',
        transactionDate: new Date('2025-05-15T10:35:00'),
        performedBy: 2,
      },
      {
        id: 3,
        inventoryId: 103,
        gtin: '00301430957010',
        serialNumber: '10015409851063',
        lotNumber: '24052241',
        expirationDate: '2026-09-30',
        transactionType: 'receive',
        fromStatus: null,
        toStatus: 'available',
        reference: 'File #47',
        transactionDate: new Date('2025-05-15T10:40:00'),
        performedBy: 2,
      },
      {
        id: 4,
        inventoryId: 101,
        gtin: '00301430957010',
        serialNumber: '10016550749981',
        lotNumber: '24052241',
        expirationDate: '2026-09-30',
        transactionType: 'ship',
        fromStatus: 'available',
        toStatus: 'shipped',
        reference: 'SO #1',
        transactionDate: new Date('2025-05-16T14:20:00'),
        performedBy: 2,
      }
    ];
    
    res.json({ transactions });
  } catch (error: any) {
    console.error("Error fetching inventory ledger:", error);
    res.status(500).json({ message: error.message });
  }
});

// Add product to inventory (scanning in)
inventoryRouter.post("/receive", async (req: Request, res: Response) => {
  try {
    const { fileId, gtin, serialNumber, lotNumber, expirationDate, notes } = req.body;
    
    if (!fileId || !gtin || !serialNumber || !lotNumber) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    
    // For demo, create a mock inventory item
    const inventoryItem = {
      id: Math.floor(Math.random() * 1000) + 100,
      fileId,
      gtin,
      serialNumber,
      lotNumber,
      expirationDate,
      status: "available",
      notes: notes || "",
      createdBy: req.user?.id as number,
      createdAt: new Date(),
      receivedAt: new Date(),
      ndc: gtin.substring(2, 13),
      productName: "SODIUM FERRIC GLUCONATE",
      manufacturer: "WEST-WARD PHARMACEUTICALS",
      packageType: gtin.charAt(7) === '4' ? 'case' : 'item',
    };
    
    // Return the mock item
    res.status(201).json(inventoryItem);
  } catch (error: any) {
    console.error("Error receiving product:", error);
    res.status(500).json({ message: error.message });
  }
});

// Ship product out of inventory
inventoryRouter.post("/ship", async (req: Request, res: Response) => {
  try {
    const { soId, serialNumber, notes } = req.body;
    
    if (!soId || !serialNumber) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    
    // For demo, create a mock response - later we'll replace with actual storage calls
    const updatedItem = {
      id: 101,
      gtin: '00301430957010',
      serialNumber,
      lotNumber: '24052241',
      expirationDate: '2026-09-30',
      status: 'shipped',
      notes: notes || "",
      salesOrderId: soId,
      shippedAt: new Date(),
      lastScannedAt: new Date(),
      lastScannedBy: req.user?.id,
      createdAt: new Date('2025-05-15T10:30:00'),
      receivedAt: new Date('2025-05-15T10:30:00'),
      createdBy: 1,
      ndc: '30143095701',
      productName: "SODIUM FERRIC GLUCONATE",
      manufacturer: "WEST-WARD PHARMACEUTICALS",
      packageType: 'item'
    };
    
    res.json(updatedItem);
  } catch (error: any) {
    console.error("Error shipping product:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get all inventory items
inventoryRouter.get("/", async (req: Request, res: Response) => {
  try {
    // Provide mock inventory data for UI testing
    const items = [
      {
        id: 101,
        gtin: '00301430957010',
        serialNumber: '10016550749981',
        lotNumber: '24052241',
        expirationDate: '2026-09-30',
        status: 'shipped',
        notes: "Shipped to Memorial Hospital",
        salesOrderId: 1,
        shippedAt: new Date('2025-05-16T14:20:00'),
        createdAt: new Date('2025-05-15T10:30:00'),
        receivedAt: new Date('2025-05-15T10:30:00'),
        createdBy: 2,
        ndc: '30143095701',
        productName: "SODIUM FERRIC GLUCONATE",
        manufacturer: "WEST-WARD PHARMACEUTICALS",
        packageType: 'item'
      },
      {
        id: 102,
        gtin: '00301430957010',
        serialNumber: '10018521666433',
        lotNumber: '24052241',
        expirationDate: '2026-09-30',
        status: 'available',
        notes: "",
        createdAt: new Date('2025-05-15T10:35:00'),
        receivedAt: new Date('2025-05-15T10:35:00'),
        createdBy: 2,
        ndc: '30143095701',
        productName: "SODIUM FERRIC GLUCONATE",
        manufacturer: "WEST-WARD PHARMACEUTICALS",
        packageType: 'item'
      },
      {
        id: 103,
        gtin: '00301430957010',
        serialNumber: '10015409851063',
        lotNumber: '24052241',
        expirationDate: '2026-09-30',
        status: 'available',
        notes: "",
        createdAt: new Date('2025-05-15T10:40:00'),
        receivedAt: new Date('2025-05-15T10:40:00'),
        createdBy: 2,
        ndc: '30143095701',
        productName: "SODIUM FERRIC GLUCONATE",
        manufacturer: "WEST-WARD PHARMACEUTICALS",
        packageType: 'item'
      },
      {
        id: 104,
        gtin: '00301430957010',
        serialNumber: '10019874325512',
        lotNumber: '24052241',
        expirationDate: '2026-09-30',
        status: 'available',
        notes: "",
        createdAt: new Date('2025-05-15T10:45:00'),
        receivedAt: new Date('2025-05-15T10:45:00'),
        createdBy: 2,
        ndc: '30143095701',
        productName: "SODIUM FERRIC GLUCONATE",
        manufacturer: "WEST-WARD PHARMACEUTICALS",
        packageType: 'item'
      }
    ];
    
    res.json({ items });
  } catch (error: any) {
    console.error("Error fetching inventory:", error);
    res.status(500).json({ message: error.message });
  }
});

// Validate scanned product against file data
inventoryRouter.post("/validate", async (req: Request, res: Response) => {
  try {
    const { fileId, barcodeData } = req.body;
    
    if (!fileId) {
      return res.status(400).json({ message: "File ID is required" });
    }
    
    if (!barcodeData) {
      return res.status(400).json({ message: "Barcode data is required" });
    }
    
    // Fetch product items for the file from the API
    // This will use the existing endpoint that provides the real data
    const response = await fetch(`http://localhost:5000/api/product-items/file/${fileId}`, {
      headers: {
        'Cookie': req.headers.cookie || ''
      }
    });
    
    if (!response.ok) {
      return res.status(response.status).json({ 
        message: "Error fetching product items for file",
        errorCode: response.status
      });
    }
    
    const productItems = await response.json();
    
    if (!productItems || productItems.length === 0) {
      return res.status(404).json({ message: "No product items found in this file" });
    }
    
    // Parse barcode data - handle both formats
    // Format 1: "GTIN=00301430957010&SN=10016550749981&LOT=24052241&EXP=260930"
    // Format 2: "01503014395701082110000005921417260930102405224, GTIN: 50301439570108..."
    
    const parsed: any = {};
    
    // Check if the data is in the GS1 DataMatrix format (numeric sequence with Application Identifiers)
    if (barcodeData.includes('GTIN=')) {
      // Format 1: Key-value pairs
      barcodeData.split('&').forEach((item: string) => {
        const [key, value] = item.split('=');
        if (key && value) {
          parsed[key.trim()] = value.trim();
        }
      });
    } else {
      // Format 2: GS1 DataMatrix with descriptive text
      // Extract from "01" prefix (GTIN), "21" prefix (Serial), "10" prefix (Lot), "17" prefix (Expiration)
      
      try {
        // Look for GTIN in the data
        const gtinMatch = barcodeData.match(/GTIN:\s*(\d+)/i);
        if (gtinMatch && gtinMatch[1]) {
          parsed.GTIN = gtinMatch[1];
        } else {
          // Try to extract from "01" prefix (standard GTIN AI)
          const gtinAIMatch = barcodeData.match(/01(\d{14})/);
          if (gtinAIMatch && gtinAIMatch[1]) {
            parsed.GTIN = gtinAIMatch[1];
          }
        }
        
        // Look for Serial Number in the data
        const snMatch = barcodeData.match(/Serial Number:\s*([^\s,\n]+)/i);
        if (snMatch && snMatch[1]) {
          parsed.SN = snMatch[1];
        } else {
          // Try to extract from "21" prefix (standard Serial AI)
          const snAIMatch = barcodeData.match(/21([^\s,\n]+)/);
          if (snAIMatch && snAIMatch[1]) {
            parsed.SN = snAIMatch[1];
          }
        }
        
        // Look for Lot Number in the data
        const lotMatch = barcodeData.match(/Lot Number:\s*([^\s,\n]+)/i);
        if (lotMatch && lotMatch[1]) {
          parsed.LOT = lotMatch[1];
        } else {
          // Try to extract from "10" prefix (standard Lot AI)
          const lotAIMatch = barcodeData.match(/10([^\s,\n]+)/);
          if (lotAIMatch && lotAIMatch[1]) {
            parsed.LOT = lotAIMatch[1];
          }
        }
        
        // Look for Expiration Date in the data
        const expMatch = barcodeData.match(/Expiration Date:\s*([^\s,\n]+)/i);
        if (expMatch && expMatch[1]) {
          // Convert various date formats to YYMMDD
          parsed.EXP = expMatch[1].replace(/\//g, ''); // Remove slashes
        } else {
          // Try to extract from "17" prefix (standard Expiration AI)
          const expAIMatch = barcodeData.match(/17(\d{6})/);
          if (expAIMatch && expAIMatch[1]) {
            parsed.EXP = expAIMatch[1];
          }
        }
      } catch (err) {
        console.error("Error parsing barcode data:", err);
      }
    }
    
    console.log("Parsed barcode data:", parsed);
    
    // Check if we have the required data
    if (!parsed.GTIN || !parsed.SN) {
      return res.status(400).json({ 
        message: "Invalid barcode format. Required format: GTIN=value&SN=value&LOT=value&EXP=value",
        parsed
      });
    }
    
    // Format expiration date if present
    let formattedExpDate = null;
    if (parsed.EXP) {
      // Convert from YYMMDD to YYYY-MM-DD
      const exp = parsed.EXP;
      if (exp.length === 6) {
        const yy = exp.substring(0, 2);
        const mm = exp.substring(2, 4);
        const dd = exp.substring(4, 6);
        const year = parseInt(yy) < 50 ? `20${yy}` : `19${yy}`;
        formattedExpDate = `${year}-${mm}-${dd}`;
      }
    }
    
    // Look for matching product in the file
    const matchingProduct = productItems.find((item: any) => {
      // Check GTIN (required)
      if (item.gtin !== parsed.GTIN) return false;
      
      // Check serial number (required)
      if (item.serialNumber !== parsed.SN) return false;
      
      // Check lot number if provided
      if (parsed.LOT && item.lotNumber !== parsed.LOT) return false;
      
      // Check expiration date if formatted
      if (formattedExpDate && item.expirationDate !== formattedExpDate) return false;
      
      return true;
    });
    
    if (!matchingProduct) {
      return res.status(404).json({ 
        message: "Product not found in the selected file", 
        scannedData: {
          gtin: parsed.GTIN,
          serialNumber: parsed.SN,
          lotNumber: parsed.LOT || null,
          expirationDate: formattedExpDate || null
        }
      });
    }
    
    // Get additional product info if available
    const fileInfo = await storage.getFile(fileId);
    let productInfo = null;
    
    if (fileInfo && fileInfo.metadata && fileInfo.metadata.productInfo) {
      productInfo = fileInfo.metadata.productInfo;
    }
    
    // Return the validated product
    res.status(200).json({
      validated: true,
      product: {
        ...matchingProduct,
        productInfo
      }
    });
    
  } catch (error: any) {
    console.error("Error validating product:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get a single inventory item
inventoryRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid inventory ID" });
    }
    
    // For demo, create a mock inventory item based on the ID
    // In production, this would be fetched from the database
    const mockItems = {
      101: {
        id: 101,
        gtin: '00301430957010',
        serialNumber: '10016550749981',
        lotNumber: '24052241',
        expirationDate: '2026-09-30',
        status: 'shipped',
        notes: "Shipped to Memorial Hospital",
        salesOrderId: 1,
        shippedAt: new Date('2025-05-16T14:20:00'),
        createdAt: new Date('2025-05-15T10:30:00'),
        receivedAt: new Date('2025-05-15T10:30:00'),
        createdBy: 2,
        ndc: '30143095701',
        productName: "SODIUM FERRIC GLUCONATE",
        manufacturer: "WEST-WARD PHARMACEUTICALS",
        packageType: 'item'
      },
      102: {
        id: 102,
        gtin: '00301430957010',
        serialNumber: '10018521666433',
        lotNumber: '24052241',
        expirationDate: '2026-09-30',
        status: 'available',
        notes: "",
        createdAt: new Date('2025-05-15T10:35:00'),
        receivedAt: new Date('2025-05-15T10:35:00'),
        createdBy: 2,
        ndc: '30143095701',
        productName: "SODIUM FERRIC GLUCONATE",
        manufacturer: "WEST-WARD PHARMACEUTICALS",
        packageType: 'item'
      }
    };
    
    const item = mockItems[id];
    if (!item) {
      return res.status(404).json({ message: "Inventory item not found" });
    }
    
    res.json(item);
  } catch (error: any) {
    console.error("Error fetching inventory item:", error);
    res.status(500).json({ message: error.message });
  }
});