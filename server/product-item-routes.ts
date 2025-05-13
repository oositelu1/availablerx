import { Router, Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import { insertProductItemSchema } from '@shared/schema';
import { z } from 'zod';
import { TypedRequestBody } from './types';

// Product Item routes
export const productItemRouter = Router();

// Check if user is authenticated
function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Create a new product item (usually done automatically by the EPCIS file processor)
productItemRouter.post(
  '/',
  isAuthenticated,
  async (req: TypedRequestBody<z.infer<typeof insertProductItemSchema>>, res: Response) => {
    try {
      // Validate the request body
      const validation = insertProductItemSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: 'Invalid product item data', details: validation.error });
      }

      // Verify the file exists
      const file = await storage.getFile(validation.data.fileId);
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Verify the PO exists if provided
      if (validation.data.poId) {
        const po = await storage.getPurchaseOrder(validation.data.poId);
        if (!po) {
          return res.status(404).json({ error: 'Purchase order not found' });
        }
      }

      // Create the product item
      const productItem = await storage.createProductItem(validation.data);

      // Create audit log entry
      await storage.createAuditLog({
        action: 'CREATE_PRODUCT_ITEM',
        entityType: 'product_item',
        entityId: productItem.id,
        userId: req.user!.id,
        details: { 
          fileId: productItem.fileId,
          gtin: productItem.gtin,
          serialNumber: productItem.serialNumber,
          lotNumber: productItem.lotNumber
        }
      });

      res.status(201).json(productItem);
    } catch (error) {
      console.error('Error creating product item:', error);
      res.status(500).json({ error: 'Error creating product item' });
    }
  }
);

// Get a product item by ID
productItemRouter.get('/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid product item ID' });
    }

    const productItem = await storage.getProductItem(id);
    if (!productItem) {
      return res.status(404).json({ error: 'Product item not found' });
    }

    res.json(productItem);
  } catch (error) {
    console.error('Error retrieving product item:', error);
    res.status(500).json({ error: 'Error retrieving product item' });
  }
});

// Get product items for a file
productItemRouter.get('/file/:fileId', isAuthenticated, async (req: Request, res: Response) => {
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

    const productItems = await storage.listProductItemsForFile(fileId);
    res.json(productItems);
  } catch (error) {
    console.error('Error retrieving file product items:', error);
    res.status(500).json({ error: 'Error retrieving file product items' });
  }
});

// Get product items for a purchase order
productItemRouter.get('/po/:poId', isAuthenticated, async (req: Request, res: Response) => {
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

    const productItems = await storage.listProductItemsForPO(poId);
    res.json(productItems);
  } catch (error) {
    console.error('Error retrieving purchase order product items:', error);
    res.status(500).json({ error: 'Error retrieving purchase order product items' });
  }
});

// Find a product item by SGTIN (GTIN + Serial Number)
productItemRouter.get('/sgtin/:gtin/:serialNumber', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const gtin = req.params.gtin;
    const serialNumber = req.params.serialNumber;

    const productItem = await storage.findProductItemBySGTIN(gtin, serialNumber);
    if (!productItem) {
      return res.status(404).json({ error: 'Product item not found' });
    }

    res.json(productItem);
  } catch (error) {
    console.error('Error finding product item by SGTIN:', error);
    res.status(500).json({ error: 'Error finding product item' });
  }
});

// Find product items by lot number
productItemRouter.get('/lot/:gtin/:lotNumber', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const gtin = req.params.gtin;
    const lotNumber = req.params.lotNumber;

    const productItems = await storage.findProductItemsByLot(gtin, lotNumber);
    res.json(productItems);
  } catch (error) {
    console.error('Error finding product items by lot:', error);
    res.status(500).json({ error: 'Error finding product items' });
  }
});