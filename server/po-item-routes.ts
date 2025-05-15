import { Router, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { insertPurchaseOrderItemSchema } from "@shared/schema";
import { z } from "zod";

export const poItemRouter = Router();

// Middleware to ensure user is authenticated
function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: "Not authenticated" });
}

// Middleware to ensure user is an admin
function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated() && req.user?.role === "administrator") {
    return next();
  }
  return res.status(403).json({ error: "Admin access required" });
}

// Define typed request body
interface TypedRequestBody<T> extends Request {
  body: T;
}

// Create a new purchase order item
poItemRouter.post(
  "/",
  isAuthenticated,
  async (
    req: TypedRequestBody<z.infer<typeof insertPurchaseOrderItemSchema>>,
    res: Response
  ) => {
    try {
      // Validate the request body
      const validatedData = insertPurchaseOrderItemSchema.parse(req.body);

      // Check if the PO exists
      const po = await storage.getPurchaseOrder(validatedData.poId);
      if (!po) {
        return res.status(400).json({ error: "Purchase order not found" });
      }

      // Create the PO item
      const item = await storage.createPurchaseOrderItem(validatedData);

      // Update the total items in the PO
      const poItems = await storage.listPurchaseOrderItems(po.id);
      const totalItems = poItems.reduce((sum, item) => sum + item.quantity, 0);
      await storage.updatePurchaseOrder(po.id, { totalItems });

      return res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating purchase order item:", error);
      return res.status(500).json({ error: "Failed to create purchase order item" });
    }
  }
);

// Get a specific purchase order item by ID
poItemRouter.get("/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid item ID" });
    }
    
    const item = await storage.getPurchaseOrderItem(id);
    if (!item) {
      return res.status(404).json({ error: "Purchase order item not found" });
    }
    
    return res.json(item);
  } catch (error) {
    console.error("Error getting purchase order item:", error);
    return res.status(500).json({ error: "Failed to get purchase order item" });
  }
});

// Update a purchase order item
poItemRouter.patch("/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid item ID" });
    }

    // Get the existing item
    const existingItem = await storage.getPurchaseOrderItem(id);
    if (!existingItem) {
      return res.status(404).json({ error: "Purchase order item not found" });
    }
    
    // Update the item
    const updatedItem = await storage.updatePurchaseOrderItem(id, req.body);
    
    // If the quantity changed, update the PO totals
    if (req.body.quantity !== undefined && req.body.quantity !== existingItem.quantity) {
      const poItems = await storage.listPurchaseOrderItems(existingItem.poId);
      const totalItems = poItems.reduce((sum, item) => sum + item.quantity, 0);
      await storage.updatePurchaseOrder(existingItem.poId, { totalItems });
    }
    
    // If the received quantity changed, update PO totals
    if (req.body.quantityReceived !== undefined && req.body.quantityReceived !== existingItem.quantityReceived) {
      const poItems = await storage.listPurchaseOrderItems(existingItem.poId);
      const receivedItems = poItems.reduce((sum, item) => sum + (item.quantityReceived || 0), 0);
      await storage.updatePurchaseOrder(existingItem.poId, { receivedItems });
      
      // Update PO status if all items received
      const po = await storage.getPurchaseOrder(existingItem.poId);
      if (po && receivedItems >= po.totalItems && po.status === "open") {
        await storage.updatePurchaseOrder(po.id, { status: "received" });
      } else if (po && receivedItems > 0 && receivedItems < po.totalItems && po.status === "open") {
        await storage.updatePurchaseOrder(po.id, { status: "partial" });
      }
    }
    
    return res.json(updatedItem);
  } catch (error) {
    console.error("Error updating purchase order item:", error);
    return res.status(500).json({ error: "Failed to update purchase order item" });
  }
});

// List all items for a purchase order
poItemRouter.get("/po/:poId", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const poId = parseInt(req.params.poId);
    if (isNaN(poId)) {
      return res.status(400).json({ error: "Invalid purchase order ID" });
    }
    
    const items = await storage.listPurchaseOrderItems(poId);
    return res.json(items);
  } catch (error) {
    console.error("Error listing purchase order items:", error);
    return res.status(500).json({ error: "Failed to list purchase order items" });
  }
});

// Delete a purchase order item
poItemRouter.delete("/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid item ID" });
    }
    
    // Get the item first to know its PO
    const item = await storage.getPurchaseOrderItem(id);
    if (!item) {
      return res.status(404).json({ error: "Purchase order item not found" });
    }
    
    const poId = item.poId;
    
    // Delete the item
    const success = await storage.deletePurchaseOrderItem(id);
    if (!success) {
      return res.status(404).json({ error: "Purchase order item could not be deleted" });
    }
    
    // Update PO totals
    const remainingItems = await storage.listPurchaseOrderItems(poId);
    const totalItems = remainingItems.reduce((sum, item) => sum + item.quantity, 0);
    const receivedItems = remainingItems.reduce((sum, item) => sum + (item.quantityReceived || 0), 0);
    
    await storage.updatePurchaseOrder(poId, { 
      totalItems,
      receivedItems
    });
    
    return res.status(204).send();
  } catch (error) {
    console.error("Error deleting purchase order item:", error);
    return res.status(500).json({ error: "Failed to delete purchase order item" });
  }
});