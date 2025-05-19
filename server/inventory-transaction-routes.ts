import { Router, Request, Response } from "express";
import { storage } from "./storage";
import { checkAuthenticated } from "./auth-middleware";

export const inventoryTransactionRouter = Router();

// Middleware to check if user is authenticated
inventoryTransactionRouter.use(checkAuthenticated);

// Get all inventory transactions
inventoryTransactionRouter.get("/", async (req: Request, res: Response) => {
  try {
    const transactions = await storage.getInventoryTransactions();
    res.json({ transactions });
  } catch (error: any) {
    console.error("Error fetching inventory transactions:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get a single inventory transaction
inventoryTransactionRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid transaction ID" });
    }
    
    const transaction = await storage.getInventoryTransaction(id);
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }
    
    res.json(transaction);
  } catch (error: any) {
    console.error("Error fetching inventory transaction:", error);
    res.status(500).json({ message: error.message });
  }
});