import { MailService } from '@sendgrid/mail';
import { Partner } from '@shared/schema';

// Initialize SendGrid
const sendgrid = new MailService();

// Email configuration flags
let hasSendGridKey = false;
let hasSenderVerification = true; // Assume true until proven otherwise
let emailServiceReady = false;

// Check if SendGrid API key is available
if (process.env.SENDGRID_API_KEY) {
  try {
    sendgrid.setApiKey(process.env.SENDGRID_API_KEY);
    hasSendGridKey = true;
    console.log('SendGrid API key configured');
  } catch (err) {
    console.error('Error setting SendGrid API key:', err);
  }
} else {
  console.warn(
    'SendGrid API key not found. Email notifications will be logged but not sent.' +
    '\nTo enable email sending, please set the SENDGRID_API_KEY environment variable.'
  );
}

// Sender email configuration
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'noreply@epcisportal.com';
const SENDER_NAME = process.env.SENDER_NAME || 'EPCIS Portal';

// Additional email configuration
const REPLY_TO_EMAIL = process.env.REPLY_TO_EMAIL || '';
const EMAIL_ENABLED = process.env.EMAIL_ENABLED !== 'false'; // Enabled by default
const APP_URL = process.env.APP_URL || process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

// Set email service ready if all conditions are met
emailServiceReady = hasSendGridKey && hasSenderVerification && EMAIL_ENABLED;

// Log email configuration
console.log(`Email Service Configuration:
- Service Ready: ${emailServiceReady ? 'Yes' : 'No'}
- SendGrid API Key: ${hasSendGridKey ? 'Present' : 'Missing'}
- Sender Email: ${SENDER_EMAIL}
- Email Sending Enabled: ${EMAIL_ENABLED ? 'Yes' : 'No'}
`);

// Information about SendGrid sender verification
const SENDER_VERIFICATION_INFO = `
IMPORTANT: SendGrid requires sender email verification
------------------------------------------------------
To send emails with SendGrid, you must verify your sender identity:

1. Log in to your SendGrid account
2. Go to Settings > Sender Authentication
3. Verify a Single Sender or set up Domain Authentication
4. Use the verified email address in your SENDER_EMAIL environment variable
   (Currently set to: ${SENDER_EMAIL})

For more information, visit:
https://sendgrid.com/docs/for-developers/sending-email/sender-identity/
`;

// Check if we should show the verification info
if (hasSendGridKey && !hasSenderVerification) {
  console.warn(SENDER_VERIFICATION_INFO);
}

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Send an email using SendGrid
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  // Log email content for debugging/development purposes
  console.log('\n--- Email Details ---');
  console.log(`To: ${options.to}`);
  console.log(`From: ${SENDER_NAME} <${SENDER_EMAIL}>`);
  console.log(`Subject: ${options.subject}`);
  console.log(`Body (text): ${options.text.substring(0, 100)}...`);
  console.log('--- End Email Details ---\n');
  
  // If email is disabled, just log and return success
  if (!EMAIL_ENABLED) {
    console.log('Email sending is disabled. Email would have been sent to:', options.to);
    return true;
  }
  
  // If SendGrid API key is not configured, just log and return success
  if (!hasSendGridKey) {
    console.log('SendGrid API key not configured. Email would have been sent to:', options.to);
    return true;
  }
  
  try {
    const emailConfig: any = {
      to: options.to,
      from: {
        email: SENDER_EMAIL,
        name: SENDER_NAME
      },
      subject: options.subject,
      text: options.text,
      html: options.html
    };
    
    // Add reply-to if configured
    if (REPLY_TO_EMAIL) {
      emailConfig.replyTo = REPLY_TO_EMAIL;
    }
    
    await sendgrid.send(emailConfig);
    
    console.log(`Email successfully sent to ${options.to}`);
    return true;
  } catch (error: any) {
    console.error('Error sending email:', error);
    
    // Check for sender verification error
    if (error.response && 
        error.response.body && 
        error.response.body.errors && 
        error.response.body.errors.length > 0) {
      const firstError = error.response.body.errors[0];
      
      // Look for sender verification error
      if (firstError.message && 
          firstError.message.includes('from address does not match a verified Sender Identity')) {
        
        console.error('\nSENDER VERIFICATION ERROR: The email address you are using as the sender is not verified with SendGrid.');
        console.error(SENDER_VERIFICATION_INFO);
        
        // Update the flag for sender verification
        hasSenderVerification = false;
        emailServiceReady = false;
      }
      
      // Log detailed error information
      console.error('SendGrid error details:', {
        message: firstError.message,
        field: firstError.field,
        help: firstError.help
      });
    } else if (error.response) {
      // Log general error details
      console.error('SendGrid error details:', {
        status: error.code,
        body: error.response.body
      });
    }
    
    // Even if email sending fails, application should continue
    // Just log that the email would have been sent
    console.log(`Email would have been sent to ${options.to} (failed due to SendGrid error)`);
    return false;
  }
}

/**
 * Send a notification to a partner about a shared file with pre-signed URL
 */
export async function sendFileShareNotification(
  partner: Partner,
  fileName: string,
  presignedUrl: string,
  expiresAt: Date
): Promise<boolean> {
  // Ensure the presignedUrl is using the correct domain for Replit environment
  let finalUrl = presignedUrl;
  
  // Always enforce the correct domain in Replit environment
  if (process.env.REPLIT_DOMAINS) {
    const protocol = 'https';
    const host = process.env.REPLIT_DOMAINS;
    const uuid = presignedUrl.split('/').pop(); // Extract the UUID from the URL
    finalUrl = `${protocol}://${host}/api/download/${uuid}`;
    console.log(`Setting URL to use Replit domain: ${finalUrl}`);
  }
  // Format the expiration date for display
  const expirationDate = expiresAt.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  // Calculate time until expiration for display
  const now = new Date();
  const diffTime = Math.abs(expiresAt.getTime() - now.getTime());
  const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  const hoursRemaining = diffHours % 24;
  
  let timeUntilExpiry = "";
  if (diffDays > 0) {
    timeUntilExpiry = `${diffDays} day${diffDays > 1 ? 's' : ''}`;
    if (hoursRemaining > 0) {
      timeUntilExpiry += ` and ${hoursRemaining} hour${hoursRemaining > 1 ? 's' : ''}`;
    }
  } else {
    timeUntilExpiry = `${hoursRemaining} hour${hoursRemaining > 1 ? 's' : ''}`;
  }
  
  const subject = `EPCIS File Shared: ${fileName}`;
  
  const text = `
Hello ${partner.name},

An EPCIS file has been shared with you: ${fileName}

You can download this file using the secure link below:
${finalUrl}

IMPORTANT: This link will expire in ${timeUntilExpiry} (on ${expirationDate}).

For your information, this file is being shared with you in compliance with Drug Supply Chain Security Act (DSCSA) requirements.

If you have any questions about this file, please contact the sender directly.

Thank you,
EPCIS Portal Team
  `.trim();
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 20px; padding: 20px; background: linear-gradient(135deg, #4a6ee0, #6a5be2); border-radius: 5px 5px 0 0; }
    .header h2 { color: white; margin: 0; font-size: 24px; }
    .content { background-color: white; padding: 20px; border-radius: 0 0 5px 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
    .button { display: inline-block; background: linear-gradient(135deg, #4a6ee0, #6a5be2); color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 15px 0; }
    .button:hover { background: linear-gradient(135deg, #3a5ed0, #5a4bd2); }
    .file-info { background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #4a6ee0; }
    .expiration { color: #e74c3c; font-weight: bold; margin: 15px 0; padding: 10px; border: 1px dashed #e74c3c; border-radius: 5px; text-align: center; }
    .note { font-size: 0.9em; color: #666; background-color: #f9f9f9; padding: 10px; border-radius: 5px; margin-top: 20px; }
    .footer { margin-top: 30px; font-size: 0.8em; color: #666; text-align: center; padding-top: 20px; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>EPCIS File Shared With You</h2>
    </div>
    <div class="content">
      <p>Hello ${partner.name},</p>
      
      <p>An EPCIS file has been shared with you through the EPCIS Portal system:</p>
      
      <div class="file-info">
        <p><strong>File name:</strong> ${fileName}</p>
      </div>
      
      <p>You can download this file by clicking the button below:</p>
      
      <p style="text-align: center;">
        <a href="${finalUrl}" class="button">Download EPCIS File</a>
      </p>
      
      <div class="expiration">
        <strong>⚠️ Important:</strong> This link will expire in ${timeUntilExpiry}.<br>
        (Expires on ${expirationDate})
      </div>
      
      <div class="note">
        <p>This file is being shared with you in compliance with Drug Supply Chain Security Act (DSCSA) requirements. If you have any questions about this file, please contact the sender directly.</p>
      </div>
    </div>
    <div class="footer">
      <p>Thank you,<br>EPCIS Portal Team</p>
      <p>This is an automated message. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
  
  // Log notification attempt
  console.log(`Sending file share notification to partner: ${partner.name} (${partner.contactEmail})`);
  console.log(`File: ${fileName} | Expires: ${expirationDate}`);
  
  // If email service isn't ready, log what would have been sent and return failure
  if (!emailServiceReady) {
    console.warn(`Email service is not ready, but notification would have been sent to ${partner.contactEmail}`);
    console.warn(`Partner will need to be notified through alternative means.`);
    return false;
  }
  
  // Try to send the email
  const result = await sendEmail({
    to: partner.contactEmail,
    subject,
    text,
    html
  });
  
  if (result) {
    console.log(`✓ File share notification successfully sent to ${partner.name} (${partner.contactEmail})`);
  } else {
    console.warn(`✗ Failed to send file share notification to ${partner.name} (${partner.contactEmail})`);
    console.warn(`Partner will need to be notified through alternative means.`);
  }
  
  return result;
}