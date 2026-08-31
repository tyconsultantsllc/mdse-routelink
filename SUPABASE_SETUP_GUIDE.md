# Supabase Setup Guide for Local Development

Your Supabase database is already configured with all tables! Follow these steps to connect your local app:

## Step 1: Get Your Supabase Credentials

You can find your credentials in two places:

### Option A: From v0 Workspace (Easiest)
1. Look at the left sidebar in v0
2. Click on "Vars" section
3. Copy the following values:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

### Option B: From Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to Settings → API
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret!)

## Step 2: Create .env.local File

1. In your project root directory (`D:\Thomas\App Projects\MDSE\PharmaTrack Express`), create a file named `.env.local`
2. Copy the contents from `.env.local` file I just created
3. Replace the placeholder values with your actual Supabase credentials

Example:
\`\`\`
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
\`\`\`

## Step 3: Restart the Development Server

1. Stop the server (Ctrl + C)
2. Start it again: `npm run dev`
3. The app will now use real Supabase authentication!

## Step 4: Create Your First Admin User

Since the database is empty, you need to create an admin user:

1. Go to your Supabase dashboard
2. Navigate to Authentication → Users
3. Click "Add user" → "Create new user"
4. Enter:
   - Email: admin@pharmatrack.com (or your preferred email)
   - Password: (choose a secure password)
   - Confirm password
5. Click "Create user"

6. Now go to Table Editor → users table
7. Click "Insert" → "Insert row"
8. Add a row with:
   - id: (copy the user ID from Authentication section)
   - email: admin@pharmatrack.com (same as above)
   - role: admin
   - first_name: Admin
   - last_name: User
   - (other fields are optional)

## Step 5: Login

1. Go to http://localhost:3000
2. Login with your admin credentials
3. You're now using real authentication and database!

## Next Steps

Once logged in as admin, you can:
- Go to Users page to create driver and pharmacy accounts
- Add real pharmacies
- Create routes and assign drivers
- All data will persist in your Supabase database

## Troubleshooting

**If you see "Supabase not configured":**
- Check that `.env.local` file exists in the project root
- Verify the environment variables are spelled correctly
- Make sure there are no spaces around the `=` sign
- Restart the dev server after creating/editing `.env.local`

**If login fails:**
- Verify you created the user in Supabase Authentication
- Verify you added the user to the `users` table with role='admin'
- Check browser console for error messages
