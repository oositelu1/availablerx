import { Request } from 'express';

/**
 * Generates a consistent download URL for presigned links
 * that works across all environments (Replit, production, local)
 */
export function generateDownloadUrl(uuid: string, req?: Request): string {
  // Default protocol is https
  let protocol = 'https';
  let host: string;
  
  // If we're in Replit environment, use the Replit domain
  if (process.env.REPL_ID) {
    if (process.env.REPL_SLUG) {
      host = `${process.env.REPL_SLUG}.replit.dev`;
    } else {
      host = `${process.env.REPL_ID}.id.repl.co`;
    }
  } 
  // Otherwise use the request's host if available
  else if (req) {
    host = req.get('host') || 'localhost:3000';
    
    // For localhost, use http protocol
    if (host.includes('localhost')) {
      protocol = 'http';
    }
    
    // Use X-Forwarded-Proto if available (handles proxied requests correctly)
    const forwardedProto = req.get('X-Forwarded-Proto');
    if (forwardedProto) {
      protocol = forwardedProto;
    } else if (req.protocol) {
      protocol = req.protocol;
    }
  } 
  // Fallback to a sensible default
  else {
    host = 'localhost:3000';
    protocol = 'http';
  }
  
  return `${protocol}://${host}/api/download/${uuid}`;
}