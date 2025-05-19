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
    
    // Get the inventory item
    const inventoryItem = await storage.getInventoryItemBySerial(serialNumber);
    
    if (!inventoryItem) {
      return res.status(404).json({ message: "Product not found in inventory" });
    }
    
    if (inventoryItem.status !== "available") {
      return res.status(400).json({ message: `Product cannot be shipped (current status: ${inventoryItem.status})` });
    }
    
    // Get sales order
    const salesOrder = await storage.getSalesOrder(soId);
    if (!salesOrder) {
      return res.status(404).json({ message: "Sales order not found" });
    }
    
    // Update inventory item status
    const updatedItem = await storage.updateInventoryItem(inventoryItem.id, {
      status: "shipped",
      salesOrderId: soId,
      notes: (inventoryItem.notes ? inventoryItem.notes + "\n" : "") + (notes || ""),
    });
    
    // Log the transaction
    await storage.addInventoryTransaction({
      inventoryId: inventoryItem.id,
      gtin: inventoryItem.gtin,
      serialNumber: inventoryItem.serialNumber,
      lotNumber: inventoryItem.lotNumber,
      expirationDate: inventoryItem.expirationDate,
      transactionType: "ship",
      fromStatus: "available",
      toStatus: "shipped",
      reference: `SO #${soId}`,
      notes: notes || "",
      userId: req.user?.id as number,
    });
    
    res.json(updatedItem);
  } catch (error: any) {
    console.error("Error shipping product:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get all inventory items
inventoryRouter.get("/", async (req: Request, res: Response) => {
  try {
    const items = await storage.getInventoryItems();
    res.json({ items });
  } catch (error: any) {
    console.error("Error fetching inventory:", error);
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
    
    const item = await storage.getInventoryItem(id);
    if (!item) {
      return res.status(404).json({ message: "Inventory item not found" });
    }
    
    res.json(item);
  } catch (error: any) {
    console.error("Error fetching inventory item:", error);
    res.status(500).json({ message: error.message });
  }
});