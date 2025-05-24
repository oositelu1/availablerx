# How to Run DocumentTracker

## Quick Start Guide for Beginners

### Step 1: Get a Free Database

1. Go to **[neon.tech](https://neon.tech)**
2. Sign up for a free account
3. Click "Create a project"
4. Copy your connection string (looks like: `postgresql://user:pass@host.neon.tech/dbname`)

### Step 2: Configure the App

1. Open the `.env` file in the DocumentTracker folder
2. Find or add this line:
   ```
   DATABASE_URL="paste-your-neon-connection-string-here"
   ```
3. Save the file

### Step 3: Set Up the Database

Run this command in Terminal (in the DocumentTracker folder):
```bash
npm run db:push
```

### Step 4: Start the App

Run this command:
```bash
npm run dev
```

### Step 5: Open the App

1. Open your web browser
2. Go to: **http://localhost:3000**
3. Login with:
   - Username: **admin**
   - Password: **admin123**

## What Each Command Does

- `npm install` - Installs all required packages
- `npm run db:push` - Creates database tables
- `npm run dev` - Starts the app in development mode
- `npm run build` - Creates production version

## Troubleshooting

### "DATABASE_URL must be set" Error
- Make sure you added the DATABASE_URL to your .env file
- Make sure there are no spaces around the = sign

### "Cannot find module" Error
- Run `npm install` again

### Port 3000 Already in Use
- The app will automatically try port 3001, 3002, etc.
- Or stop the other app using port 3000

### Can't Connect to Database
- Make sure your Neon database is active
- Check that you copied the connection string correctly
- Make sure you're connected to the internet

## Features You Can Try

1. **Upload Files**: Upload EPCIS XML files
2. **Manage Partners**: Add trading partners
3. **Track Inventory**: Scan products in/out
4. **Create T3 Documents**: Generate transaction statements
5. **View Reports**: Check file history and validations

## Need Help?

- Check the console/terminal for error messages
- Make sure all commands are run in the DocumentTracker folder
- Try restarting the app (Ctrl+C to stop, then `npm run dev` again)