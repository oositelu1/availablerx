import { Router, Request, Response, NextFunction } from 'express';
import { storage } from './storage';

// Audit Log routes
export const auditLogRouter = Router();

// Check if user is authenticated
function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Get all audit logs with optional filtering
auditLogRouter.get('/', isAuthenticated, async (req: Request, res: Response) => {
  try {
    // Parse pagination parameters
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    // Get audit logs with optional entity type filter
    const entityType = req.query.entityType as string | undefined;
    const logs = await storage.listAuditLogs(entityType, undefined, limit, offset);
    
    res.json(logs);
  } catch (error) {
    console.error('Error retrieving audit logs:', error);
    res.status(500).json({ error: 'Error retrieving audit logs' });
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

    // Parse pagination parameters
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    const logs = await storage.listAuditLogs(entityType, entityId, limit, offset);
    res.json(logs);
  } catch (error) {
    console.error('Error retrieving entity audit logs:', error);
    res.status(500).json({ error: 'Error retrieving entity audit logs' });
  }
});

// Get audit logs for a specific user
auditLogRouter.get('/user', isAuthenticated, async (req: Request, res: Response) => {
  try {
    // Get the user ID from the query parameter or use the current user
    let userId = req.user!.id;
    if (req.query.userId) {
      userId = parseInt(req.query.userId as string);
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }
    }

    // Parse pagination parameters
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    // Use specialized query for user logs
    const query = `
      SELECT * FROM audit_logs 
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    // Get count of total logs for this user
    const countQuery = `
      SELECT COUNT(*) as total FROM audit_logs 
      WHERE user_id = $1
    `;

    try {
      const { rows: logRows } = await storage.executeRawSql(query, [userId, limit, offset]);
      const { rows: countRows } = await storage.executeRawSql(countQuery, [userId]);
      
      const logs = {
        logs: logRows,
        total: parseInt(countRows[0].total)
      };
      
      res.json(logs);
    } catch (dbErr) {
      console.error('Database error:', dbErr);
      res.status(500).json({ error: 'Error retrieving user audit logs' });
    }
  } catch (error) {
    console.error('Error retrieving user audit logs:', error);
    res.status(500).json({ error: 'Error retrieving user audit logs' });
  }
});