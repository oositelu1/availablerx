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

// Import all routers
import { poRouter } from './po-routes';
import { associationRouter } from './epcis-po-association-routes';
import { productItemRouter } from './product-item-routes';
import { validationRouter } from './validation-routes';
import { auditLogRouter } from './audit-log-routes';
import { partnerLocationRouter } from './partner-location-routes';
import { poItemRouter } from './po-item-routes';
import { inventoryRouter } from './inventory-routes';
import { inventoryTransactionRouter } from './inventory-transaction-routes';
import { salesOrderRouter } from './sales-order-routes';
import { salesOrderItemRouter } from './sales-order-item-routes';
import { s3Monitor } from './s3-monitor';
import { multiAS2Router } from './multi-as2-routes';

// Helper function to generate proper download URLs for the current environment
function generateDownloadUrl(uuid: string, req?: Request): string {
  // Default values
  let protocol = 'https';
  let host = 'localhost:3000';
  
  console.log('Generating download URL with environment:');
  console.log(`REPLIT_DOMAINS: ${process.env.REPLIT_DOMAINS}`);
  console.log(`REPLIT_DEV_DOMAIN: ${process.env.REPLIT_DEV_DOMAIN}`);
  
  // Force Replit domain in Replit environment
  if (process.env.REPLIT_DOMAINS) {
    protocol = 'https';
    host = process.env.REPLIT_DOMAINS;
    console.log(`Using REPLIT_DOMAINS: ${host}`);
  } 
  // Fallback to REPLIT_DEV_DOMAIN env var
  else if (process.env.REPLIT_DEV_DOMAIN) {
    protocol = 'https';
    host = process.env.REPLIT_DEV_DOMAIN;
    console.log(`Using REPLIT_DEV_DOMAIN: ${host}`);
  }
  // If not in Replit, use request info if available
  else if (req) {
    host = req.get('host') || host;
    if (req.protocol) {
      protocol = req.protocol;
    }
    console.log(`Using request host: ${host}`);
  }
  
  // For localhost, use http protocol
  if (host.includes('localhost')) {
    protocol = 'http';
  }
  
  // Hard-coded domain for production environment
  if (process.env.NODE_ENV === 'production' && !process.env.REPLIT_DOMAINS) {
    host = 'availablerx.com';
    console.log(`Using production host: ${host}`);
  }
  
  const url = `${protocol}://${host}/api/download/${uuid}`;
  console.log(`Generated URL: ${url}`);
  return url;
}

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
  app.use('/api/multi-as2', multiAS2Router);
  
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
  
  // === Cache Management ===
  app.get("/api/cache/stats", isAdmin, async (req, res) => {
    const cacheService = await import('./cache-service');
    res.json(cacheService.cache.getStats());
  });
  
  app.post("/api/cache/invalidate", isAdmin, async (req, res) => {
    const { pattern } = req.body;
    if (!pattern) {
      return res.status(400).json({ message: 'Pattern is required' });
    }
    
    const cacheService = await import('./cache-service');
    const count = cacheService.cache.invalidate(pattern);
    res.json({ message: `Invalidated ${count} cache entries`, count });
  });
  
  app.post("/api/cache/clear", isAdmin, async (req, res) => {
    const cacheService = await import('./cache-service');
    cacheService.cache.clear();
    res.json({ message: 'Cache cleared successfully' });
  });

  // === DataMatrix Parser ===
  app.post("/api/parse-datamatrix", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    
    const { rawData } = req.body;
    console.log('DataMatrix parse request received:', rawData);
    
    if (!rawData) {
      return res.status(400).json({ 
        success: false, 
        message: 'No data provided' 
      });
    }
    
    try {
      // Call Python parser
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const pythonScript = path.join(process.cwd(), 'server', 'utils', 'datamatrix_parser.py');
      console.log('Calling Python script:', pythonScript);
      
      const { stdout, stderr } = await execAsync(`python3 "${pythonScript}" "${rawData}"`);
      
      if (stderr) {
        console.error('Python parser stderr:', stderr);
        return res.status(500).json({ 
          success: false, 
          message: 'Parser error', 
          error: stderr 
        });
      }
      
      console.log('Python parser stdout:', stdout);
      const result = JSON.parse(stdout);
      
      if (result.error) {
        return res.status(400).json({ 
          success: false, 
          message: result.error 
        });
      }
      
      console.log('Sending parsed result:', result);
      res.json({
        success: true,
        data: result
      });
      
    } catch (error: any) {
      console.error('DataMatrix parser error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to parse DataMatrix',
        error: error.message
      });
    }
  });

  // === AS2 Monitoring Service Control ===
  app.get("/api/as2/monitor/status", isAdmin, async (req, res) => {
    // Return the current status of the S3 monitoring service
    res.json({
      isRunning: s3Monitor.isRunning(),
      lastCheckTime: s3Monitor.getLastCheckTime(),
      processedFileCount: s3Monitor.getProcessedFileCount(),
      aws: {
        configured: !!process.env.AWS_REGION && !!process.env.AWS_S3_BUCKET,
        region: process.env.AWS_REGION || 'not configured',
        bucket: process.env.AWS_S3_BUCKET ? `${process.env.AWS_S3_BUCKET}/as2-incoming` : 'not configured'
      }
    });
  });
  
  app.post("/api/as2/monitor/start", isAdmin, async (req, res) => {
    // Start the monitoring service
    try {
      const intervalMinutes = parseInt(req.body.intervalMinutes || '5');
      s3Monitor.start(intervalMinutes);
      res.json({
        success: true,
        message: `AS2 file monitoring started with ${intervalMinutes} minute interval`,
        isRunning: s3Monitor.isRunning()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: `Failed to start AS2 file monitoring: ${error.message}`
      });
    }
  });
  
  app.post("/api/as2/monitor/stop", isAdmin, async (req, res) => {
    // Stop the monitoring service
    try {
      s3Monitor.stop();
      res.json({
        success: true,
        message: 'AS2 file monitoring stopped',
        isRunning: s3Monitor.isRunning()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: `Failed to stop AS2 file monitoring: ${error.message}`
      });
    }
  });
  
  app.post("/api/as2/monitor/check-now", isAdmin, async (req, res) => {
    // Force an immediate check
    try {
      await s3Monitor.checkNow();
      res.json({
        success: true,
        message: 'AS2 file check triggered successfully',
        lastCheckTime: s3Monitor.getLastCheckTime()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: `Failed to check for AS2 files: ${error.message}`
      });
    }
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
      const metadata = file.metadata || {};
      const eventCounts = `${metadata.objectEvents || 0} ObjectEvents, ${metadata.aggregationEvents || 0} AggregationEvents, ${metadata.transactionEvents || 0} TransactionEvents`;
      
      csv += `${file.id},"${file.originalName}",${file.fileType},${file.status},${file.fileSize},${uploadDate},${file.sha256},"${eventCounts}"\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=file-export-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  });

  // Public download endpoint for pre-signed URLs
  app.get("/api/download/:uuid", async (req, res) => {
    const { uuid } = req.params;
    
    if (!uuid) {
      return res.status(400).json({ message: 'Missing UUID parameter' });
    }
    
    try {
      const link = await storage.getPresignedLinkByUuid(uuid);
      
      if (!link) {
        return res.status(404).json({ message: 'Link not found or expired' });
      }
      
      // Check if link is expired
      if (link.expiresAt < new Date()) {
        return res.status(410).json({ message: 'This link has expired' });
      }
      
      // Check if this is a one-time use link that has already been downloaded
      if (link.isOneTimeUse && link.downloadedAt) {
        return res.status(410).json({ message: 'This one-time link has already been used' });
      }
      
      // If this is the first access, record the first click time
      if (!link.firstClickedAt) {
        await storage.updatePresignedLink(link.id, { firstClickedAt: new Date() });
      }
      
      // Now get the associated file
      const file = await storage.getFile(link.fileId);
      
      if (!file) {
        return res.status(404).json({ message: 'File not found' });
      }
      
      // Get file data
      const fileData = await storage.retrieveFileData(file.id);
      
      if (!fileData) {
        return res.status(404).json({ message: 'File content not found' });
      }
      
      // Mark as downloaded
      await storage.updatePresignedLink(link.id, { downloadedAt: new Date() });
      
      // Send the file
      res.setHeader('Content-Type', file.fileType === 'ZIP' ? 'application/zip' : 'application/xml');
      res.setHeader('Content-Disposition', `attachment; filename=${file.originalName}`);
      res.send(fileData);
    } catch (error: any) {
      console.error('Error processing download:', error);
      res.status(500).json({ message: 'Error processing download request' });
    }
  });

  return httpServer;
}