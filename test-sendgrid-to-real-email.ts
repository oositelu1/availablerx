import { MailService } from '@sendgrid/mail';

async function testSendGridToRealEmail() {
  // Initialize SendGrid directly to get detailed response
  const sendgrid = new MailService();
  
  if (!process.env.SENDGRID_API_KEY) {
    console.error('SendGrid API key not found in environment variables');
    return;
  }
  
  sendgrid.setApiKey(process.env.SENDGRID_API_KEY);
  
  console.log('======================================');
  console.log('SENDGRID DIRECT EMAIL TEST');
  console.log('======================================\n');
  
  // Ask for a real recipient email - replace with actual test email
  const recipientEmail = 'fisayo@medscoutrx.com'; // Replace with the real email you want to test with
  const senderEmail = process.env.SENDER_EMAIL || 'fisayo@medscoutrx.com';
  
  console.log(`Using sender email: ${senderEmail}`);
  console.log(`Sending test to recipient: ${recipientEmail}`);
  
  try {
    // Create email message
    const msg = {
      to: recipientEmail,
      from: {
        email: senderEmail,
        name: 'EPCIS Portal Test'
      },
      subject: 'EPCIS Portal - SendGrid Direct Test',
      text: 'This is a direct test email from the EPCIS Portal SendGrid integration testing script',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 5px;">
          <h1 style="color: #4a6ee0;">EPCIS Portal Test</h1>
          <p>This is a direct test email from the EPCIS Portal SendGrid integration.</p>
          <p>If you're seeing this email, it means that SendGrid is successfully delivering emails!</p>
          <p><strong>Date/Time:</strong> ${new Date().toLocaleString()}</p>
        </div>
      `
    };
    
    console.log('\nSending email...');
    
    // Send mail with detailed response
    const [response] = await sendgrid.send(msg, true);
    
    console.log(`\nSendGrid API Response Status Code: ${response.statusCode}`);
    
    if (response.statusCode >= 200 && response.statusCode < 300) {
      console.log('✓ Email successfully processed by SendGrid!');
      console.log('SendGrid message ID:', response.headers['x-message-id']);
      
      console.log('\nReminder: Email delivery can still be affected by:');
      console.log('1. Recipient spam filters');
      console.log('2. Rate limiting');
      console.log('3. Recipient email server policies');
      console.log('4. Sender reputation');
    } else {
      console.log('✗ SendGrid returned a non-success status code');
      console.log(response.body);
    }
  } catch (error: any) {
    console.error('✗ Error encountered during email test:', error.toString());
    
    if (error.response) {
      console.error('\nDetailed SendGrid error information:');
      console.log('Status code:', error.code);
      
      if (error.response.body && error.response.body.errors) {
        console.log(JSON.stringify(error.response.body.errors, null, 2));
      } else {
        console.log(JSON.stringify(error.response.body, null, 2));
      }
    }
  }
  
  console.log('\n======================================');
  console.log('TEST COMPLETED');
  console.log('======================================');
}

// Run the test
testSendGridToRealEmail().catch(console.error);