import { MailService } from '@sendgrid/mail';
import { Partner } from '@shared/schema';

// Initialize SendGrid
const sendgrid = new MailService();
sendgrid.setApiKey(process.env.SENDGRID_API_KEY as string);

// Sender email configuration
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'noreply@epcisportal.com';
const SENDER_NAME = process.env.SENDER_NAME || 'EPCIS Portal';

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
  try {
    await sendgrid.send({
      to: options.to,
      from: {
        email: SENDER_EMAIL,
        name: SENDER_NAME
      },
      subject: options.subject,
      text: options.text,
      html: options.html
    });
    
    console.log(`Email sent to ${options.to}`);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
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
  const expirationDate = expiresAt.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const subject = `EPCIS File Shared: ${fileName}`;
  
  const text = `
Hello ${partner.name},

An EPCIS file has been shared with you: ${fileName}

You can download this file using the secure link below:
${presignedUrl}

This link will expire on ${expirationDate}.

Thank you,
EPCIS Portal Team
  `.trim();
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 20px; }
    .content { background-color: #f9f9f9; padding: 20px; border-radius: 5px; }
    .button { display: inline-block; background-color: #4a6ee0; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
    .footer { margin-top: 30px; font-size: 0.8em; color: #666; text-align: center; }
    .expiration { color: #e74c3c; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>EPCIS File Shared With You</h2>
    </div>
    <div class="content">
      <p>Hello ${partner.name},</p>
      <p>An EPCIS file has been shared with you: <strong>${fileName}</strong></p>
      <p>You can download this file using the secure link below:</p>
      <p style="text-align: center;">
        <a href="${presignedUrl}" class="button">Download File</a>
      </p>
      <p class="expiration">This link will expire on ${expirationDate}.</p>
    </div>
    <div class="footer">
      <p>Thank you,<br>EPCIS Portal Team</p>
    </div>
  </div>
</body>
</html>
  `.trim();
  
  return sendEmail({
    to: partner.contactEmail,
    subject,
    text,
    html
  });
}