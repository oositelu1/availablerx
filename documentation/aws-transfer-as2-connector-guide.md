# Creating AS2 Connectors in AWS Transfer Family

## Overview
This guide explains how to create and configure AS2 connectors in AWS Transfer Family to send files to your trading partners.

## Prerequisites
- AWS Transfer for AS2 server is set up and running
- Local profile and certificates are configured
- Partner profile is created
- Trading partner's AS2 endpoint is available and accessible

## Steps to Create an AS2 Connector

1. **Navigate to AWS Transfer Family**
   - Open the AWS Management Console
   - Go to AWS Transfer Family
   - Click on "AS2 Trading Partners" in the left navigation

2. **Access Connector Creation**
   - Click on "Connectors to send messages"
   - Click on "Create connector" button

3. **Configure Connector Details**
   - **URL**: Enter your partner's AS2 endpoint URL
   - **Access Role**: Select the IAM role for accessing S3 (typically the same role used for agreements)
   - **Logging**: Configure CloudWatch logging options as needed

4. **Configure Trading Partners**
   - **Local profile**: Select your organization's AS2 profile
   - **Partner profile**: Select the trading partner's profile

5. **Configure AS2 Properties**
   - **Subject**: Enter a subject for outgoing messages (e.g., "EPCIS AS2 Message")
   - **Compression**: Enable/disable data compression
   - **Encryption algorithm**: Select the encryption algorithm (AES256 recommended)
   - **Signing algorithm**: Select the signing algorithm (SHA256 recommended)
   - **MDN settings**: Configure Message Disposition Notification settings
     - Signed: Enable/disable MDN signing
     - Synchronous: Enable for immediate MDN responses, disable for asynchronous MDNs
     - URL: If using asynchronous MDNs, enter the URL where MDNs should be sent

6. **Complete Connector Creation**
   - Review the settings
   - Click "Create connector"

## Configuring Partner Records

After creating a connector, update your partner record in the application:

1. **Get the Connector ID**
   - In AWS Transfer, find the newly created connector
   - Copy the Connector ID (format: `c-xxxxxxxxxx`)

2. **Update Partner Record**
   - In the Partner Management interface, edit the partner
   - In the AS2 Configuration section, paste the Connector ID into the appropriate field
   - Save the partner record

## Testing the Connector

To test the connector:

1. Create a small test file
2. Use the "Send File" function with the partner you've configured
3. Check the logs for successful transmission
4. Verify that your partner received the file
5. Check for proper MDN receipt

## Troubleshooting

Common issues with connectors:

- **Connection failures**: Verify partner endpoint URL is correct and accessible
- **Certificate errors**: Confirm certificates are valid and properly configured
- **MDN issues**: Check MDN configuration and partner's ability to send MDNs
- **Permission errors**: Verify IAM role has proper permissions for S3 access