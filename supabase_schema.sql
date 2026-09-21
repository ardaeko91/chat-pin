-- Run this in your Supabase SQL Editor to set up tables for PIN Chat (schatpin prefix)

-- 1. Users Table
CREATE TABLE IF NOT EXISTS schatpin_users (
    id SERIAL PRIMARY KEY,
    pin TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    avatar TEXT,
    status TEXT DEFAULT 'Available',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Contacts Table
CREATE TABLE IF NOT EXISTS schatpin_contacts (
    id SERIAL PRIMARY KEY,
    user_pin TEXT NOT NULL,
    contact_pin TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_pin, contact_pin)
);

-- 3. Messages Table
CREATE TABLE IF NOT EXISTS schatpin_messages (
    id SERIAL PRIMARY KEY,
    sender_pin TEXT NOT NULL,
    receiver_pin TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    is_read BOOLEAN DEFAULT FALSE
);

-- Enable RLS
ALTER TABLE schatpin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE schatpin_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE schatpin_messages ENABLE ROW LEVEL SECURITY;

-- Create permissive policies
CREATE POLICY "Allow all schatpin_users" ON schatpin_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all schatpin_contacts" ON schatpin_contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all schatpin_messages" ON schatpin_messages FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime for schatpin_messages table
ALTER PUBLICATION supabase_realtime ADD TABLE schatpin_messages;
