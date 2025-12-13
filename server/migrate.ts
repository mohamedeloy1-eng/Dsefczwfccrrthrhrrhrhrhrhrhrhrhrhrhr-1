import { db, pool } from "./db";
import { sql } from "drizzle-orm";

export async function runMigrations() {
  console.log("Running database migrations...");
  
  try {
    await db.execute(sql`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_classification') THEN
          CREATE TYPE user_classification AS ENUM ('normal', 'test', 'spam');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_tier') THEN
          CREATE TYPE subscription_tier AS ENUM ('free', 'basic', 'premium', 'vip');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'log_status') THEN
          CREATE TYPE log_status AS ENUM ('success', 'failed', 'blocked', 'rate_limited');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'log_direction') THEN
          CREATE TYPE log_direction AS ENUM ('incoming', 'outgoing');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'log_message_type') THEN
          CREATE TYPE log_message_type AS ENUM ('text', 'image', 'sticker', 'voice', 'error', 'system');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'schedule_status') THEN
          CREATE TYPE schedule_status AS ENUM ('pending', 'sent', 'failed', 'cancelled');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reminder_status') THEN
          CREATE TYPE reminder_status AS ENUM ('active', 'triggered', 'cancelled');
        END IF;
      END $$;
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS subscription_tiers (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(50) NOT NULL UNIQUE,
        tier subscription_tier NOT NULL UNIQUE,
        messages_per_minute INTEGER DEFAULT 20 NOT NULL,
        messages_per_day INTEGER DEFAULT 500 NOT NULL,
        voice_messages_enabled BOOLEAN DEFAULT false NOT NULL,
        scheduling_enabled BOOLEAN DEFAULT false NOT NULL,
        analytics_enabled BOOLEAN DEFAULT false NOT NULL,
        priority INTEGER DEFAULT 0 NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS whatsapp_users (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        phone_number VARCHAR(20) NOT NULL UNIQUE,
        name TEXT NOT NULL,
        classification user_classification DEFAULT 'normal' NOT NULL,
        subscription_tier subscription_tier DEFAULT 'free' NOT NULL,
        is_blocked BOOLEAN DEFAULT false NOT NULL,
        message_limit INTEGER DEFAULT 20 NOT NULL,
        total_messages_sent INTEGER DEFAULT 0 NOT NULL,
        total_messages_received INTEGER DEFAULT 0 NOT NULL,
        messages_today INTEGER DEFAULT 0 NOT NULL,
        last_activity TIMESTAMP DEFAULT NOW() NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        session_id VARCHAR,
        error_count INTEGER DEFAULT 0 NOT NULL,
        last_error TEXT
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_memory (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        phone_number VARCHAR(20) NOT NULL,
        key VARCHAR(100) NOT NULL,
        value TEXT NOT NULL,
        category VARCHAR(50) DEFAULT 'general' NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS conversations (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        phone_number VARCHAR(20) NOT NULL,
        session_id VARCHAR NOT NULL,
        last_message TEXT,
        unread_count INTEGER DEFAULT 0 NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id VARCHAR NOT NULL,
        content TEXT NOT NULL,
        is_bot BOOLEAN DEFAULT false NOT NULL,
        message_type log_message_type DEFAULT 'text' NOT NULL,
        timestamp TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS message_logs (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        timestamp TIMESTAMP DEFAULT NOW() NOT NULL,
        direction log_direction NOT NULL,
        phone_number VARCHAR(20) NOT NULL,
        session_id VARCHAR NOT NULL,
        content TEXT NOT NULL,
        message_type log_message_type NOT NULL,
        status log_status NOT NULL,
        error_message TEXT
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS scheduled_messages (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        phone_number VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        scheduled_at TIMESTAMP NOT NULL,
        status schedule_status DEFAULT 'pending' NOT NULL,
        session_id VARCHAR,
        repeat_type VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        sent_at TIMESTAMP,
        error_message TEXT
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS reminders (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        phone_number VARCHAR(20) NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        remind_at TIMESTAMP NOT NULL,
        status reminder_status DEFAULT 'active' NOT NULL,
        session_id VARCHAR,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        triggered_at TIMESTAMP
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS welcome_messages (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id VARCHAR,
        message TEXT NOT NULL,
        is_enabled BOOLEAN DEFAULT true NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS reply_templates (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(100) NOT NULL,
        content TEXT NOT NULL,
        category VARCHAR(50) DEFAULT 'general' NOT NULL,
        shortcut VARCHAR(20),
        is_active BOOLEAN DEFAULT true NOT NULL,
        usage_count INTEGER DEFAULT 0 NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS interactive_buttons (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id VARCHAR,
        label VARCHAR(50) NOT NULL,
        action VARCHAR(100) NOT NULL,
        payload JSONB,
        "order" INTEGER DEFAULT 0 NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS analytics_snapshots (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        date TIMESTAMP NOT NULL,
        total_messages INTEGER DEFAULT 0 NOT NULL,
        incoming_messages INTEGER DEFAULT 0 NOT NULL,
        outgoing_messages INTEGER DEFAULT 0 NOT NULL,
        total_users INTEGER DEFAULT 0 NOT NULL,
        new_users INTEGER DEFAULT 0 NOT NULL,
        active_users INTEGER DEFAULT 0 NOT NULL,
        blocked_users INTEGER DEFAULT 0 NOT NULL,
        voice_messages INTEGER DEFAULT 0 NOT NULL,
        scheduled_messages INTEGER DEFAULT 0 NOT NULL,
        top_questions JSONB,
        peak_hours JSONB,
        session_id VARCHAR,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS whatsapp_sessions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id VARCHAR(50) NOT NULL UNIQUE,
        phone_number VARCHAR(20),
        name VARCHAR(100),
        is_active BOOLEAN DEFAULT false NOT NULL,
        is_connected BOOLEAN DEFAULT false NOT NULL,
        priority INTEGER DEFAULT 0 NOT NULL,
        max_load INTEGER DEFAULT 100 NOT NULL,
        current_load INTEGER DEFAULT 0 NOT NULL,
        last_activity TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS security_settings (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        key VARCHAR(50) NOT NULL UNIQUE,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS bot_settings (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        key VARCHAR(50) NOT NULL UNIQUE,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS external_integrations (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(50) NOT NULL UNIQUE,
        type VARCHAR(30) NOT NULL,
        is_enabled BOOLEAN DEFAULT false NOT NULL,
        config JSONB,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS voice_settings (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        is_enabled BOOLEAN DEFAULT false NOT NULL,
        tts_voice VARCHAR(50) DEFAULT 'alloy' NOT NULL,
        stt_enabled BOOLEAN DEFAULT true NOT NULL,
        auto_voice_reply BOOLEAN DEFAULT false NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    await seedDefaultData();
    
    console.log("Database migrations completed successfully!");
  } catch (error) {
    console.error("Migration error:", error);
    throw error;
  }
}

async function seedDefaultData() {
  const existingTiers = await db.execute(sql`SELECT COUNT(*) as count FROM subscription_tiers`);
  const count = (existingTiers.rows[0] as any)?.count || 0;
  
  if (parseInt(count) === 0) {
    await db.execute(sql`
      INSERT INTO subscription_tiers (name, tier, messages_per_minute, messages_per_day, voice_messages_enabled, scheduling_enabled, analytics_enabled, priority)
      VALUES 
        ('مجاني', 'free', 10, 100, false, false, false, 0),
        ('أساسي', 'basic', 20, 500, false, true, false, 1),
        ('متميز', 'premium', 50, 2000, true, true, true, 2),
        ('VIP', 'vip', 100, 10000, true, true, true, 3)
    `);
    console.log("Default subscription tiers created");
  }

  const existingWelcome = await db.execute(sql`SELECT COUNT(*) as count FROM welcome_messages`);
  const welcomeCount = (existingWelcome.rows[0] as any)?.count || 0;
  
  if (parseInt(welcomeCount) === 0) {
    await db.execute(sql`
      INSERT INTO welcome_messages (message, is_enabled)
      VALUES ('مرحباً بك! 👋 أنا GX-MODY، مساعدك الذكي على واتساب. كيف يمكنني مساعدتك اليوم؟', true)
    `);
    console.log("Default welcome message created");
  }

  const existingVoice = await db.execute(sql`SELECT COUNT(*) as count FROM voice_settings`);
  const voiceCount = (existingVoice.rows[0] as any)?.count || 0;
  
  if (parseInt(voiceCount) === 0) {
    await db.execute(sql`
      INSERT INTO voice_settings (is_enabled, tts_voice, stt_enabled, auto_voice_reply)
      VALUES (false, 'alloy', true, false)
    `);
    console.log("Default voice settings created");
  }
}
