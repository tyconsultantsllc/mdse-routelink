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

## Push Notifications (optional)

The app always has an in-app notification bell (drivers get notified when
assigned a route; pharmacies get notified when a delivery is
delivered/failed) - that part works with zero setup. Real push
notifications to a phone - so it shows up even when the app is closed -
additionally need a Firebase project. Until you do this, push sending
silently no-ops and everything else keeps working normally.

### 1. Create a Firebase project

1. Go to the [Firebase Console](https://console.firebase.google.com/) and create a project (or use an existing one).
2. Add an Android app to it with package name `com.mdseroutelink.app` (must match exactly - it's set in `capacitor.config.ts` and `android/app/build.gradle`).
3. Download the `google-services.json` file it gives you and place it at `android/app/google-services.json`. The Android build already knows to pick it up automatically if it's present, and to skip push notifications gracefully if it isn't.

### 2. Get a service account key (for the server to send pushes)

1. In the Firebase Console, go to **Project Settings** → **Service Accounts**.
2. Click **Generate new private key** - this downloads a JSON file. Keep it secret; don't commit it.
3. From that JSON file, take three values for your environment variables (`.env.local` for local dev, Vercel's dashboard for production):
\`\`\`env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMII...\n-----END PRIVATE KEY-----\n"
\`\`\`
   Keep `FIREBASE_PRIVATE_KEY` as one line with literal `\n` sequences (not real line breaks) - that's how the JSON file already has it, and how the app expects to read it back.

### 3. Run the database migration

Run `scripts/030_notifications.sql` in the Supabase SQL Editor (same process as the other numbered scripts above) - it creates the `notifications` and `push_tokens` tables both features rely on.

### 4. Rebuild the Android app

\`\`\`bash
npm install
npx cap sync android
\`\`\`
Then rebuild in Android Studio as usual. The next time someone opens the app and grants the notification permission, their device registers itself automatically.

## Production Deployment

When deploying to Vercel:

1. Connect your repository to Vercel
2. Add environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` - optional, only needed for real push notifications (see "Push Notifications" above)
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
