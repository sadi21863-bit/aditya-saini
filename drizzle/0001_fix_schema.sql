-- Migration: Align schema with codebase
-- Run this after 0000 if upgrading from a previous version

-- Add handle column to users if missing
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "handle" text UNIQUE;

-- Ensure ideas uses correct column names (no-ops if already correct)
-- If you are starting fresh, just run: npx drizzle-kit push
