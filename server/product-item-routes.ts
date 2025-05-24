import { Router, Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import { insertProductItemSchema } from '@shared/schema';
import { TypedRequestBody } from './types';
import { z } from 'zod';
import { cache, cacheKeys, cacheTTL } from './cache-service';

// Product Item routes
export const productItemRouter = Router();

// Check if user is authenticated
function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Create a new product item (typically done automatically when processing EPCIS files)
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

      // Verify file exists
      const file = await storage.getFile(validation.data.fileId);
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Verify PO exists if provided
      if (validation.data.poId) {
        const po = await storage.getPurchaseOrder(validation.data.poId);
        if (!po) {
          return res.status(404).json({ error: 'Purchase order not found' });
        }
      }

      // Check if product item with this SGTIN already exists
      const existingItem = await storage.findProductItemBySGTIN(
        validation.data.gtin,
        validation.data.serialNumber
      );

      if (existingItem) {
        return res.status(400).json({ 
          error: 'Product item with this GTIN and serial number already exists',
          existingItem 
        });
      }

      // Create the product item
      const item = await storage.createProductItem(validation.data);

      // Create audit log entry
      await storage.createAuditLog({
        action: 'CREATE_PRODUCT_ITEM',
        entityType: 'product_item',
        entityId: item.id,
        userId: req.user!.id,
        details: { 
          gtin: item.gtin,
          serialNumber: item.serialNumber,
          fileId: item.fileId
        }
      });

      res.status(201).json(item);
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

    // Try cache first
    const cacheKey = `product-item:${id}`;
    const item = await cache.getOrFetch(
      cacheKey,
      () => storage.getProductItem(id),
      cacheTTL.medium
    );
    
    if (!item) {
      return res.status(404).json({ error: 'Product item not found' });
    }

    res.json(item);
  } catch (error) {
    console.error('Error retrieving product item:', error);
    res.status(500).json({ error: 'Error retrieving product item' });
  }
});

// Get all product items for a file
productItemRouter.get('/file/:fileId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const fileId = parseInt(req.params.fileId);
    if (isNaN(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    // Verify file exists
    const file = await storage.getFile(fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const items = await storage.listProductItemsForFile(fileId);
    res.json(items);
  } catch (error) {
    console.error('Error retrieving file product items:', error);
    res.status(500).json({ error: 'Error retrieving file product items' });
  }
});

// Get all product items for a purchase order
productItemRouter.get('/po/:poId', isAuthenticated, async (req: Request, res: Response) => {
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

    const items = await storage.listProductItemsForPO(poId);
    res.json(items);
  } catch (error) {
    console.error('Error retrieving purchase order product items:', error);
    res.status(500).json({ error: 'Error retrieving purchase order product items' });
  }
});

// Look up product item by SGTIN (GTIN + Serial Number)
productItemRouter.get('/sgtin/:gtin/:serialNumber', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { gtin, serialNumber } = req.params;
    
    // Cache key for SGTIN lookups
    const cacheKey = `sgtin:${gtin}:${serialNumber}`;
    const item = await cache.getOrFetch(
      cacheKey,
      () => storage.findProductItemBySGTIN(gtin, serialNumber),
      cacheTTL.long // These rarely change
    );
    
    if (!item) {
      return res.status(404).json({ error: 'Product item not found' });
    }
    
    res.json(item);
  } catch (error) {
    console.error('Error looking up product item by SGTIN:', error);
    res.status(500).json({ error: 'Error looking up product item' });
  }
});

// Look up product items by lot number
productItemRouter.get('/lot/:gtin/:lotNumber', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { gtin, lotNumber } = req.params;
    
    const items = await storage.findProductItemsByLot(gtin, lotNumber);
    
    res.json(items);
  } catch (error) {
    console.error('Error looking up product items by lot:', error);
    res.status(500).json({ error: 'Error looking up product items' });
  }
});