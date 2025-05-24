import { Router, Request, Response } from "express";
import { storage } from "./storage";
import * as fs from 'fs';
import * as path from 'path';

export const salesOrderRouter = Router();

// File path for persisting sales orders
const SALES_ORDERS_FILE = path.join(process.cwd(), 'sales-orders.json');

// Load sales orders from file or initialize empty
let salesOrders: any[] = [];
try {
  if (fs.existsSync(SALES_ORDERS_FILE)) {
    const data = fs.readFileSync(SALES_ORDERS_FILE, 'utf-8');
    salesOrders = JSON.parse(data);
    console.log(`Loaded ${salesOrders.length} sales orders from file`);
  }
} catch (error) {
  console.error('Error loading sales orders:', error);
  salesOrders = [];
}

// Helper to save sales orders to file
function saveSalesOrders() {
  try {
    fs.writeFileSync(SALES_ORDERS_FILE, JSON.stringify(salesOrders, null, 2));
  } catch (error) {
    console.error('Error saving sales orders:', error);
  }
}

// Middleware to check if user is authenticated
salesOrderRouter.use((req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
});

// Get sales order count
salesOrderRouter.get("/count", async (req: Request, res: Response) => {
  try {
    // For demo, return mock count
    res.json({ count: 3 });
  } catch (error: any) {
    console.error("Error fetching sales order count:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get all sales orders
salesOrderRouter.get("/", async (req: Request, res: Response) => {
  try {
    // Return the in-memory sales orders array
    res.json({ orders: salesOrders });
  } catch (error: any) {
    console.error("Error fetching sales orders:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get a single sales order
salesOrderRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid sales order ID" });
    }
    
    // First check the in-memory array
    const order = salesOrders.find(so => so.id === id);
    if (order) {
      // Add empty items array if not present
      if (!order.items) {
        order.items = [];
      }
      return res.json(order);
    }
    
    // If not found in array, return 404
    return res.status(404).json({ message: "Sales order not found" });
  } catch (error: any) {
    console.error("Error fetching sales order:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get items for a sales order
salesOrderRouter.get("/:id/items", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid sales order ID" });
    }
    
    // Check if order exists
    const order = salesOrders.find(so => so.id === id);
    if (!order) {
      return res.status(404).json({ message: "Sales order not found" });
    }
    
    // Return items array (empty for now since we don't have item management yet)
    res.json({ items: order.items || [] });
  } catch (error: any) {
    console.error("Error fetching sales order items:", error);
    res.status(500).json({ message: error.message });
  }
});

// Create a new sales order
salesOrderRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { soNumber, customerId, status, orderDate, linkedFileIds } = req.body;
    
    // Validate required fields
    if (!soNumber || !customerId) {
      return res.status(400).json({ 
        message: "Missing required fields: soNumber and customerId are required" 
      });
    }
    
    // Get customer name from partners if possible
    const partners = await storage.listPartners();
    const customer = partners.find(p => p.id === parseInt(customerId));
    
    const newOrder = {
      id: Date.now(), // Simple ID generation
      soNumber,
      customerId: parseInt(customerId),
      customer: customer?.name || `Customer ${customerId}`,
      status: status || 'approved',
      orderDate: orderDate || new Date().toISOString().split('T')[0],
      linkedFileIds: linkedFileIds || [],
      totalItems: 0,
      totalShipped: 0,
      shipToLocation: customer?.address || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Add to the in-memory array
    salesOrders.push(newOrder);
    
    // Save to file
    saveSalesOrders();
    
    console.log('Created sales order:', newOrder);
    console.log('Total sales orders:', salesOrders.length);
    
    // Return the created order
    res.status(201).json(newOrder);
  } catch (error: any) {
    console.error("Error creating sales order:", error);
    res.status(500).json({ message: error.message || "Failed to create sales order" });
  }
});

// Update a sales order (PATCH)
salesOrderRouter.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid sales order ID" });
    }
    
    // Find the order in the array
    const orderIndex = salesOrders.findIndex(so => so.id === id);
    if (orderIndex === -1) {
      return res.status(404).json({ message: "Sales order not found" });
    }
    
    // Update only the fields that are provided
    const updates = req.body;
    const updatedOrder = {
      ...salesOrders[orderIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    // If status is being updated to 'shipped', set the actual ship date
    if (updates.status === 'shipped' && !updatedOrder.actualShipDate) {
      updatedOrder.actualShipDate = new Date().toISOString().split('T')[0];
    }
    
    // Update in the array
    salesOrders[orderIndex] = updatedOrder;
    
    // Save to file
    saveSalesOrders();
    
    console.log(`Updated sales order ${id}:`, updates);
    
    // Return the updated order
    res.json(updatedOrder);
  } catch (error: any) {
    console.error("Error updating sales order:", error);
    res.status(500).json({ message: error.message || "Failed to update sales order" });
  }
});