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
    
    console.log("Received barcode data:", barcodeData);
    
    // Get product items from the database for this file ID
    const productItems = await storage.listProductItemsForFile(parseInt(fileId));
    
    if (!productItems || productItems.length === 0) {
      return res.status(404).json({ message: "No product items found in this file" });
    }
    
    // Extract data from barcode string
    let gtin = '';
    let serialNumber = '';
    let lotNumber = '';
    let expirationDate = '';
    
    // Try to extract values from the barcode string
    if (barcodeData.includes('GTIN:')) {
      const gtinMatch = barcodeData.match(/GTIN:\s*(\d+)/i);
      if (gtinMatch && gtinMatch[1]) gtin = gtinMatch[1];
      
      const serialMatch = barcodeData.match(/Serial Number:\s*([^\s,\n]+)/i);
      if (serialMatch && serialMatch[1]) serialNumber = serialMatch[1];
      
      const lotMatch = barcodeData.match(/Lot Number:\s*([^\s,\n]+)/i);
      if (lotMatch && lotMatch[1]) lotNumber = lotMatch[1];
      
      // Match various date formats
      const expMatch = barcodeData.match(/Expiration Date:\s*([^\s,\n]+)/i);
      if (expMatch && expMatch[1]) {
        // Convert from MM/DD/YY to YYYY-MM-DD if needed
        const expParts = expMatch[1].split('/');
        if (expParts.length === 3) {
          const mm = expParts[0].padStart(2, '0');
          const dd = expParts[1].padStart(2, '0');
          const yy = expParts[2].padStart(2, '0');
          const year = parseInt(yy) < 50 ? `20${yy}` : `19${yy}`;
          expirationDate = `${year}-${mm}-${dd}`;
        } else {
          expirationDate = expMatch[1];
        }
      }
    } else if (barcodeData.includes('GTIN=')) {
      // Format: "GTIN=value&SN=value&LOT=value&EXP=value"
      barcodeData.split('&').forEach((item) => {
        const [key, value] = item.split('=');
        if (key && value) {
          if (key.trim() === 'GTIN') gtin = value.trim();
          if (key.trim() === 'SN') serialNumber = value.trim();
          if (key.trim() === 'LOT') lotNumber = value.trim();
          if (key.trim() === 'EXP') {
            // Convert from YYMMDD to YYYY-MM-DD
            const exp = value.trim();
            if (exp.length === 6) {
              const yy = exp.substring(0, 2);
              const mm = exp.substring(2, 4);
              const dd = exp.substring(4, 6);
              const year = parseInt(yy) < 50 ? `20${yy}` : `19${yy}`;
              expirationDate = `${year}-${mm}-${dd}`;
            }
          }
        }
      });
    } else {
      // Try to extract from GS1 DataMatrix format (numeric sequence with Application Identifiers)
      try {
        // Try to extract from "01" prefix (standard GTIN AI)
        const gtinAIMatch = barcodeData.match(/01(\d{14})/);
        if (gtinAIMatch && gtinAIMatch[1]) {
          gtin = gtinAIMatch[1];
        }
        
        // Try to extract from "21" prefix (standard Serial AI)
        const snAIMatch = barcodeData.match(/21([^\s,\n]+)/);
        if (snAIMatch && snAIMatch[1]) {
          serialNumber = snAIMatch[1];
        }
        
        // Try to extract from "10" prefix (standard Lot AI)
        const lotAIMatch = barcodeData.match(/10([^\s,\n]+)/);
        if (lotAIMatch && lotAIMatch[1]) {
          lotNumber = lotAIMatch[1];
        }
        
        // Try to extract from "17" prefix (standard Expiration AI)
        const expAIMatch = barcodeData.match(/17(\d{6})/);
        if (expAIMatch && expAIMatch[1]) {
          const exp = expAIMatch[1];
          const yy = exp.substring(0, 2);
          const mm = exp.substring(2, 4);
          const dd = exp.substring(4, 6);
          const year = parseInt(yy) < 50 ? `20${yy}` : `19${yy}`;
          expirationDate = `${year}-${mm}-${dd}`;
        }
      } catch (err) {
        console.error("Error parsing DataMatrix format:", err);
      }
    }
    
    console.log("Extracted barcode data:", { gtin, serialNumber, lotNumber, expirationDate });
    
    if (!gtin || !serialNumber) {
      return res.status(400).json({ 
        message: "Could not extract required GTIN and Serial Number from barcode",
        parsed: { gtin, serialNumber, lotNumber, expirationDate }
      });
    }
    
    // Look for matching product
    const matchingProduct = productItems.find(item => {
      // GTIN and Serial Number are required matches
      const gtinMatch = item.gtin === gtin;
      const serialMatch = item.serialNumber === serialNumber;
      
      // Lot and expiration date are optional matching criteria
      const lotMatch = !lotNumber || item.lotNumber === lotNumber;
      const expMatch = !expirationDate || item.expirationDate === expirationDate;
      
      return gtinMatch && serialMatch && lotMatch && expMatch;
    });
    
    if (!matchingProduct) {
      return res.status(404).json({
        message: "Product not found in the selected file", 
        scannedData: { gtin, serialNumber, lotNumber, expirationDate }
      });
    }
    
    // Get additional product info if available
    const fileInfo = await storage.getFile(parseInt(fileId));
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