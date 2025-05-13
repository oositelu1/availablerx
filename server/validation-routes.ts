import { Router, Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import { insertValidationSessionSchema, insertScannedItemSchema } from '@shared/schema';
import { TypedRequestBody } from './types';
import { z } from 'zod';

// Validation Session routes
export const validationRouter = Router();

// Check if user is authenticated
function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Create a new validation session
validationRouter.post(
  '/',
  isAuthenticated,
  async (req: TypedRequestBody<z.infer<typeof insertValidationSessionSchema>>, res: Response) => {
    try {
      // Validate the request body
      const validation = insertValidationSessionSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: 'Invalid validation session data', details: validation.error });
      }
      
      // Verify purchase order exists
      const po = await storage.getPurchaseOrder(validation.data.poId);
      if (!po) {
        return res.status(404).json({ error: 'Purchase order not found' });
      }

      // Add creator info
      const sessionData = {
        ...validation.data,
        createdBy: req.user!.id,
        status: 'IN_PROGRESS' // Default status
      };

      // Create validation session
      const session = await storage.createValidationSession(sessionData);

      // Create audit log
      await storage.createAuditLog({
        action: 'CREATE_VALIDATION_SESSION',
        entityType: 'validation_session',
        entityId: session.id,
        userId: req.user!.id,
        details: { 
          poId: session.poId,
          location: session.location
        }
      });

      res.status(201).json(session);
    } catch (error) {
      console.error('Error creating validation session:', error);
      res.status(500).json({ error: 'Error creating validation session' });
    }
  }
);

// Get a validation session by ID
validationRouter.get('/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid validation session ID' });
    }

    const session = await storage.getValidationSession(id);
    if (!session) {
      return res.status(404).json({ error: 'Validation session not found' });
    }

    res.json(session);
  } catch (error) {
    console.error('Error retrieving validation session:', error);
    res.status(500).json({ error: 'Error retrieving validation session' });
  }
});

// Update a validation session (e.g., change status, add notes)
validationRouter.patch('/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid validation session ID' });
    }

    // Get existing session
    const existingSession = await storage.getValidationSession(id);
    if (!existingSession) {
      return res.status(404).json({ error: 'Validation session not found' });
    }

    // Validate update data
    const updateSchema = insertValidationSessionSchema.partial();
    const validation = updateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid update data', details: validation.error });
    }

    // If changing PO, verify it exists
    if (validation.data.poId && validation.data.poId !== existingSession.poId) {
      const po = await storage.getPurchaseOrder(validation.data.poId);
      if (!po) {
        return res.status(404).json({ error: 'Purchase order not found' });
      }
    }

    // Update session
    const updatedSession = await storage.updateValidationSession(id, validation.data);

    // Create audit log
    await storage.createAuditLog({
      action: 'UPDATE_VALIDATION_SESSION',
      entityType: 'validation_session',
      entityId: id,
      userId: req.user!.id,
      details: { updates: req.body }
    });

    res.json(updatedSession);
  } catch (error) {
    console.error('Error updating validation session:', error);
    res.status(500).json({ error: 'Error updating validation session' });
  }
});

// List all validation sessions for a purchase order
validationRouter.get('/po/:poId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const poId = parseInt(req.params.poId);
    if (isNaN(poId)) {
      return res.status(400).json({ error: 'Invalid purchase order ID' });
    }

    // Verify purchase order exists
    const po = await storage.getPurchaseOrder(poId);
    if (!po) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    const sessions = await storage.listValidationSessionsForPO(poId);
    res.json(sessions);
  } catch (error) {
    console.error('Error retrieving validation sessions:', error);
    res.status(500).json({ error: 'Error retrieving validation sessions' });
  }
});

// Add a scanned item to a validation session
validationRouter.post(
  '/:id/scan',
  isAuthenticated,
  async (req: TypedRequestBody<z.infer<typeof insertScannedItemSchema>>, res: Response) => {
    try {
      const sessionId = parseInt(req.params.id);
      if (isNaN(sessionId)) {
        return res.status(400).json({ error: 'Invalid validation session ID' });
      }

      // Verify session exists
      const session = await storage.getValidationSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Validation session not found' });
      }

      // Validate the request body
      const validation = insertScannedItemSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: 'Invalid scanned item data', details: validation.error });
      }

      // Add session ID and scanner info
      const scannedItemData = {
        ...validation.data,
        sessionId,
        scannedBy: req.user!.id
      };

      // Process the scanned item data
      // If GTIN and serialNumber are provided, try to find product item in database
      let matchStatus = 'UNKNOWN';
      let matchedItemId = null;

      if (scannedItemData.gtin && scannedItemData.serialNumber) {
        // Look up product item by SGTIN
        const productItem = await storage.findProductItemBySGTIN(
          scannedItemData.gtin,
          scannedItemData.serialNumber
        );

        if (productItem) {
          // Check if the product is associated with the session's PO
          if (productItem.poId === session.poId) {
            matchStatus = 'MATCH_PO';
          } else if (productItem.poId) {
            matchStatus = 'MATCH_DIFFERENT_PO';
          } else {
            matchStatus = 'MATCH_NO_PO';
          }
          
          matchedItemId = productItem.id;
        } else {
          matchStatus = 'NO_MATCH';
        }
      }

      // Update the scanned item data with match information
      const finalScannedItemData = {
        ...scannedItemData,
        matchStatus,
        matchedItemId
      };

      // Create the scanned item
      const scannedItem = await storage.createScannedItem(finalScannedItemData);

      // Create audit log
      await storage.createAuditLog({
        action: 'SCAN_ITEM',
        entityType: 'scanned_item',
        entityId: scannedItem.id,
        userId: req.user!.id,
        details: { 
          sessionId,
          barcode: scannedItem.rawData,
          matchStatus
        }
      });

      res.status(201).json({
        ...scannedItem,
        matchedItem: matchedItemId ? await storage.getProductItem(matchedItemId) : null
      });
    } catch (error) {
      console.error('Error adding scanned item:', error);
      res.status(500).json({ error: 'Error adding scanned item' });
    }
  }
);

// Get all scanned items for a validation session
validationRouter.get('/:id/scans', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const sessionId = parseInt(req.params.id);
    if (isNaN(sessionId)) {
      return res.status(400).json({ error: 'Invalid validation session ID' });
    }

    // Verify session exists
    const session = await storage.getValidationSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Validation session not found' });
    }

    const scannedItems = await storage.listScannedItemsForSession(sessionId);
    
    // Get detailed info for matched product items
    const enhancedItems = await Promise.all(scannedItems.map(async (item) => {
      if (item.matchedItemId) {
        const productItem = await storage.getProductItem(item.matchedItemId);
        return {
          ...item,
          matchedItem: productItem
        };
      }
      return {
        ...item,
        matchedItem: null
      };
    }));

    res.json(enhancedItems);
  } catch (error) {
    console.error('Error retrieving scanned items:', error);
    res.status(500).json({ error: 'Error retrieving scanned items' });
  }
});

// Update a scanned item
validationRouter.patch(
  '/scan/:id',
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid scanned item ID' });
      }

      // Verify scanned item exists
      const scannedItem = await storage.getScannedItem(id);
      if (!scannedItem) {
        return res.status(404).json({ error: 'Scanned item not found' });
      }

      // Validate update data
      const updateSchema = insertScannedItemSchema.partial();
      const validation = updateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: 'Invalid update data', details: validation.error });
      }

      // Update scanned item
      const updatedItem = await storage.updateScannedItem(id, validation.data);

      // Create audit log
      await storage.createAuditLog({
        action: 'UPDATE_SCANNED_ITEM',
        entityType: 'scanned_item',
        entityId: id,
        userId: req.user!.id,
        details: { updates: req.body }
      });

      res.json(updatedItem);
    } catch (error) {
      console.error('Error updating scanned item:', error);
      res.status(500).json({ error: 'Error updating scanned item' });
    }
  }
);