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
    
    // For this demo implementation, we'll create mock product items based on the file ID
    // In a production environment, this would query the database
    
    // Mock product items for development
    const productItems: any[] = [];
    
    // Add mock items for file ID 47 (as we defined in our client-side test)
    if (fileId === 47) {
      for (let i = 0; i < 5; i++) {
        productItems.push({
          id: 10000 + i,
          fileId: 47,
          gtin: '10373123456789',
          serialNumber: 'SN' + (902497 + i).toString(),
          lotNumber: 'LOT5890',
          expirationDate: '2026-12-31',
          eventTime: new Date(),
          sourceGln: 'urn:epc:id:sgln:0373123.00000.0',
          destinationGln: null,
          bizTransactionList: ['PO-2025-001'],
          poId: null,
          createdAt: new Date()
        });
      }
    }
    // Add mock items for file ID 45
    else if (fileId === 45) {
      for (let i = 0; i < 10; i++) {
        productItems.push({
          id: 1288 + i,
          fileId: 45,
          gtin: '00301430957010',
          serialNumber: (10016550749981 + i).toString(),
          lotNumber: '24052241',
          expirationDate: '2026-09-30',
          eventTime: new Date('2024-11-11T12:20:34.827Z'),
          sourceGln: 'urn:epc:id:sgln:56009069.0001.0',
          destinationGln: null,
          bizTransactionList: ['41067'],
          poId: null,
          createdAt: new Date('2025-05-16T17:36:51.435Z')
        });
      }
    }
    
    if (!productItems || productItems.length === 0) {
      return res.status(404).json({ message: "No product items found in this file" });
    }
    
    // Parse barcode data - simple implementation for demo
    // In production, use a more robust parser based on industry standards
    // Example format: "GTIN=00301430957010&SN=10016550749981&LOT=24052241&EXP=260930"
    const parsed: any = {};
    
    barcodeData.split('&').forEach((item: string) => {
      const [key, value] = item.split('=');
      if (key && value) {
        parsed[key.trim()] = value.trim();
      }
    });
    
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