# AS2 Single Bucket Architecture

## Overview

DocumentTracker uses a **single S3 bucket with separate prefixes** for each receiving partner. This architecture is simpler, more cost-efficient, and easier to manage than multiple buckets.

## Architecture

```
Single S3 Bucket: documenttracker-as2-bucket
│
├── receivers/
│   ├── 1234567890123/        (Partner A - using GLN as prefix)
│   │   ├── file1.xml
│   │   └── file2.zip
│   │
│   ├── 9876543210987/        (Partner B - using GLN as prefix)
│   │   ├── file3.xml
│   │   └── file4.zip
│   │
│   └── partner-15/           (Partner C - using ID if no GLN)
│       └── file5.xml
│
└── outbound/                  (Optional: for sending files)
    └── ...
```

## Configuration

### 1. Environment Variables

```env
# Single bucket for all AS2 transfers
AWS_S3_AS2_BUCKET=documenttracker-as2-bucket

# AWS region
AWS_REGION=us-east-1

# Your AS2 server ID (if using central hub model)
AWS_TRANSFER_SERVER_ID=s-7eb939c89a5c49e98
```

### 2. Partner Configuration

Each receiver partner needs:

```json
{
  "companyName": "Medical Distributor ABC",
  "transportType": "AS2",
  "as2ServerId": "s-abc123...",          // Their AS2 server ID
  "s3Prefix": "receivers/1234567890123/", // Auto-generated from GLN
  "gln": "1234567890123",
  "email": "notifications@distributor.com"
}
```

### 3. AWS AS2 Connector Configuration

In AWS Transfer Family, configure each AS2 connector to write to the specific prefix:

```
Base Directory: /receivers/[partner-gln]/
```

## Benefits

1. **Single Bucket Policy**: One set of permissions to manage
2. **Cost Efficient**: No per-bucket charges
3. **Easier Monitoring**: One bucket to watch
4. **Simple Scaling**: Just add new prefixes
5. **Centralized Logging**: All S3 access logs in one place

## File Flow

1. **Sender (Manufacturer)** sends EPCIS file via AS2
2. **AWS Transfer** receives and writes to: `receivers/[partner-gln]/filename.xml`
3. **DocumentTracker** monitors all prefixes under `receivers/`
4. **Processing**:
   - Validates EPCIS file
   - Extracts sender GLN from file
   - Stores in database
   - Generates pre-signed URL
5. **Notification** sent to receiver with download link

## API Endpoints

### Monitor Status
```
GET /api/multi-as2/status
```

### Start Monitoring
```
POST /api/multi-as2/start
{
  "intervalMinutes": 5
}
```

### Check Specific Receiver
```
POST /api/multi-as2/check-receiver/[partnerId]
```

### Update Receiver Prefix
```
PUT /api/multi-as2/update-prefix/[partnerId]
{
  "prefix": "receivers/new-gln/"
}
```

## Automatic Prefix Generation

If no S3 prefix is specified, the system automatically generates one:

- **With GLN**: `receivers/[gln]/`
- **Without GLN**: `receivers/partner-[id]/`

## Security

- Each partner can only write to their designated prefix (configured in AWS)
- Pre-signed URLs are time-limited (7 days)
- All file access is logged
- Files are validated before processing

## Migration from Multi-Bucket

If migrating from multiple buckets:

1. Copy existing files to new prefixes
2. Update partner records with new prefixes
3. Reconfigure AS2 connectors
4. Start single-bucket monitoring

## Best Practices

1. Use GLNs for prefix naming when possible
2. Include trailing slash in prefix configuration
3. Set up S3 lifecycle policies for automatic cleanup
4. Monitor bucket size and set up alerts
5. Use S3 versioning for file recovery