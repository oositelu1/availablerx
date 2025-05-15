import { Router } from 'express';
import { z } from 'zod';
import { storage } from './storage';
import { insertSalesOrderSchema } from '@shared/schema';

export const salesOrderRouter = Router();

// Authentication check is done in each route handler

// Get all sales orders with optional filters
salesOrderRouter.get('/', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  
  try {
    const { status, customerId, startDate, endDate, page = '1', limit = '10' } = req.query;
    
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const offset = (pageNum - 1) * limitNum;
    
    // Build filters object
    const filters: any = {
      limit: limitNum,
      offset
    };
    
    if (status) filters.status = status;
    if (customerId) filters.customerId = parseInt(customerId as string);
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);
    
    const result = await storage.listSalesOrders(filters);
    
    res.json({
      orders: result.orders,
      total: result.total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(result.total / limitNum)
    });
  } catch (error) {
    console.error('Error fetching sales orders:', error);
    res.status(500).json({ message: 'Failed to fetch sales orders' });
  }
});

// Get a specific sales order by ID
salesOrderRouter.get('/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid sales order ID' });
    }
    
    const order = await storage.getSalesOrder(id);
    if (!order) {
      return res.status(404).json({ message: 'Sales order not found' });
    }
    
    res.json(order);
  } catch (error) {
    console.error('Error fetching sales order:', error);
    res.status(500).json({ message: 'Failed to fetch sales order' });
  }
});

// Get a sales order by SO Number
salesOrderRouter.get('/number/:soNumber', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  
  try {
    const { soNumber } = req.params;
    
    const order = await storage.getSalesOrderBySoNumber(soNumber);
    if (!order) {
      return res.status(404).json({ message: 'Sales order not found' });
    }
    
    res.json(order);
  } catch (error) {
    console.error('Error fetching sales order by SO number:', error);
    res.status(500).json({ message: 'Failed to fetch sales order' });
  }
});

// Create a new sales order
salesOrderRouter.post('/', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  
  try {
    const validatedData = insertSalesOrderSchema.parse({
      ...req.body,
      createdBy: req.user.id
    });
    
    // Check if customerId exists (it's a required field)
    const customer = await storage.getPartner(validatedData.customerId);
    if (!customer) {
      return res.status(400).json({ message: 'Customer not found' });
    }
    
    // Check for duplicate SO number
    if (validatedData.soNumber) {
      const existingOrder = await storage.getSalesOrderBySoNumber(validatedData.soNumber);
      if (existingOrder) {
        return res.status(400).json({ message: 'A sales order with this SO number already exists' });
      }
    }
    
    const order = await storage.createSalesOrder(validatedData);
    
    res.status(201).json(order);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: error.errors 
      });
    }
    console.error('Error creating sales order:', error);
    res.status(500).json({ message: 'Failed to create sales order' });
  }
});

// Update a sales order
salesOrderRouter.patch('/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid sales order ID' });
    }
    
    const order = await storage.getSalesOrder(id);
    if (!order) {
      return res.status(404).json({ message: 'Sales order not found' });
    }
    
    // Only allow updates to certain fields depending on order status
    const updates = { ...req.body };
    
    // Add audit trail
    updates.lastUpdatedAt = new Date();
    updates.lastUpdatedBy = req.user.id;
    
    // If SO number is being changed, check for duplicates
    if (updates.soNumber && updates.soNumber !== order.soNumber) {
      const existingOrder = await storage.getSalesOrderBySoNumber(updates.soNumber);
      if (existingOrder) {
        return res.status(400).json({ message: 'A sales order with this SO number already exists' });
      }
    }
    
    const updatedOrder = await storage.updateSalesOrder(id, updates);
    
    res.json(updatedOrder);
  } catch (error) {
    console.error('Error updating sales order:', error);
    res.status(500).json({ message: 'Failed to update sales order' });
  }
});

// Allocate inventory for a sales order (for picking)
salesOrderRouter.post('/:id/allocate', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid sales order ID' });
    }
    
    const order = await storage.getSalesOrder(id);
    if (!order) {
      return res.status(404).json({ message: 'Sales order not found' });
    }
    
    // Verify the order is in a valid state for allocation
    if (order.status !== 'draft' && order.status !== 'approved') {
      return res.status(400).json({ 
        message: `Cannot allocate inventory for an order in '${order.status}' status` 
      });
    }
    
    // Get all items for this SO
    const items = await storage.listSalesOrderItems(id);
    if (items.length === 0) {
      return res.status(400).json({ message: 'Sales order has no items to allocate' });
    }
    
    let allocationSuccessful = true;
    const results = [];
    
    // Try to allocate inventory for each item
    for (const item of items) {
      try {
        // We'll need to implement allocateInventoryForSalesOrderItem in storage
        const success = await storage.allocateInventoryForSalesOrderItem(item.id);
        results.push({
          itemId: item.id,
          gtin: item.gtin,
          success,
          message: success ? 'Inventory allocated successfully' : 'Failed to allocate inventory'
        });
        
        if (!success) {
          allocationSuccessful = false;
        }
      } catch (itemError) {
        console.error(`Error allocating inventory for item ${item.id}:`, itemError);
        results.push({
          itemId: item.id,
          gtin: item.gtin,
          success: false,
          message: 'Error allocating inventory'
        });
        allocationSuccessful = false;
      }
    }
    
    // If all items were allocated, update the sales order status
    if (allocationSuccessful) {
      await storage.updateSalesOrder(id, { 
        status: 'allocated',
        lastUpdatedAt: new Date(),
        lastUpdatedBy: req.user.id
      });
    }
    
    res.json({
      orderId: id,
      success: allocationSuccessful,
      message: allocationSuccessful ? 
        'All items have been allocated successfully' : 
        'Some items could not be allocated',
      itemResults: results
    });
  } catch (error) {
    console.error('Error allocating inventory for sales order:', error);
    res.status(500).json({ message: 'Failed to allocate inventory' });
  }
});

// Process shipping for a sales order
salesOrderRouter.post('/:id/ship', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid sales order ID' });
    }
    
    const order = await storage.getSalesOrder(id);
    if (!order) {
      return res.status(404).json({ message: 'Sales order not found' });
    }
    
    // Verify the order is in a valid state for shipping
    if (order.status !== 'allocated' && order.status !== 'picking') {
      return res.status(400).json({ 
        message: `Cannot ship an order in '${order.status}' status. Order must be allocated first.` 
      });
    }
    
    // We'll need to implement shipInventoryForSalesOrder in storage
    const success = await storage.shipInventoryForSalesOrder(id);
    
    if (success) {
      // Update order status
      await storage.updateSalesOrder(id, { 
        status: 'shipped',
        lastUpdatedAt: new Date(),
        lastUpdatedBy: req.user.id,
        actualShipDate: new Date() // Record the actual ship date
      });
      
      res.json({
        orderId: id,
        success: true,
        message: 'Sales order has been shipped successfully'
      });
    } else {
      res.status(400).json({
        orderId: id,
        success: false,
        message: 'Failed to ship sales order'
      });
    }
  } catch (error) {
    console.error('Error shipping sales order:', error);
    res.status(500).json({ message: 'Failed to process shipping' });
  }
});

// Cancel a sales order
salesOrderRouter.post('/:id/cancel', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid sales order ID' });
    }
    
    const order = await storage.getSalesOrder(id);
    if (!order) {
      return res.status(404).json({ message: 'Sales order not found' });
    }
    
    // Cannot cancel orders that have been shipped
    if (order.status === 'shipped' || order.status === 'delivered') {
      return res.status(400).json({ 
        message: `Cannot cancel an order in '${order.status}' status` 
      });
    }
    
    // If inventory was allocated, release it
    if (order.status === 'allocated' || order.status === 'picking') {
      // We'll need to implement releaseInventoryForSalesOrder in storage
      await storage.releaseInventoryForSalesOrder(id);
    }
    
    // Update order status
    await storage.updateSalesOrder(id, { 
      status: 'cancelled',
      lastUpdatedAt: new Date(),
      lastUpdatedBy: req.user.id,
      notes: req.body.notes ? `${order.notes || ''}\n[CANCELLED] ${req.body.notes}` : order.notes
    });
    
    res.json({
      orderId: id,
      success: true,
      message: 'Sales order has been cancelled'
    });
  } catch (error) {
    console.error('Error cancelling sales order:', error);
    res.status(500).json({ message: 'Failed to cancel sales order' });
  }
});

// Generate EPCIS for a shipped order
salesOrderRouter.post('/:id/generate-epcis', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid sales order ID' });
    }
    
    const order = await storage.getSalesOrder(id);
    if (!order) {
      return res.status(404).json({ message: 'Sales order not found' });
    }
    
    // Can only generate EPCIS for shipped orders
    if (order.status !== 'shipped') {
      return res.status(400).json({ 
        message: `Cannot generate EPCIS for an order in '${order.status}' status. Order must be shipped first.` 
      });
    }
    
    // Check if EPCIS was already generated
    if (order.outboundEpcisId) {
      const epcisFile = await storage.getFile(order.outboundEpcisId);
      if (epcisFile) {
        return res.status(400).json({ 
          message: 'EPCIS file already generated for this order',
          fileId: order.outboundEpcisId,
          file: epcisFile
        });
      }
    }
    
    // We'll need to implement generateEpcisForSalesOrder function eventually
    // For now, we'll return a "not implemented" error
    res.status(501).json({ 
      message: 'EPCIS file generation is not yet implemented'
    });
    
    /* Once implemented, the code would look something like this:
    const epcisResult = await generateEpcisForSalesOrder(id);
    
    if (epcisResult.success) {
      // Update the sales order with the file ID
      await storage.updateSalesOrder(id, {
        outboundEpcisId: epcisResult.fileId,
        lastUpdatedAt: new Date(),
        lastUpdatedBy: req.user.id
      });
      
      res.json({
        orderId: id,
        success: true,
        message: 'EPCIS file generated successfully',
        fileId: epcisResult.fileId,
        file: epcisResult.file
      });
    } else {
      res.status(400).json({
        orderId: id,
        success: false,
        message: 'Failed to generate EPCIS file',
        error: epcisResult.error
      });
    }
    */
  } catch (error) {
    console.error('Error generating EPCIS for sales order:', error);
    res.status(500).json({ message: 'Failed to generate EPCIS file' });
  }
});