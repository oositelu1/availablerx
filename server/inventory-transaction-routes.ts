import { Router } from 'express';
import { z } from 'zod';
import { storage } from './storage';
import { insertInventoryTransactionSchema } from '@shared/schema';

export const inventoryTransactionRouter = Router();

// Authentication check is done in each route handler

// Get transactions for an inventory item
inventoryTransactionRouter.get('/inventory/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  
  try {
    const inventoryId = parseInt(req.params.id);
    if (isNaN(inventoryId)) {
      return res.status(400).json({ message: 'Invalid inventory ID' });
    }

    // Check if the inventory item exists
    const item = await storage.getInventoryItem(inventoryId);
    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    const transactions = await storage.listInventoryTransactions(inventoryId);
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching inventory transactions:', error);
    res.status(500).json({ message: 'Failed to fetch inventory transactions' });
  }
});

// Get a specific transaction by ID
inventoryTransactionRouter.get('/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid transaction ID' });
    }

    const transaction = await storage.getInventoryTransaction(id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.json(transaction);
  } catch (error) {
    console.error('Error fetching inventory transaction:', error);
    res.status(500).json({ message: 'Failed to fetch inventory transaction' });
  }
});

// Create a new transaction (manual transaction)
inventoryTransactionRouter.post('/', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  
  try {
    const validatedData = insertInventoryTransactionSchema.parse({
      ...req.body,
      createdBy: req.user.id
    });

    // Check if the inventory item exists
    const item = await storage.getInventoryItem(validatedData.inventoryId);
    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    // Create the transaction
    const transaction = await storage.createInventoryTransaction(validatedData);

    // For certain transaction types, we should also update the inventory item status
    if (validatedData.transactionType === 'status_change' && validatedData.toStatus) {
      await storage.updateInventoryItem(validatedData.inventoryId, {
        status: validatedData.toStatus,
        lastMovementDate: new Date()
      });
    }

    // For transfer transactions, update the location
    if (validatedData.transactionType === 'transfer' && validatedData.toLocationId) {
      await storage.updateInventoryItem(validatedData.inventoryId, {
        locationId: validatedData.toLocationId,
        lastMovementDate: new Date()
      });
    }

    res.status(201).json(transaction);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: error.errors 
      });
    }
    console.error('Error creating inventory transaction:', error);
    res.status(500).json({ message: 'Failed to create inventory transaction' });
  }
});

// Batch operations - move multiple inventory items to a different status
inventoryTransactionRouter.post('/batch/status-change', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  
  try {
    const { inventoryIds, fromStatus, toStatus, notes } = req.body;

    if (!Array.isArray(inventoryIds) || inventoryIds.length === 0) {
      return res.status(400).json({ message: 'Invalid or empty inventory IDs array' });
    }

    if (!toStatus) {
      return res.status(400).json({ message: 'Target status is required' });
    }

    const results = {
      success: [] as number[],
      failed: [] as { id: number, reason: string }[]
    };

    // Process each inventory item
    for (const id of inventoryIds) {
      try {
        const item = await storage.getInventoryItem(id);
        if (!item) {
          results.failed.push({ id, reason: 'Inventory item not found' });
          continue;
        }

        // Skip if fromStatus was provided and doesn't match
        if (fromStatus && item.status !== fromStatus) {
          results.failed.push({ id, reason: `Current status (${item.status}) doesn't match required status (${fromStatus})` });
          continue;
        }

        // Create a transaction record
        await storage.createInventoryTransaction({
          inventoryId: id,
          transactionType: 'status_change',
          fromStatus: item.status,
          toStatus,
          quantity: item.quantity,
          fromLocationId: item.locationId,
          toLocationId: item.locationId,
          createdBy: req.user.id,
          notes: notes || `Batch status change from ${item.status} to ${toStatus}`
        });

        // Update the inventory item status
        await storage.updateInventoryItem(id, {
          status: toStatus,
          lastMovementDate: new Date()
        });

        results.success.push(id);
      } catch (error) {
        console.error(`Error processing inventory item ${id}:`, error);
        results.failed.push({ id, reason: 'Internal processing error' });
      }
    }

    res.json({
      message: `Processed ${results.success.length + results.failed.length} inventory items`,
      results
    });
  } catch (error) {
    console.error('Error in batch status change:', error);
    res.status(500).json({ message: 'Failed to process batch status change' });
  }
});

// Batch operations - transfer multiple inventory items to a different location
inventoryTransactionRouter.post('/batch/transfer', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  
  try {
    const { inventoryIds, toLocationId, notes } = req.body;

    if (!Array.isArray(inventoryIds) || inventoryIds.length === 0) {
      return res.status(400).json({ message: 'Invalid or empty inventory IDs array' });
    }

    if (!toLocationId) {
      return res.status(400).json({ message: 'Target location ID is required' });
    }

    const results = {
      success: [] as number[],
      failed: [] as { id: number, reason: string }[]
    };

    // Process each inventory item
    for (const id of inventoryIds) {
      try {
        const item = await storage.getInventoryItem(id);
        if (!item) {
          results.failed.push({ id, reason: 'Inventory item not found' });
          continue;
        }

        // Create a transaction record
        await storage.createInventoryTransaction({
          inventoryId: id,
          transactionType: 'transfer',
          fromStatus: item.status,
          toStatus: item.status,
          quantity: item.quantity,
          fromLocationId: item.locationId,
          toLocationId,
          createdBy: req.user.id,
          notes: notes || `Batch transfer from location ${item.locationId || 'none'} to ${toLocationId}`
        });

        // Update the inventory item location
        await storage.updateInventoryItem(id, {
          locationId: toLocationId,
          lastMovementDate: new Date()
        });

        results.success.push(id);
      } catch (error) {
        console.error(`Error processing inventory item ${id}:`, error);
        results.failed.push({ id, reason: 'Internal processing error' });
      }
    }

    res.json({
      message: `Processed ${results.success.length + results.failed.length} inventory items`,
      results
    });
  } catch (error) {
    console.error('Error in batch transfer:', error);
    res.status(500).json({ message: 'Failed to process batch transfer' });
  }
});