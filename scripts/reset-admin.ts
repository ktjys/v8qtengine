#!/usr/bin/env bun
/**
 * Emergency Admin Password & Recovery Reset CLI
 *
 * Usage:
 *   bun run scripts/reset-admin.ts <new-password>
 *   bun run scripts/reset-admin.ts --generate-code
 *
 * This uses the server-side Supabase client with the SERVICE ROLE key
 * to bypass RLS and directly modify auth.users / recovery_codes.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = (process.env.SUPABASE_URL || '').trim();
const serviceKey = (process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const adminEmail = (process.env.ADMIN_EMAIL || '').trim();

if (!url || !serviceKey) {
  console.error('❌ SUPABASE_URL and SUPABASE_KEY (or SUPABASE_SERVICE_ROLE_KEY) must be set in .env');
  process.exit(1);
}

if (!adminEmail) {
  console.error('❌ ADMIN_EMAIL must be set in .env');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0];

  console.log(`🔐 Quant Engine Admin Reset CLI (Target: ${adminEmail})`);

  // 1. Find admin user
  const { data: listData, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    console.error('❌ Failed to list users:', listErr.message);
    process.exit(1);
  }

  const users = listData?.users || [];
  const adminUser = users.find((u) => u.email === adminEmail);

  if (!adminUser) {
    console.error(`❌ User '${adminEmail}' not found in Supabase Auth.`);
    console.log(`ℹ️  You must first invite or sign up this email via Supabase Dashboard.`);
    process.exit(1);
  }

  // 2. Ensure profile exists
  const { error: profErr } = await supabase.rpc('ensure_admin_profile', {
    p_user_id: adminUser.id,
    p_email: adminEmail,
  });
  if (profErr) {
    console.warn('⚠️  Could not run ensure_admin_profile RPC (will continue):', profErr.message);
  }

  if (mode === '--generate-code' || mode === '-c') {
    // Generate one-time recovery code
    const code = Array.from({ length: 8 }, () =>
      'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]
    ).join('');

    const { error: hashErr } = await supabase.rpc('create_recovery_code', {
      p_profile_id: adminUser.id,
      p_code: code,
    });

    if (hashErr) {
      console.error('❌ Failed to generate recovery code in DB:', hashErr.message);
      process.exit(1);
    }

    console.log('\n============================================================');
    console.log(`🔑 ONE-TIME RECOVERY CODE:  ${code}`);
    console.log('============================================================');
    console.log('⚠️  Store this code securely. It is hashed in DB and cannot be recovered.');
    console.log('    Use it in the login modal if email delivery ever fails.\n');
  } else if (mode && !mode.startsWith('-')) {
    // Reset password
    const newPassword = mode;
    if (newPassword.length < 8) {
      console.error('❌ Password must be at least 8 characters long');
      process.exit(1);
    }

    const { error: updateErr } = await supabase.auth.admin.updateUserById(adminUser.id, {
      password: newPassword,
    });

    if (updateErr) {
      console.error('❌ Failed to update password:', updateErr.message);
      process.exit(1);
    }

    console.log(`✅ Password successfully updated for ${adminEmail}`);
  } else {
    console.log('\nUsage:');
    console.log('  bun run scripts/reset-admin.ts <new-password>      # Reset password directly');
    console.log('  bun run scripts/reset-admin.ts --generate-code    # Generate 8-char recovery code');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});