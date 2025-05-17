import { Request } from 'express';

/**
 * Generates a consistent download URL for presigned links
 * that works across all environments (Replit, production, local)
 */
export function generateDownloadUrl(uuid: string, req?: Request): string {
  // Default protocol is https
  let protocol = 'https';
  let host: string = 'localhost:3000';
  
  console.log("Generating download URL with environment:");
  console.log(`REPLIT_DOMAINS: ${process.env.REPLIT_DOMAINS}`);
  console.log(`REPLIT_DEV_DOMAIN: ${process.env.REPLIT_DEV_DOMAIN}`);
  
  // If we're in Replit environment, use the Replit domain
  if (process.env.REPLIT_DOMAINS) {
    host = process.env.REPLIT_DOMAINS;
    console.log(`Using REPLIT_DOMAINS: ${host}`);
  } 
  // Fallback to REPLIT_DEV_DOMAIN
  else if (process.env.REPLIT_DEV_DOMAIN) {
    host = process.env.REPLIT_DEV_DOMAIN;
    console.log(`Using REPLIT_DEV_DOMAIN: ${host}`);
  }
  // Otherwise use the request's host if available
  else if (req) {
    host = req.get('host') || host;
    console.log(`Using request host: ${host}`);
    
    // Use X-Forwarded-Proto if available (handles proxied requests correctly)
    const forwardedProto = req.get('X-Forwarded-Proto');
    if (forwardedProto) {
      protocol = forwardedProto;
    } else if (req.protocol) {
      protocol = req.protocol;
    }
  }
  
  // For localhost, use http protocol
  if (host.includes('localhost')) {
    protocol = 'http';
    console.log(`Using localhost protocol: ${protocol}`);
  }
  
  return `${protocol}://${host}/api/download/${uuid}`;
}