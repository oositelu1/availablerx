import { Router, Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import { insertEpcisPoAssociationSchema } from '@shared/schema';
import { z } from 'zod';
import { TypedRequestBody } from './types';

// EPCIS-PO Association routes
export const associationRouter = Router();

// Check if user is authenticated
function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Create a new association between EPCIS file and Purchase Order
associationRouter.post(
  '/',
  isAuthenticated,
  async (req: TypedRequestBody<z.infer<typeof insertEpcisPoAssociationSchema>>, res: Response) => {
    try {
      // Validate the request body
      const validation = insertEpcisPoAssociationSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: 'Invalid association data', details: validation.error });
      }

      // Add current user as creator
      const associationData = {
        ...validation.data,
        createdBy: req.user!.id
      };

      // Verify the file exists
      const file = await storage.getFile(associationData.fileId);
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Verify the purchase order exists
      const po = await storage.getPurchaseOrder(associationData.poId);
      if (!po) {
        return res.status(404).json({ error: 'Purchase order not found' });
      }

      // Create the association
      const association = await storage.createEpcisPoAssociation(associationData);

      // Create audit log entry
      await storage.createAuditLog({
        action: 'CREATE_EPCIS_PO_ASSOCIATION',
        entityType: 'epcis_po_association',
        entityId: association.id,
        userId: req.user!.id,
        details: { 
          fileId: association.fileId,
          poId: association.poId,
          method: association.associationMethod
        }
      });

      res.status(201).json(association);
    } catch (error) {
      console.error('Error creating EPCIS-PO association:', error);
      res.status(500).json({ error: 'Error creating EPCIS-PO association' });
    }
  }
);

// Get an association by ID
associationRouter.get('/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid association ID' });
    }

    const association = await storage.getEpcisPoAssociation(id);
    if (!association) {
      return res.status(404).json({ error: 'Association not found' });
    }

    res.json(association);
  } catch (error) {
    console.error('Error retrieving association:', error);
    res.status(500).json({ error: 'Error retrieving association' });
  }
});

// Update an association
associationRouter.patch('/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid association ID' });
    }

    // Get the existing association
    const existingAssociation = await storage.getEpcisPoAssociation(id);
    if (!existingAssociation) {
      return res.status(404).json({ error: 'Association not found' });
    }

    // Validate the update data (partial validation)
    const updateSchema = insertEpcisPoAssociationSchema.partial();
    const validation = updateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid update data', details: validation.error });
    }

    // Update the association
    const updatedAssociation = await storage.updateEpcisPoAssociation(id, validation.data);

    // Create audit log entry
    await storage.createAuditLog({
      action: 'UPDATE_EPCIS_PO_ASSOCIATION',
      entityType: 'epcis_po_association',
      entityId: id,
      userId: req.user!.id,
      details: { updates: req.body }
    });

    res.json(updatedAssociation);
  } catch (error) {
    console.error('Error updating association:', error);
    res.status(500).json({ error: 'Error updating association' });
  }
});

// Get all associations for a file
associationRouter.get('/file/:fileId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const fileId = parseInt(req.params.fileId);
    if (isNaN(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    // Verify the file exists
    const file = await storage.getFile(fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const associations = await storage.listEpcisPoAssociationsForFile(fileId);
    res.json(associations);
  } catch (error) {
    console.error('Error retrieving file associations:', error);
    res.status(500).json({ error: 'Error retrieving file associations' });
  }
});

// Get all associations for a purchase order
associationRouter.get('/po/:poId', isAuthenticated, async (req: Request, res: Response) => {
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

    const associations = await storage.listEpcisPoAssociationsForPO(poId);
    res.json(associations);
  } catch (error) {
    console.error('Error retrieving purchase order associations:', error);
    res.status(500).json({ error: 'Error retrieving purchase order associations' });
  }
});