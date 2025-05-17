import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import { storage } from "./storage";
import { setupAuth, isAdmin } from "./auth";
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE, validateZipContents, validateXml } from "./validators";
import { processFile, sendFile, retryTransmission } from "./file-processor";
import { extractProductDetails } from "./file-processor";
import { z } from "zod";
import { insertPartnerSchema } from "@shared/schema";
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { poRouter } from './po-routes';
import { associationRouter } from './epcis-po-association-routes';
import { productItemRouter } from './product-item-routes';
import { validationRouter } from './validation-routes';
import { auditLogRouter } from './audit-log-routes';
import { partnerLocationRouter } from './partner-location-routes';

// Helper function to generate proper download URLs for the current environment
function generateDownloadUrl(req: Request, uuid: string): string {
  let protocol = 'https';
  let host = req.get('host') || 'localhost:3000';
  
  // Special handling for Replit environment
  if (process.env.REPLIT_SLUG) {
    protocol = 'https';
    host = `${process.env.REPLIT_SLUG}.replit.dev`;
  } else if (host.includes('localhost')) {
    protocol = 'http';
  }
  
  return `${protocol}://${host}/api/download/${uuid}`;
}
import { poItemRouter } from './po-item-routes';
import { inventoryRouter } from './inventory-routes';
import { inventoryTransactionRouter } from './inventory-transaction-routes';
import { salesOrderRouter } from './sales-order-routes';
import { salesOrderItemRouter } from './sales-order-item-routes';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE // 100MB or configured value
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (ALLOWED_FILE_TYPES.includes(file.mimetype) || 
        ext === '.zip' || ext === '.xml') {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes and middleware
  setupAuth(app);
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Register EPCIS Compliance Validator routes
  app.use('/api/purchase-orders', poRouter);
  app.use('/api/associations', associationRouter);
  app.use('/api/product-items', productItemRouter);
  app.use('/api/validation', validationRouter);
  app.use('/api/audit-logs', auditLogRouter);
  app.use('/api/partner-locations', partnerLocationRouter);
  app.use('/api/purchase-order-items', poItemRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/inventory-transactions', inventoryTransactionRouter);
  app.use('/api/sales-orders', salesOrderRouter);
  app.use('/api/sales-order-items', salesOrderItemRouter);
  
  // === File Upload & Processing ===
  app.post("/api/files/upload", upload.single('file'), async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        errorCode: 'NO_FILE',
        message: 'No file was uploaded' 
      });
    }
    
    const result = await processFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      req.user.id
    );
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        errorCode: result.errorCode,
        message: result.errorMessage,
        schemaErrors: result.schemaErrors
      });
    }
    
    res.status(201).json({
      success: true,
      file: result.file,
      message: 'File validated and stored successfully'
    });
  });
  
  // === File Management ===
  app.get("/api/files", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const { status, partnerId, startDate, endDate, page = '1', limit = '10' } = req.query;
    
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const offset = (pageNum - 1) * limitNum;
    
    // Build filters object
    const filters: any = {
      limit: limitNum,
      offset
    };
    
    if (status) filters.status = status;
    if (partnerId) filters.partnerId = parseInt(partnerId as string);
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);
    
    const result = await storage.listFiles(filters);
    
    res.json({
      files: result.files,
      total: result.total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(result.total / limitNum)
    });
  });
  
  app.get("/api/files/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const fileId = parseInt(req.params.id);
    const file = await storage.getFile(fileId);
    
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    res.json(file);
  });
  
  app.get("/api/files/:id/download", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const fileId = parseInt(req.params.id);
    const file = await storage.getFile(fileId);
    
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    const fileData = await storage.retrieveFileData(fileId);
    
    if (!fileData) {
      return res.status(404).json({ message: 'File content not found' });
    }
    
    res.setHeader('Content-Type', file.fileType === 'ZIP' ? 'application/zip' : 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename=${file.originalName}`);
    res.send(fileData);
  });
  
  app.get("/api/files/:id/history", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const fileId = parseInt(req.params.id);
    const file = await storage.getFile(fileId);
    
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    const history = await storage.getFileTransmissionHistory(fileId);
    
    res.json(history);
  });
  
  // === File Transmission ===
  app.post("/api/files/:id/send", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const fileId = parseInt(req.params.id);
    const { partnerId, transportType = 'AS2' } = req.body;
    
    if (!partnerId) {
      return res.status(400).json({ message: 'Partner ID is required' });
    }
    
    const file = await storage.getFile(fileId);
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    const partner = await storage.getPartner(parseInt(partnerId));
    if (!partner) {
      return res.status(404).json({ message: 'Partner not found' });
    }
    
    const result = await sendFile(fileId, parseInt(partnerId), req.user.id, transportType);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.errorMessage
      });
    }
    
    res.json({
      success: true,
      transmission: result.transmission
    });
  });
  
  app.post("/api/transmissions/:id/retry", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const transmissionId = parseInt(req.params.id);
    
    const result = await retryTransmission(transmissionId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.errorMessage
      });
    }
    
    res.json({
      success: true,
      transmission: result.transmission
    });
  });
  
  // === Partner Management ===
  app.get("/api/partners", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const activeOnly = req.query.activeOnly === 'true';
    const partners = await storage.listPartners(activeOnly);
    
    res.json(partners);
  });
  
  app.get("/api/partners/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const partnerId = parseInt(req.params.id);
    const partner = await storage.getPartner(partnerId);
    
    if (!partner) {
      return res.status(404).json({ message: 'Partner not found' });
    }
    
    res.json(partner);
  });
  
  app.post("/api/partners", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const partnerData = insertPartnerSchema.parse({
        ...req.body,
        createdBy: req.user.id
      });
      
      const partner = await storage.createPartner(partnerData);
      
      res.status(201).json(partner);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      
      res.status(400).json({ message: 'Invalid partner data' });
    }
  });
  
  app.patch("/api/partners/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const partnerId = parseInt(req.params.id);
    const partner = await storage.getPartner(partnerId);
    
    if (!partner) {
      return res.status(404).json({ message: 'Partner not found' });
    }
    
    try {
      const updates = req.body;
      const updatedPartner = await storage.updatePartner(partnerId, updates);
      
      res.json(updatedPartner);
    } catch (error) {
      res.status(400).json({ message: 'Invalid partner data' });
    }
  });
  
  app.delete("/api/partners/:id", isAdmin, async (req, res) => {
    const partnerId = parseInt(req.params.id);
    
    const success = await storage.deletePartner(partnerId);
    
    if (!success) {
      return res.status(404).json({ message: 'Partner not found' });
    }
    
    res.status(204).send();
  });
  
  // === Statistics ===
  app.get("/api/stats", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const { files: allFiles } = await storage.listFiles();
    
    // Count files by status
    const filesReceived = allFiles.length;
    
    // Count sent files
    const filesSent = allFiles.filter(file => file.status === 'sent').length;
    
    // Calculate validation success rate
    const validated = allFiles.filter(file => file.status === 'validated' || file.status === 'sent').length;
    const validationRate = filesReceived > 0 ? Math.round((validated / filesReceived) * 100) : 0;
    
    res.json({
      filesReceived,
      filesSent,
      validationRate
    });
  });
  
  // === Export ===
  app.get("/api/export/files", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const { status, partnerId, startDate, endDate } = req.query;
    
    // Build filters object
    const filters: any = {};
    
    if (status) filters.status = status;
    if (partnerId) filters.partnerId = parseInt(partnerId as string);
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);
    
    // Get all matching files (no pagination)
    const { files } = await storage.listFiles(filters);
    
    // Generate CSV
    let csv = 'File ID,Original Name,File Type,Status,File Size (bytes),Upload Date,SHA-256,Event Counts\n';
    
    files.forEach(file => {
      const uploadDate = file.uploadedAt.toISOString().split('T')[0];
      const eventCounts = file.metadata ? 
        `${file.metadata.objectEvents || 0} ObjectEvents, ${file.metadata.aggregationEvents || 0} AggregationEvents, ${file.metadata.transactionEvents || 0} TransactionEvents` :
        'N/A';
      
      csv += `${file.id},"${file.originalName}",${file.fileType},${file.status},${file.fileSize},${uploadDate},${file.sha256},"${eventCounts}"\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=file-export-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  });

  // Reprocess a file to extract updated metadata
  app.post('/api/files/:id/reprocess', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const fileId = parseInt(req.params.id);
      if (isNaN(fileId)) {
        return res.status(400).json({ message: 'Invalid file ID' });
      }
      
      const file = await storage.getFile(fileId);
      if (!file) {
        return res.status(404).json({ message: 'File not found' });
      }
      
      // Retrieve the file data
      let fileData = await storage.retrieveFileData(fileId);
      
      // If the file data is not in storage, try to load it from the sample files
      if (!fileData) {
        console.log(`File data not found in storage, trying to load from sample files...`);
        try {
          // Check if this is one of our sample files
          if (file.originalName.startsWith('shipment_')) {
            const samplePath = path.join(process.cwd(), 'attached_assets', file.originalName);
            console.log(`Trying to load sample file from: ${samplePath}`);
            
            try {
              // Use promises API
              const fileContent = await fs.readFile(samplePath);
              fileData = fileContent;
              console.log(`Successfully loaded sample file: ${samplePath}`);
              
              // Store it for future use
              if (fileData) {
                await storage.storeFileData(fileData, fileId);
              }
            } catch (fileErr) {
              console.log(`Sample file not found or could not be read: ${samplePath}`, fileErr);
            }
          }
        } catch (err) {
          console.error(`Error loading sample file:`, err);
        }
        
        // If we still don't have the file data, return error
        if (!fileData) {
          return res.status(404).json({ message: 'File data not found and could not be recovered' });
        }
      }
      
      // Extract new metadata
      let xmlBuffer = fileData;
      if (file.fileType === 'ZIP') {
        // If it's a ZIP file, extract the XML content
        const zipValidation = await validateZipContents(fileData);
        if (!zipValidation.valid || !zipValidation.xmlBuffer) {
          return res.status(400).json({ 
            message: 'Failed to extract XML from ZIP file',
            error: zipValidation.errorMessage
          });
        }
        xmlBuffer = zipValidation.xmlBuffer;
      }
      
      // Validate XML and extract metadata
      const xmlValidation = await validateXml(xmlBuffer);
      if (!xmlValidation.valid) {
        return res.status(400).json({ 
          message: 'Failed to validate XML',
          error: xmlValidation.errorMessage
        });
      }
      
      // Log the extracted metadata for debugging
      console.log('Extracted metadata:', JSON.stringify(xmlValidation.metadata, null, 2));
      console.log('Product info:', JSON.stringify(xmlValidation.metadata?.productInfo, null, 2));
      
      // Extract product details directly from the XML file for more accurate information
      try {
        const extractResult = await extractProductDetails(xmlBuffer);
        console.log('Direct extraction result during reprocess:', extractResult);
        
        if (xmlValidation.metadata && xmlValidation.metadata.productInfo) {
          if (extractResult.name) {
            console.log('Setting product name from direct extraction:', extractResult.name);
            xmlValidation.metadata.productInfo.name = extractResult.name;
          }
          
          if (extractResult.manufacturer) {
            console.log('Setting manufacturer from direct extraction:', extractResult.manufacturer);
            xmlValidation.metadata.productInfo.manufacturer = extractResult.manufacturer;
          }
          
          if (extractResult.ndc) {
            console.log('Setting NDC from direct extraction:', extractResult.ndc);
            xmlValidation.metadata.productInfo.ndc = extractResult.ndc;
          }
          
          console.log('Product information extracted during reprocess:', 
            JSON.stringify(xmlValidation.metadata.productInfo, null, 2));
        } else if (xmlValidation.metadata) {
          // Create productInfo object with extracted data
          xmlValidation.metadata.productInfo = {
            name: extractResult.name || undefined,
            manufacturer: extractResult.manufacturer || undefined,
            ndc: extractResult.ndc || undefined
          };
          console.log('Created new product info during reprocess');
        }
      } catch (error) {
        console.error('Error extracting product details during reprocess:', error);
      }
      
      console.log('Updated metadata product info:', JSON.stringify(xmlValidation.metadata?.productInfo, null, 2));
      
      // Update the file with new metadata
      const updatedFile = await storage.updateFile(fileId, {
        metadata: xmlValidation.metadata
      });
      
      res.json(updatedFile);
    } catch (error) {
      console.error('Error reprocessing file:', error);
      res.status(500).json({ message: 'Failed to reprocess file' });
    }
  });
  
  // === Pre-Signed URL Portal ===
  
  // Generate a pre-signed URL for sharing a file with a partner
  app.post('/api/files/:id/presigned-links', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const fileId = parseInt(req.params.id);
      if (isNaN(fileId)) {
        return res.status(400).json({ message: 'Invalid file ID' });
      }
      
      const partnerId = parseInt(req.body.partnerId);
      if (isNaN(partnerId)) {
        return res.status(400).json({ message: 'Invalid partner ID' });
      }
      
      // Validate file exists
      const file = await storage.getFile(fileId);
      if (!file) {
        return res.status(404).json({ message: 'File not found' });
      }
      
      // Validate partner exists
      const partner = await storage.getPartner(partnerId);
      if (!partner) {
        return res.status(404).json({ message: 'Partner not found' });
      }
      
      // Get expiration time (default 48 hours unless specified)
      const expirationSeconds = req.body.expirationSeconds ? 
        parseInt(req.body.expirationSeconds) : 
        172800; // 48 hours in seconds
      
      // Set one-time use flag (default to false)
      const isOneTimeUse = req.body.isOneTimeUse === true;
      
      // Optional IP restriction
      const ipRestriction = req.body.ipRestriction || null;
      
      // Generate a UUID for the link
      const uuid = uuidv4();
      
      // Hash the UUID for security
      const hash = crypto.createHash('sha256');
      hash.update(uuid);
      const urlHash = hash.digest('hex');
      
      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + expirationSeconds);
      
      // Create pre-signed link in database
      const presignedLink = await storage.createPresignedLink({
        fileId,
        partnerId,
        createdBy: req.user.id,
        uuid,
        urlHash,
        expiresAt,
        isOneTimeUse,
        ipRestriction,
        firstClickedAt: null,
        downloadedAt: null
      });
      
      // Generate the shareable URL
      const downloadUrl = `${req.protocol}://${req.get('host')}/api/download/${uuid}`;
      
      res.json({
        ...presignedLink,
        downloadUrl
      });
    } catch (error) {
      console.error('Error creating pre-signed URL:', error);
      res.status(500).json({ message: 'Failed to create pre-signed URL' });
    }
  });
  
  // List all pre-signed links for a file
  app.get('/api/files/:id/presigned-links', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const fileId = parseInt(req.params.id);
      if (isNaN(fileId)) {
        return res.status(400).json({ message: 'Invalid file ID' });
      }
      
      // Validate file exists
      const file = await storage.getFile(fileId);
      if (!file) {
        return res.status(404).json({ message: 'File not found' });
      }
      
      // Get all shared links for this file
      const links = await storage.listPresignedLinksForFile(fileId);
      
      // Add the download URL to each link
      const linksWithUrls = links.map(link => ({
        ...link,
        downloadUrl: `${req.protocol}://${req.get('host')}/api/download/${link.uuid}`
      }));
      
      res.json(linksWithUrls);
    } catch (error) {
      console.error('Error listing pre-signed links:', error);
      res.status(500).json({ message: 'Failed to list pre-signed links' });
    }
  });
  
  // List all pre-signed links shared with a partner
  app.get('/api/partners/:id/shared-links', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    try {
      const partnerId = parseInt(req.params.id);
      if (isNaN(partnerId)) {
        return res.status(400).json({ message: 'Invalid partner ID' });
      }
      
      // Validate partner exists
      const partner = await storage.getPartner(partnerId);
      if (!partner) {
        return res.status(404).json({ message: 'Partner not found' });
      }
      
      // Get include expired flag
      const includeExpired = req.query.includeExpired === 'true';
      
      // Get all shared links for this partner
      const links = await storage.listPresignedLinksForPartner(partnerId, includeExpired);
      
      // Add the download URL to each link
      const linksWithUrls = links.map(link => ({
        ...link,
        downloadUrl: `${req.protocol}://${req.get('host')}/api/download/${link.uuid}`
      }));
      
      res.json(linksWithUrls);
    } catch (error) {
      console.error('Error listing partner pre-signed links:', error);
      res.status(500).json({ message: 'Failed to list partner pre-signed links' });
    }
  });
  
  // Download a file using a pre-signed URL (public endpoint, no authentication required)
  app.get('/api/download/:uuid', async (req, res) => {
    try {
      const uuid = req.params.uuid;
      
      // Look up the pre-signed link
      const link = await storage.getPresignedLinkByUuid(uuid);
      if (!link) {
        return res.status(404).json({ message: 'Download link not found or has expired' });
      }
      
      // Check if the link has expired
      const now = new Date();
      if (link.expiresAt < now) {
        return res.status(403).json({ message: 'Download link has expired' });
      }
      
      // Check IP restriction if set
      if (link.ipRestriction && req.ip !== link.ipRestriction) {
        return res.status(403).json({ message: 'Access restricted to specific IP address' });
      }
      
      // Check if this is a one-time use link that's already been used
      if (link.isOneTimeUse && link.downloadedAt) {
        return res.status(403).json({ message: 'Download link has already been used' });
      }
      
      // Get the associated file
      const file = await storage.getFile(link.fileId);
      if (!file) {
        return res.status(404).json({ message: 'File not found' });
      }
      
      // Retrieve the file data
      const fileData = await storage.retrieveFileData(file.id);
      if (!fileData) {
        return res.status(404).json({ message: 'File data not found' });
      }
      
      // Update the link's firstClickedAt if not already set
      if (!link.firstClickedAt) {
        await storage.updatePresignedLink(link.id, {
          firstClickedAt: now
        });
      }
      
      // Update the link's downloadedAt if this is a successful download
      await storage.updatePresignedLink(link.id, {
        downloadedAt: now
      });
      
      // Set appropriate headers for file download
      res.setHeader('Content-Type', file.fileType === 'XML' ? 'application/xml' : 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename=${file.originalName}`);
      
      // Send the file
      res.send(fileData);
    } catch (error) {
      console.error('Error downloading file:', error);
      res.status(500).json({ message: 'Failed to download file' });
    }
  });
  
  return httpServer;
}
