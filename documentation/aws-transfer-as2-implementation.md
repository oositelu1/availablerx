# Implementing AWS Transfer for AS2 in the Application

This guide explains how to modify the existing application code to work with AWS Transfer for AS2 instead of OpenAS2.

## Code Integration Overview

The application has been updated to support both deployment options:
1. Self-hosted OpenAS2 server (original implementation)
2. AWS Transfer for AS2 (managed service implementation)

## Environment Variables

Add these environment variables to your application:

```
# Set to 'true' to use AWS Transfer, 'false' for OpenAS2
USE_AWS_TRANSFER=true

# Required for AWS Transfer
AWS_REGION=us-east-1
AWS_TRANSFER_SERVER_ID=s-abc123xyz
AWS_S3_BUCKET=your-as2-bucket

# Optional AWS configuration
AWS_CONNECTOR_ID_PREFIX=as2-connector-
AWS_LOCAL_AS2_ID=your-company-as2-id
```

## Partner Configuration

When using AWS Transfer for AS2, the following partner fields are essential:

- **as2From**: Your organization's AS2 identifier
- **as2To**: Your partner's AS2 identifier
- **as2Url**: Your partner's AS2 endpoint (where AWS will send the files)
- **partnerSigningCertificate**: Certificate to verify messages from partner
- **partnerEncryptionCertificate**: Certificate to encrypt messages to partner
- **signingCertificate**: Your certificate for signing outgoing messages
- **encryptionCertificate**: Your certificate for decrypting incoming messages

## AWS Transfer Connector Management

For each partner in the system, the application:

1. Checks if an AWS connector exists for this partnership
2. Creates or updates the connector if needed
3. Maps connector statuses to application transmission statuses

Each AWS Connector represents a unique sender-receiver relationship with specific security settings.

## File Transfer Process with AWS Transfer for AS2

### Sending Files:

1. Application identifies the file to send and trading partner
2. Application uploads the file to the designated S3 bucket
3. Application triggers file transfer through AWS Transfer API
4. AWS Transfer handles encryption, signing, and delivery
5. AWS Transfer processes the MDN response
6. Application queries transfer status and updates transmission records

### Receiving Files:

1. Partner sends AS2 file to AWS Transfer endpoint
2. AWS Transfer decrypts, verifies the file signature, and sends MDN
3. AWS Transfer stores the file in the S3 bucket
4. Application processes the file from S3
5. Application creates appropriate file and transmission records

## Error Handling

The application handles several types of errors:

- **Configuration errors**: Missing certificates, incorrect AS2 IDs
- **Connection errors**: Unreachable partner endpoints
- **Security errors**: Certificate validation failures, encryption issues
- **MDN errors**: Missing or invalid receipts

All errors are logged in the application and can be viewed in the transmission details.

## Logging and Monitoring

The application integrates with:

1. Application logs for file processing and transmission status
2. AWS CloudWatch for AWS Transfer operations
3. AWS CloudTrail for security and configuration auditing

## Testing Your Integration

1. Configure a test partner with valid AS2 credentials
2. Send a test file using the application
3. Monitor the progress in both application logs and AWS console
4. Verify file delivery and MDN receipt

## Troubleshooting Common Issues

- **Connection failures**: Verify partner endpoints are correct and accessible
- **Certificate problems**: Ensure certificates are properly formatted and not expired
- **Permission errors**: Check AWS IAM roles and policies
- **S3 access issues**: Verify bucket policies allow Transfer service access
- **MDN configuration**: Ensure MDN settings match between partners