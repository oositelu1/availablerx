import { Router, Request, Response } from "express";
import { storage } from "./storage";
import { checkAuthenticated } from "./auth-middleware";

export const inventoryRouter = Router();

// Middleware to check if user is authenticated
inventoryRouter.use(checkAuthenticated);

// Get inventory stats
inventoryRouter.get("/stats", async (req: Request, res: Response) => {
  try {
    const stats = await storage.getInventoryStats();
    res.json(stats);
  } catch (error: any) {
    console.error("Error fetching inventory stats:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get inventory ledger
inventoryRouter.get("/ledger", async (req: Request, res: Response) => {
  try {
    const transactions = await storage.getInventoryTransactions();
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
    
    // Check if the product already exists in inventory
    const existingProduct = await storage.getInventoryItemBySerial(serialNumber);
    if (existingProduct) {
      return res.status(400).json({ message: "Product already exists in inventory" });
    }
    
    // Create a new inventory item
    const inventoryItem = await storage.addInventoryItem({
      fileId,
      gtin,
      serialNumber,
      lotNumber,
      expirationDate,
      status: "available",
      notes: notes || "",
      userId: req.user?.id as number,
    });
    
    // Log the transaction
    await storage.addInventoryTransaction({
      inventoryId: inventoryItem.id,
      gtin,
      serialNumber,
      lotNumber,
      expirationDate,
      transactionType: "receive",
      fromStatus: null,
      toStatus: "available",
      reference: `File #${fileId}`,
      notes: notes || "",
      userId: req.user?.id as number,
    });
    
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