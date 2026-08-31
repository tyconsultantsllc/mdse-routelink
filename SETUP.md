# PharmaTrack Express Setup Guide

## Prerequisites
- Node.js 18+ installed
- A Supabase account (free tier works fine)

## Local Development Setup

### 1. Install Dependencies
\`\`\`bash
npm install
\`\`\`

### 2. Set Up Supabase

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create a new project (or use an existing one)
3. Once created, go to **Project Settings** → **API**
4. Copy the following values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

### 3. Configure Environment Variables

1. Create a `.env.local` file in the root directory:
\`\`\`bash
cp .env.local.example .env.local
\`\`\`

2. Edit `.env.local` and add your Supabase credentials:
\`\`\`env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000
\`\`\`

### 4. Set Up Database

Run the SQL scripts in order from the `scripts` folder in your Supabase SQL Editor:

1. **001_create_schema.sql** - Creates all tables and RLS policies
2. **002_create_user_trigger.sql** - Sets up automatic user profile creation
3. **003_seed_data.sql** - Adds demo data (pharmacies, test users, routes)

To run scripts in Supabase:
1. Go to **SQL Editor** in your Supabase dashboard
2. Click **New Query**
3. Copy and paste the contents of each script
4. Click **Run** for each script in order

### 5. Start Development Server

\`\`\`bash
npm run dev
\`\`\`

Visit [http://localhost:3000](http://localhost:3000)

### 6. Login Credentials (After Seeding)

The seed script creates these demo accounts:
- **Admin**: admin@pharmatrack.com / admin123
- **Driver**: driver@pharmatrack.com / driver123  
- **Pharmacy**: pharmacy@cvs.com / pharmacy123

## Production Deployment

When deploying to Vercel:

1. Connect your repository to Vercel
2. Add environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy!

## Troubleshooting

### "Your project's URL and Key are required"
- Make sure `.env.local` exists and has valid Supabase credentials
- Restart the dev server after creating `.env.local`

### Database errors
- Ensure all SQL scripts ran successfully in order
- Check Supabase logs for specific error messages

### Authentication issues
- Verify your Supabase project URL and anon key are correct
- Check that the `users` table exists and has RLS policies enabled
