import { Router, Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import { insertValidationSessionSchema, insertScannedItemSchema } from '@shared/schema';
import { z } from 'zod';
import { TypedRequestBody } from './types';

// Validation and Scanning routes
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
  '/sessions',
  isAuthenticated,
  async (req: TypedRequestBody<z.infer<typeof insertValidationSessionSchema>>, res: Response) => {
    try {
      // Validate the request body
      const validation = insertValidationSessionSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: 'Invalid validation session data', details: validation.error });
      }

      // Verify related entities exist
      if (validation.data.poId) {
        const po = await storage.getPurchaseOrder(validation.data.poId);
        if (!po) {
          return res.status(404).json({ error: 'Purchase order not found' });
        }
      }

      if (validation.data.fileId) {
        const file = await storage.getFile(validation.data.fileId);
        if (!file) {
          return res.status(404).json({ error: 'File not found' });
        }
      }

      // Add current user as starter
      const sessionData = {
        ...validation.data,
        startedBy: req.user!.id
      };

      // Create the validation session
      const session = await storage.createValidationSession(sessionData);

      // Create audit log entry
      await storage.createAuditLog({
        action: 'CREATE_VALIDATION_SESSION',
        entityType: 'validation_session',
        entityId: session.id,
        userId: req.user!.id,
        details: { 
          poId: session.poId,
          fileId: session.fileId
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
validationRouter.get('/sessions/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid session ID' });
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

// Update a validation session (e.g., mark as complete)
validationRouter.patch('/sessions/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    // Get the existing session
    const existingSession = await storage.getValidationSession(id);
    if (!existingSession) {
      return res.status(404).json({ error: 'Validation session not found' });
    }

    // Ensure user can update this session (must be the starter or an admin)
    if (req.user!.role !== 'administrator' && existingSession.startedBy !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorized to update this session' });
    }

    // Validate the update data (partial validation)
    const updateSchema = insertValidationSessionSchema.partial();
    const validation = updateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid update data', details: validation.error });
    }

    // Special handling for session completion
    let updates = validation.data;
    if (updates.status === 'completed') {
      // Need to manually add completedAt since it's not in the schema
      await storage.updateValidationSession(id, {
        ...updates,
        completedAt: new Date()
      });
      const updatedSession = await storage.getValidationSession(id);
      return res.json(updatedSession);
    }

    // Update the session
    const updatedSession = await storage.updateValidationSession(id, updates);

    // Create audit log entry
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

// Get validation sessions for a purchase order
validationRouter.get('/sessions/po/:poId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const poId = parseInt(req.params.poId);
    if (isNaN(poId)) {
      return res.status(400).json({ error: 'Invalid purchase order ID' });
    }

    // Verify the purchase order exists
    const po = await storage.getPurchaseOrder(poId);
    if (!po) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    const sessions = await storage.listValidationSessionsForPO(poId);
    res.json(sessions);
  } catch (error) {
    console.error('Error retrieving purchase order validation sessions:', error);
    res.status(500).json({ error: 'Error retrieving validation sessions' });
  }
});

// Record a scanned item
validationRouter.post(
  '/scan',
  isAuthenticated,
  async (req: TypedRequestBody<z.infer<typeof insertScannedItemSchema>>, res: Response) => {
    try {
      // Validate the request body
      const validation = insertScannedItemSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: 'Invalid scanned item data', details: validation.error });
      }

      // Add current user as scanner
      const scanData = {
        ...validation.data,
        scannedBy: req.user!.id
      };

      // Check if PO exists if provided
      if (scanData.poId) {
        const po = await storage.getPurchaseOrder(scanData.poId);
        if (!po) {
          return res.status(404).json({ error: 'Purchase order not found' });
        }
      }

      // Try to find a matching product item if not already matched
      if (!scanData.productItemId) {
        const matchingItem = await storage.findProductItemBySGTIN(scanData.gtin, scanData.serialNumber);
        
        if (matchingItem) {
          scanData.productItemId = matchingItem.id;
          scanData.matchResult = 'matched';
        } else {
          scanData.matchResult = 'not_found';
        }
      }

      // Record the scan
      const scannedItem = await storage.createScannedItem(scanData);

      // Create audit log entry
      await storage.createAuditLog({
        action: 'RECORD_SCAN',
        entityType: 'scanned_item',
        entityId: scannedItem.id,
        userId: req.user!.id,
        details: { 
          gtin: scannedItem.gtin,
          serialNumber: scannedItem.serialNumber,
          matchResult: scannedItem.matchResult
        }
      });

      // Create a custom type extending InsertScannedItem to include sessionId
      interface ScannedItemWithSession extends z.infer<typeof insertScannedItemSchema> {
        sessionId?: number;
      }

      // If this is part of a validation session, update the counts
      const bodyWithSession = req.body as ScannedItemWithSession;
      if (bodyWithSession.sessionId) {
        const sessionId = parseInt(String(bodyWithSession.sessionId));
        if (!isNaN(sessionId)) {
          const session = await storage.getValidationSession(sessionId);
          if (session) {
            const totalScanned = (session.totalScanned || 0) + 1;
            const totalMatched = scannedItem.matchResult === 'matched' 
              ? (session.totalMatched || 0) + 1 
              : (session.totalMatched || 0);
            const totalMismatched = scannedItem.matchResult === 'mismatch' 
              ? (session.totalMismatched || 0) + 1 
              : (session.totalMismatched || 0);
            
            await storage.updateValidationSession(sessionId, {
              totalScanned,
              totalMatched,
              totalMismatched
            });
          }
        }
      }

      res.status(201).json(scannedItem);
    } catch (error) {
      console.error('Error recording scanned item:', error);
      res.status(500).json({ error: 'Error recording scanned item' });
    }
  }
);

// Get scanned items for a validation session
validationRouter.get('/scans/session/:sessionId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    if (isNaN(sessionId)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    // Verify the session exists
    const session = await storage.getValidationSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Validation session not found' });
    }

    const scannedItems = await storage.listScannedItemsForSession(sessionId);
    res.json(scannedItems);
  } catch (error) {
    console.error('Error retrieving session scanned items:', error);
    res.status(500).json({ error: 'Error retrieving scanned items' });
  }
});

// Get a scanned item by ID
validationRouter.get('/scans/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid scanned item ID' });
    }

    const scannedItem = await storage.getScannedItem(id);
    if (!scannedItem) {
      return res.status(404).json({ error: 'Scanned item not found' });
    }

    res.json(scannedItem);
  } catch (error) {
    console.error('Error retrieving scanned item:', error);
    res.status(500).json({ error: 'Error retrieving scanned item' });
  }
});