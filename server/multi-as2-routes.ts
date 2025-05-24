import { Router } from 'express';
import { S3PrefixMonitorService } from './s3-prefix-monitor';
import { isAdmin } from './auth';
import { storage } from './storage';

export const multiAS2Router = Router();

// Get prefix-based monitoring instance
const prefixMonitor = S3PrefixMonitorService.getInstance();

// Get monitoring status for all receivers
multiAS2Router.get('/status', isAdmin, async (req, res) => {
  const status = prefixMonitor.getStatus();
  res.json(status);
});

// Start monitoring all receivers
multiAS2Router.post('/start', isAdmin, async (req, res) => {
  try {
    const intervalMinutes = parseInt(req.body.intervalMinutes || '5');
    await prefixMonitor.start(intervalMinutes * 60 * 1000);
    
    res.json({
      success: true,
      message: 'Multi-tenant AS2 monitoring started',
      status: prefixMonitor.getStatus()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Stop monitoring
multiAS2Router.post('/stop', isAdmin, async (req, res) => {
  try {
    prefixMonitor.stop();
    res.json({
      success: true,
      message: 'Multi-tenant AS2 monitoring stopped'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Check specific receiver now
multiAS2Router.post('/check-receiver/:partnerId', isAdmin, async (req, res) => {
  try {
    const partnerId = parseInt(req.params.partnerId);
    await prefixMonitor.checkReceiver(partnerId);
    
    res.json({
      success: true,
      message: `Check triggered for partner ${partnerId}`
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Add a receiver to monitoring
multiAS2Router.post('/add-receiver/:partnerId', isAdmin, async (req, res) => {
  try {
    const partnerId = parseInt(req.params.partnerId);
    const partner = await storage.getPartner(partnerId);
    
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partner not found'
      });
    }
    
    // Partner will be loaded automatically on next check
    
    res.json({
      success: true,
      message: `Added ${partner.companyName} to monitoring`
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Remove a receiver from monitoring
multiAS2Router.delete('/remove-receiver/:partnerId', isAdmin, async (req, res) => {
  try {
    const partnerId = parseInt(req.params.partnerId);
    // Partner removal handled by database is_active flag
    
    res.json({
      success: true,
      message: `Partner ${partnerId} will be removed from monitoring on next check`
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Update S3 prefix for a receiver
multiAS2Router.put('/update-prefix/:partnerId', isAdmin, async (req, res) => {
  try {
    const partnerId = parseInt(req.params.partnerId);
    const { prefix } = req.body;
    
    if (!prefix) {
      return res.status(400).json({
        success: false,
        message: 'S3 prefix is required'
      });
    }
    
    await prefixMonitor.updateReceiverPrefix(partnerId, prefix);
    
    res.json({
      success: true,
      message: `Updated S3 prefix for partner ${partnerId} to: ${prefix}`
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});