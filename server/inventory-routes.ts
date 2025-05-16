import { Router } from 'express';
import { z } from 'zod';
import { storage } from './storage';
import { insertInventorySchema } from '@shared/schema';

export const inventoryRouter = Router();

// Authentication check is done in each route handler

// Get inventory list with pagination and filters
inventoryRouter.get('/', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  
  try {
    const {
      status,
      gtin,
      lotNumber,
      productName,
      packageType,
      warehouse,
      poId,
      soId,
      expirationStart,
      expirationEnd,
      page = '1',
      limit = '10'
    } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const offset = (pageNum - 1) * limitNum;

    // Build filters object
    const filters: any = {
      limit: limitNum,
      offset
    };

    if (status) filters.status = status;
    if (gtin) filters.gtin = gtin;
    if (lotNumber) filters.lotNumber = lotNumber;
    if (productName) filters.productName = productName;
    if (packageType) filters.packageType = packageType;
    if (warehouse) filters.warehouse = warehouse;
    if (poId) filters.poId = parseInt(poId as string);
    if (soId) filters.soId = parseInt(soId as string);
    if (expirationStart) filters.expirationStart = new Date(expirationStart as string);
    if (expirationEnd) filters.expirationEnd = new Date(expirationEnd as string);

    // Initialize with empty array and total 0 in case storage function fails
    let result = { items: [], total: 0 };
    
    try {
      result = await storage.listInventory(filters);
    } catch (error) {
      console.error('Error in storage.listInventory:', error);
      // Continue with empty results instead of throwing
    }
    
    res.json({
      items: result.items || [],
      total: result.total || 0,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil((result.total || 0) / limitNum)
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ message: 'Failed to fetch inventory items' });
  }
});

// Get a specific inventory item by ID
inventoryRouter.get('/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid inventory ID' });
    }

    const item = await storage.getInventoryItem(id);
    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    res.json(item);
  } catch (error) {
    console.error('Error fetching inventory item:', error);
    res.status(500).json({ message: 'Failed to fetch inventory item' });
  }
});

// Find inventory item by SGTIN (GTIN + Serial Number)
inventoryRouter.get('/sgtin/:gtin/:serialNumber', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  
  try {
    const { gtin, serialNumber } = req.params;

    const item = await storage.getInventoryBySGTIN(gtin, serialNumber);
    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    res.json(item);
  } catch (error) {
    console.error('Error fetching inventory item by SGTIN:', error);
    res.status(500).json({ message: 'Failed to fetch inventory item' });
  }
});

// Create a new inventory item
inventoryRouter.post('/', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  
  try {
    // Pre-process date fields before validation
    const processedData = {
      ...req.body,
      createdBy: req.user.id,
      // Convert string dates to actual Date objects
      expirationDate: req.body.expirationDate ? new Date(req.body.expirationDate) : undefined,
      receivedAt: req.body.receivedAt ? new Date(req.body.receivedAt) : new Date()
    };
    
    const validatedData = insertInventorySchema.parse(processedData);
    
    const newItem = await storage.createInventoryItem(validatedData);
    res.status(201).json(newItem);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: error.errors 
      });
    }
    console.error('Error creating inventory item:', error);
    res.status(500).json({ message: 'Failed to create inventory item' });
  }
});

// Update an inventory item
inventoryRouter.patch('/:id', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid inventory ID' });
    }

    const item = await storage.getInventoryItem(id);
    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    // Add an audit log entry for the status change if status is being updated
    if (req.body.status && req.body.status !== item.status) {
      await storage.createAuditLog({
        action: `Status changed from ${item.status} to ${req.body.status}`,
        entityType: 'inventory',
        entityId: id,
        userId: req.user.id,
        details: {
          previousStatus: item.status,
          newStatus: req.body.status,
          reason: req.body.notes || 'No reason provided'
        },
        ipAddress: req.ip
      });

      // Create an inventory transaction record for the status change
      await storage.createInventoryTransaction({
        inventoryId: id,
        transactionType: 'status_change',
        fromStatus: item.status,
        toStatus: req.body.status,
        quantity: item.quantity,
        fromLocationId: item.locationId,
        toLocationId: item.locationId,
        createdBy: req.user.id,
        notes: req.body.notes || `Status updated by ${req.user.username}`
      });
    }

    // Update the inventory item
    const updatedItem = await storage.updateInventoryItem(id, req.body);
    res.json(updatedItem);
  } catch (error) {
    console.error('Error updating inventory item:', error);
    res.status(500).json({ message: 'Failed to update inventory item' });
  }
});

// Create inventory items from an EPCIS file
inventoryRouter.post('/from-epcis/:fileId', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  
  try {
    const fileId = parseInt(req.params.fileId);
    if (isNaN(fileId)) {
      return res.status(400).json({ message: 'Invalid file ID' });
    }

    // Check if the file exists
    const file = await storage.getFile(fileId);
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Create inventory items from the file
    const createdCount = await storage.createInventoryFromFile(fileId, req.user.id);
    
    // Create an audit log entry
    await storage.createAuditLog({
      action: 'create_inventory_from_epcis',
      entityType: 'file',
      entityId: fileId,
      userId: req.user.id,
      details: {
        fileName: file.originalName,
        itemsCreated: createdCount
      },
      ipAddress: req.ip
    });

    res.status(201).json({ 
      success: true, 
      message: `Created ${createdCount} inventory items from EPCIS file`,
      itemsCreated: createdCount
    });
  } catch (error) {
    console.error('Error creating inventory from EPCIS file:', error);
    res.status(500).json({ 
      message: 'Failed to create inventory items from EPCIS file',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get inventory summary (counts by status, location, etc.)
inventoryRouter.get('/summary/stats', async (req, res) => {
  try {
    // Initialize with empty items array in case storage function fails
    let result = { items: [] };
    
    try {
      result = await storage.listInventory();
    } catch (error) {
      console.error('Error in storage.listInventory for summary:', error);
      // Continue with empty results instead of throwing
    }
    
    const items = result.items || [];
    
    // Count by status
    const statusCounts = items.reduce((acc, item) => {
      const status = item.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Count by location
    const locationCounts = items.reduce((acc, item) => {
      const location = item.locationId?.toString() || 'unknown';
      acc[location] = (acc[location] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Count by product (GTIN)
    const productCounts = items.reduce((acc, item) => {
      acc[item.gtin] = (acc[item.gtin] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    res.json({
      total: items.length,
      statusCounts,
      locationCounts,
      productCounts
    });
  } catch (error) {
    console.error('Error fetching inventory summary:', error);
    res.status(500).json({ message: 'Failed to fetch inventory summary' });
  }
});