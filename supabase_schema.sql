-- PIN Chat v2.2 Supabase Schema (Media storage, group admin, members, presence)

-- 1. Users Table
CREATE TABLE IF NOT EXISTS schatpin_users (
    id SERIAL PRIMARY KEY,
    pin TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    avatar TEXT,
    status TEXT DEFAULT 'Available',
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
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
    media_url TEXT,
    media_type TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    is_read BOOLEAN DEFAULT FALSE
);

-- 4. Groups Table
CREATE TABLE IF NOT EXISTS schatpin_groups (
    id SERIAL PRIMARY KEY,
    group_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    admin_pin TEXT NOT NULL,
    avatar TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. Group Members Table
CREATE TABLE IF NOT EXISTS schatpin_group_members (
    id SERIAL PRIMARY KEY,
    group_id TEXT NOT NULL,
    user_pin TEXT NOT NULL,
    user_name TEXT,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(group_id, user_pin)
);

-- 6. Group Messages Table
CREATE TABLE IF NOT EXISTS schatpin_group_messages (
    id SERIAL PRIMARY KEY,
    group_id TEXT NOT NULL,
    sender_pin TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    message TEXT NOT NULL,
    media_url TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE schatpin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE schatpin_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE schatpin_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE schatpin_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE schatpin_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE schatpin_group_messages ENABLE ROW LEVEL SECURITY;

-- Permissive policies
CREATE POLICY "Allow all users" ON schatpin_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all contacts" ON schatpin_contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all messages" ON schatpin_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all groups" ON schatpin_groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all group members" ON schatpin_group_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all group messages" ON schatpin_group_messages FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE schatpin_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE schatpin_group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE schatpin_users;
