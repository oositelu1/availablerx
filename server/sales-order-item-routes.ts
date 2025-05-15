import { Router } from 'express';
import { z } from 'zod';
import { storage } from './storage';
import { insertSalesOrderItemSchema } from '@shared/schema';

export const salesOrderItemRouter = Router();

// Authentication check is done in each route handler

// Root handler for the base path
salesOrderItemRouter.get('/', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  
  return res.status(400).json({ message: 'Missing sales order ID. Use /order/:soId to get items for a specific sales order.' });
});

// Get items for a specific sales order
salesOrderItemRouter.get('/order/:soId', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  
  try {
    const soId = parseInt(req.params.soId);
    if (isNaN(soId)) {
      return res.status(400).json({ message: 'Invalid sales order ID' });
    }
    
    // Verify the SO exists
    const order = await storage.getSalesOrder(soId);
    if (!order) {
      return res.status(404).json({ message: 'Sales order not found' });
    }
    
    const items = await storage.listSalesOrderItems(soId);
    res.json(items);
  } catch (error) {
    console.error('Error fetching sales order items:', error);
    res.status(500).json({ message: 'Failed to fetch sales order items' });
  }
});

// Get a specific item by ID
salesOrderItemRouter.get('/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid sales order item ID' });
    }
    
    const item = await storage.getSalesOrderItem(id);
    if (!item) {
      return res.status(404).json({ message: 'Sales order item not found' });
    }
    
    res.json(item);
  } catch (error) {
    console.error('Error fetching sales order item:', error);
    res.status(500).json({ message: 'Failed to fetch sales order item' });
  }
});

// Create a new sales order item
salesOrderItemRouter.post('/', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  
  try {
    const validatedData = insertSalesOrderItemSchema.parse(req.body);
    
    // Verify the SO exists
    const order = await storage.getSalesOrder(validatedData.salesOrderId);
    if (!order) {
      return res.status(404).json({ message: 'Sales order not found' });
    }
    
    // Check if the order is in a state that allows adding items
    if (order.status !== 'draft' && order.status !== 'approved') {
      return res.status(400).json({ 
        message: `Cannot add items to an order in '${order.status}' status` 
      });
    }
    
    // Check if the line number already exists
    const existingItems = await storage.listSalesOrderItems(validatedData.salesOrderId);
    const lineNumberExists = existingItems.some(item => item.lineNumber === validatedData.lineNumber);
    
    if (lineNumberExists) {
      return res.status(400).json({ 
        message: `Line number ${validatedData.lineNumber} already exists on this order` 
      });
    }
    
    const item = await storage.createSalesOrderItem(validatedData);
    
    // Update the order's total items count
    await storage.updateSalesOrder(validatedData.salesOrderId, {
      totalItems: (order.totalItems || 0) + (validatedData.quantity || 1),
      lastUpdatedAt: new Date(),
      lastUpdatedBy: req.user.id
    });
    
    res.status(201).json(item);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: error.errors 
      });
    }
    console.error('Error creating sales order item:', error);
    res.status(500).json({ message: 'Failed to create sales order item' });
  }
});

// Update a sales order item
salesOrderItemRouter.patch('/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid sales order item ID' });
    }
    
    const item = await storage.getSalesOrderItem(id);
    if (!item) {
      return res.status(404).json({ message: 'Sales order item not found' });
    }
    
    // Verify the SO exists
    const order = await storage.getSalesOrder(item.salesOrderId);
    if (!order) {
      return res.status(404).json({ message: 'Sales order not found' });
    }
    
    // Check if the order is in a state that allows updating items
    if (order.status !== 'draft' && order.status !== 'approved') {
      return res.status(400).json({ 
        message: `Cannot update items on an order in '${order.status}' status` 
      });
    }
    
    // If line number is being changed, check for duplicates
    if (req.body.lineNumber && req.body.lineNumber !== item.lineNumber) {
      const existingItems = await storage.listSalesOrderItems(item.salesOrderId);
      const lineNumberExists = existingItems.some(i => 
        i.id !== id && i.lineNumber === req.body.lineNumber
      );
      
      if (lineNumberExists) {
        return res.status(400).json({ 
          message: `Line number ${req.body.lineNumber} already exists on this order` 
        });
      }
    }
    
    const updates = { ...req.body };
    const updatedItem = await storage.updateSalesOrderItem(id, updates);
    
    // If quantity was updated, adjust the order's total items count
    if (req.body.quantity !== undefined && req.body.quantity !== item.quantity) {
      const quantityDiff = req.body.quantity - item.quantity;
      await storage.updateSalesOrder(item.salesOrderId, {
        totalItems: (order.totalItems || 0) + quantityDiff,
        lastUpdatedAt: new Date(),
        lastUpdatedBy: req.user.id
      });
    }
    
    res.json(updatedItem);
  } catch (error) {
    console.error('Error updating sales order item:', error);
    res.status(500).json({ message: 'Failed to update sales order item' });
  }
});

// Delete a sales order item
salesOrderItemRouter.delete('/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid sales order item ID' });
    }
    
    const item = await storage.getSalesOrderItem(id);
    if (!item) {
      return res.status(404).json({ message: 'Sales order item not found' });
    }
    
    // Verify the SO exists
    const order = await storage.getSalesOrder(item.salesOrderId);
    if (!order) {
      return res.status(404).json({ message: 'Sales order not found' });
    }
    
    // Check if the order is in a state that allows deleting items
    if (order.status !== 'draft' && order.status !== 'approved') {
      return res.status(400).json({ 
        message: `Cannot delete items from an order in '${order.status}' status` 
      });
    }
    
    // If there are allocated inventory items, release them
    if (item.serialNumbersAllocated > 0) {
      // We'd need to implement this in storage
      await storage.releaseAllocatedInventoryForSalesOrderItem(id);
    }
    
    const success = await storage.deleteSalesOrderItem(id);
    
    if (success) {
      // Update the order's total items count
      await storage.updateSalesOrder(item.salesOrderId, {
        totalItems: Math.max(0, (order.totalItems || 0) - (item.quantity || 0)),
        lastUpdatedAt: new Date(),
        lastUpdatedBy: req.user.id
      });
      
      res.status(204).send();
    } else {
      res.status(500).json({ message: 'Failed to delete sales order item' });
    }
  } catch (error) {
    console.error('Error deleting sales order item:', error);
    res.status(500).json({ message: 'Failed to delete sales order item' });
  }
});

// Allocate inventory for a specific item
salesOrderItemRouter.post('/:id/allocate', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid sales order item ID' });
    }
    
    const item = await storage.getSalesOrderItem(id);
    if (!item) {
      return res.status(404).json({ message: 'Sales order item not found' });
    }
    
    // Verify the SO exists and is in valid state
    const order = await storage.getSalesOrder(item.salesOrderId);
    if (!order) {
      return res.status(404).json({ message: 'Sales order not found' });
    }
    
    if (order.status !== 'draft' && order.status !== 'approved' && order.status !== 'picking') {
      return res.status(400).json({ 
        message: `Cannot allocate inventory for an order in '${order.status}' status` 
      });
    }
    
    // We'll need to implement allocateInventoryForSalesOrderItem in storage
    const success = await storage.allocateInventoryForSalesOrderItem(id);
    
    if (success) {
      res.json({
        success: true,
        message: 'Inventory allocated successfully',
        itemId: id
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to allocate inventory',
        itemId: id
      });
    }
  } catch (error) {
    console.error('Error allocating inventory for sales order item:', error);
    res.status(500).json({ message: 'Failed to allocate inventory' });
  }
});

// Release allocated inventory for a specific item
salesOrderItemRouter.post('/:id/release', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid sales order item ID' });
    }
    
    const item = await storage.getSalesOrderItem(id);
    if (!item) {
      return res.status(404).json({ message: 'Sales order item not found' });
    }
    
    // Verify the SO exists
    const order = await storage.getSalesOrder(item.salesOrderId);
    if (!order) {
      return res.status(404).json({ message: 'Sales order not found' });
    }
    
    // Only makes sense to release if in allocated or picking status
    if (order.status !== 'allocated' && order.status !== 'picking') {
      return res.status(400).json({ 
        message: `Cannot release inventory for an order in '${order.status}' status` 
      });
    }
    
    // We'll need to implement releaseAllocatedInventoryForSalesOrderItem in storage
    const success = await storage.releaseAllocatedInventoryForSalesOrderItem(id);
    
    if (success) {
      res.json({
        success: true,
        message: 'Allocated inventory released successfully',
        itemId: id
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to release allocated inventory',
        itemId: id
      });
    }
  } catch (error) {
    console.error('Error releasing allocated inventory:', error);
    res.status(500).json({ message: 'Failed to release allocated inventory' });
  }
});