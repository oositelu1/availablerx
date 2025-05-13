import { sendEmail } from './server/email-service';

async function testEmailSend() {
  try {
    console.log('Testing SendGrid email sending...');
    
    const result = await sendEmail({
      to: 'test@example.com', // Replace with a test email address
      subject: 'EPCIS Portal - Email Test',
      text: 'This is a test email from the EPCIS Portal application.',
      html: '<h1>EPCIS Portal</h1><p>This is a test email from the EPCIS Portal application.</p>'
    });
    
    if (result) {
      console.log('Email sent successfully!');
    } else {
      console.error('Failed to send email.');
    }
  } catch (error) {
    console.error('Error testing email:', error);
  }
}

testEmailSend();