# Processing Incoming AS2 Files

## Overview
This guide explains the process of monitoring, retrieving, and processing files received through the AWS Transfer for AS2 server.

## File Flow
1. Trading partners send EPCIS files to your AS2 endpoint
2. AWS Transfer for AS2 receives, verifies, and stores files in your S3 bucket
3. Your application retrieves files from S3 for processing
4. After validation, files are made available to your customers via pre-signed URLs

## Monitoring for New Files

### Using AWS SDK
The following code example shows how to monitor an S3 bucket for new files:

```typescript
import AWS from 'aws-sdk';

// Initialize S3 client
const s3 = new AWS.S3({
  region: process.env.AWS_REGION
});

// Function to list newly received files
async function checkForNewFiles() {
  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Prefix: 'as2-incoming/' // The folder configured in your AS2 agreement
  };
  
  try {
    const data = await s3.listObjectsV2(params).promise();
    
    // Process each file
    for (const file of data.Contents || []) {
      // Check if file has been processed before
      const isProcessed = await checkIfProcessed(file.Key);
      
      if (!isProcessed) {
        await processNewFile(file.Key);
      }
    }
  } catch (error) {
    console.error('Error checking for new files:', error);
  }
}
```

### Using SNS/SQS Notifications
For real-time processing, configure S3 event notifications:

1. Set up an SNS topic or SQS queue
2. Configure S3 to send events on file creation
3. Process files when notifications are received

## Retrieving and Processing Files

```typescript
async function processNewFile(fileKey: string) {
  try {
    // Download file from S3
    const fileData = await s3.getObject({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: fileKey
    }).promise();
    
    // Parse and validate the EPCIS file
    const validationResult = await validateEpcisFile(fileData.Body);
    
    if (validationResult.isValid) {
      // Store in database
      const fileId = await storeFileInDatabase(fileKey, fileData.Body);
      
      // Determine the partner for this file
      const partnerId = await determinePartnerFromEpcis(fileData.Body);
      
      // Generate pre-signed URL for partner access
      await createPresignedUrl(fileId, partnerId);
      
      // Mark as processed
      await markFileAsProcessed(fileKey);
    } else {
      // Handle invalid file
      await handleInvalidFile(fileKey, validationResult.errors);
    }
  } catch (error) {
    console.error(`Error processing file ${fileKey}:`, error);
  }
}
```

## Generating Pre-signed URLs

```typescript
async function createPresignedUrl(fileId: number, partnerId: number) {
  try {
    // Get file details
    const file = await storage.getFile(fileId);
    
    // Generate an S3 pre-signed URL that expires in 7 days
    const url = s3.getSignedUrl('getObject', {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: file.storagePath,
      Expires: 7 * 24 * 60 * 60 // 7 days in seconds
    });
    
    // Store the URL in the database
    await storage.createPresignedUrl({
      fileId: fileId,
      partnerId: partnerId,
      url: url,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });
    
    // Notify partner that a file is available (optional)
    await notifyPartnerOfNewFile(partnerId, fileId);
    
    return url;
  } catch (error) {
    console.error(`Error creating pre-signed URL for file ${fileId}:`, error);
    throw error;
  }
}
```

## Implementation Recommendations

1. **Set up a Scheduled Task**
   - Create a cron job or scheduled function to check for new files
   - Run every few minutes to ensure timely processing

2. **Error Handling**
   - Implement retry logic for failed processing attempts
   - Set up alerting for persistent failures
   - Create a quarantine process for problematic files

3. **Monitoring**
   - Track processing metrics (files received, processing time, etc.)
   - Set up CloudWatch alarms for processing failures
   - Create a dashboard for operational visibility

4. **Security Considerations**
   - Ensure IAM roles have minimum required permissions
   - Encrypt sensitive data in transit and at rest
   - Audit access to S3 buckets and file processing

## Integration with Existing Application

To integrate this process with your existing application:

1. Create a new service class for AS2 file monitoring and processing
2. Set up a scheduler to run the monitoring function
3. Enhance the file processing logic to handle AS2-specific requirements
4. Update the pre-signed URL generation to include AS2 file sources