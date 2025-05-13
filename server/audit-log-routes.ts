import { Router, Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import { isAdmin } from './auth';

// Audit Log routes
export const auditLogRouter = Router();

// Check if user is authenticated
function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// List audit logs - admins can see all logs, regular users can only see their own
auditLogRouter.get('/', isAuthenticated, async (req: Request, res: Response) => {
  try {
    // Parse query parameters
    const entityType = req.query.entityType as string | undefined;
    const entityId = req.query.entityId ? parseInt(req.query.entityId as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    
    // Non-admins can only see their own logs
    const isAdminUser = req.user!.role === 'administrator';
    
    // Get audit logs
    const result = await storage.listAuditLogs(entityType, entityId, limit, offset);
    
    // If not admin, filter to show only user's own logs
    if (!isAdminUser) {
      result.logs = result.logs.filter(log => log.userId === req.user!.id);
      result.total = result.logs.length; // Adjust total accordingly
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error listing audit logs:', error);
    res.status(500).json({ error: 'Error listing audit logs' });
  }
});

// Get audit logs for a specific entity
auditLogRouter.get('/entity/:type/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const entityType = req.params.type;
    const entityId = parseInt(req.params.id);
    
    if (isNaN(entityId)) {
      return res.status(400).json({ error: 'Invalid entity ID' });
    }
    
    // Non-admins have restricted access to entity logs based on ownership
    const isAdminUser = req.user!.role === 'administrator';
    
    // Get all logs for this entity
    const result = await storage.listAuditLogs(entityType, entityId);
    
    // If not admin, filter based on entity type and access rules
    if (!isAdminUser) {
      // For now, show all logs for the entity to all authenticated users
      // In a stricter system, we would check entity ownership here
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error retrieving entity audit logs:', error);
    res.status(500).json({ error: 'Error retrieving entity audit logs' });
  }
});

// Get user's own audit logs 
auditLogRouter.get('/user', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // Get all logs for this user
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    
    // Custom query to get user's logs
    const userLogs = await storage.listAuditLogs(undefined, undefined, limit, offset);
    const filteredLogs = {
      logs: userLogs.logs.filter(log => log.userId === userId),
      total: 0
    };
    
    filteredLogs.total = filteredLogs.logs.length;
    
    res.json(filteredLogs);
  } catch (error) {
    console.error('Error retrieving user audit logs:', error);
    res.status(500).json({ error: 'Error retrieving user audit logs' });
  }
});