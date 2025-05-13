import { Router, Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import { insertPurchaseOrderSchema, purchaseOrders } from '@shared/schema';
import { z } from 'zod';
import { TypedRequestBody } from './types';
import { isAdmin } from './auth';

// Purchase Order routes
export const poRouter = Router();

// Check if user is authenticated
function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Create a new purchase order
poRouter.post(
  '/',
  isAuthenticated,
  async (req: TypedRequestBody<z.infer<typeof insertPurchaseOrderSchema>>, res: Response) => {
    try {
      // Validate the request body
      const validation = insertPurchaseOrderSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: 'Invalid purchase order data', details: validation.error });
      }

      // Add current user as creator
      const poData = {
        ...validation.data,
        createdBy: req.user!.id
      };

      // Create the purchase order
      const purchaseOrder = await storage.createPurchaseOrder(poData);

      // Create audit log entry
      await storage.createAuditLog({
        action: 'CREATE_PURCHASE_ORDER',
        entityType: 'po',
        entityId: purchaseOrder.id,
        userId: req.user!.id,
        details: { poNumber: purchaseOrder.poNumber }
      });

      res.status(201).json(purchaseOrder);
    } catch (error: any) {
      console.error('Error creating purchase order:', error);
      
      // Handle duplicate PO number
      if (error.code === '23505') { // PostgreSQL unique violation code
        return res.status(409).json({ error: 'Purchase order number already exists' });
      }
      
      res.status(500).json({ error: 'Error creating purchase order' });
    }
  }
);

// Get purchase order by ID
poRouter.get('/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid purchase order ID' });
    }

    const purchaseOrder = await storage.getPurchaseOrder(id);
    if (!purchaseOrder) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    res.json(purchaseOrder);
  } catch (error) {
    console.error('Error retrieving purchase order:', error);
    res.status(500).json({ error: 'Error retrieving purchase order' });
  }
});

// Update purchase order
poRouter.patch('/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid purchase order ID' });
    }

    // Get the existing purchase order
    const existingPO = await storage.getPurchaseOrder(id);
    if (!existingPO) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    // Ensure user can update this PO (admin or creator)
    if (req.user!.role !== 'administrator' && existingPO.createdBy !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorized to update this purchase order' });
    }

    // Validate the update data (partial validation)
    const updateSchema = insertPurchaseOrderSchema.partial();
    const validation = updateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid update data', details: validation.error });
    }

    // Update the purchase order
    const updatedPO = await storage.updatePurchaseOrder(id, validation.data);

    // Create audit log entry
    await storage.createAuditLog({
      action: 'UPDATE_PURCHASE_ORDER',
      entityType: 'po',
      entityId: id,
      userId: req.user!.id,
      details: { updates: req.body }
    });

    res.json(updatedPO);
  } catch (error) {
    console.error('Error updating purchase order:', error);
    res.status(500).json({ error: 'Error updating purchase order' });
  }
});

// List purchase orders with filtering
poRouter.get('/', isAuthenticated, async (req: Request, res: Response) => {
  try {
    // Parse query parameters
    const status = req.query.status as string | undefined;
    const supplierGln = req.query.supplierGln as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    
    // Date range filtering
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    
    if (req.query.startDate) {
      startDate = new Date(req.query.startDate as string);
      if (isNaN(startDate.getTime())) {
        return res.status(400).json({ error: 'Invalid start date format' });
      }
    }
    
    if (req.query.endDate) {
      endDate = new Date(req.query.endDate as string);
      if (isNaN(endDate.getTime())) {
        return res.status(400).json({ error: 'Invalid end date format' });
      }
    }

    // Get filtered purchase orders
    const result = await storage.listPurchaseOrders({
      status,
      supplierGln,
      startDate,
      endDate,
      limit,
      offset
    });

    res.json(result);
  } catch (error) {
    console.error('Error listing purchase orders:', error);
    res.status(500).json({ error: 'Error listing purchase orders' });
  }
});

// Get purchase order by PO number
poRouter.get('/by-number/:poNumber', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const poNumber = req.params.poNumber;
    
    const purchaseOrder = await storage.getPurchaseOrderByPoNumber(poNumber);
    if (!purchaseOrder) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    res.json(purchaseOrder);
  } catch (error) {
    console.error('Error retrieving purchase order by number:', error);
    res.status(500).json({ error: 'Error retrieving purchase order' });
  }
});

// Get EPCIS files associated with a purchase order
poRouter.get('/:id/files', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid purchase order ID' });
    }

    // Check if PO exists
    const purchaseOrder = await storage.getPurchaseOrder(id);
    if (!purchaseOrder) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    // Get associations with files
    const associations = await storage.listEpcisPoAssociationsForPO(id);
    
    res.json(associations);
  } catch (error) {
    console.error('Error retrieving purchase order files:', error);
    res.status(500).json({ error: 'Error retrieving purchase order files' });
  }
});

// Get product items for a purchase order
poRouter.get('/:id/products', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid purchase order ID' });
    }

    // Check if PO exists
    const purchaseOrder = await storage.getPurchaseOrder(id);
    if (!purchaseOrder) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    // Get product items
    const productItems = await storage.listProductItemsForPO(id);
    
    res.json(productItems);
  } catch (error) {
    console.error('Error retrieving purchase order products:', error);
    res.status(500).json({ error: 'Error retrieving purchase order products' });
  }
});

// Delete purchase order (admin only)
poRouter.delete('/:id', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid purchase order ID' });
    }

    // We don't actually delete the PO, just update its status to 'cancelled'
    const updatedPO = await storage.updatePurchaseOrder(id, { status: 'cancelled' });
    if (!updatedPO) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    // Create audit log entry
    await storage.createAuditLog({
      action: 'CANCEL_PURCHASE_ORDER',
      entityType: 'po',
      entityId: id,
      userId: req.user!.id,
      details: { status: 'cancelled' }
    });

    res.json({ success: true, message: 'Purchase order cancelled' });
  } catch (error) {
    console.error('Error cancelling purchase order:', error);
    res.status(500).json({ error: 'Error cancelling purchase order' });
  }
});