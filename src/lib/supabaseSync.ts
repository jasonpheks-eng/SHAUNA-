import { SupabaseClient } from '@supabase/supabase-js';
import { BoutiqueSettings, ServiceItem } from '../types';

export interface SupabaseSyncResult {
  success: boolean;
  code?: string;
  message: string;
  details?: string;
}

export interface SupabaseHealthStatus {
  connected: boolean;
  settingsTable: 'ready' | 'missing' | 'permission_denied' | 'error';
  servicesTable: 'ready' | 'missing' | 'permission_denied' | 'error';
  appointmentsTable: 'ready' | 'missing' | 'permission_denied' | 'error';
  message: string;
}

/**
 * SQL script for setting up the required Supabase tables with appropriate Row Level Security (RLS) policies.
 * Can be copied directly and run in the Supabase SQL Editor.
 */
export const SUPABASE_SETUP_SQL = `-- ==============================================================
-- MT Mansion Boutique: Supabase Tables & Permissive RLS Setup
-- Copy and paste this script directly into your Supabase SQL Editor
-- (https://supabase.com/dashboard/project/_/sql) and click "Run".
-- ==============================================================

-- 1. Boutique Settings Table (stores hero color, tagline, theme, etc.)
CREATE TABLE IF NOT EXISTS public.boutique_settings (
  id text PRIMARY KEY DEFAULT 'current',
  hero_bg_color text,
  hero_accent_color text,
  boutique_name text,
  tagline text,
  whatsapp_number text,
  hero_description text,
  settings jsonb,
  updated_at timestamptz DEFAULT now()
);

-- 2. Services Catalog Table (treatments, pricing, duration, active status)
CREATE TABLE IF NOT EXISTS public.services (
  id text PRIMARY KEY,
  category text NOT NULL,
  number text,
  title text NOT NULL,
  description text,
  price numeric DEFAULT 0,
  duration_min int DEFAULT 60,
  hide_duration boolean DEFAULT false,
  is_popular boolean DEFAULT false,
  is_active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

-- 3. Appointments Table
CREATE TABLE IF NOT EXISTS public.appointments (
  id text PRIMARY KEY,
  client_name text NOT NULL,
  client_phone text,
  client_email text,
  service_id text,
  service_title text,
  category text,
  date text NOT NULL,
  time_slot text NOT NULL,
  notes text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.boutique_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- 5. Drop old policies if they exist to prevent duplicate errors
DROP POLICY IF EXISTS "Public Access for boutique_settings" ON public.boutique_settings;
DROP POLICY IF EXISTS "Public Access for services" ON public.services;
DROP POLICY IF EXISTS "Public Access for appointments" ON public.appointments;

-- 6. Create Permissive Policies for public/anon web client access
CREATE POLICY "Public Access for boutique_settings" ON public.boutique_settings
  FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Public Access for services" ON public.services
  FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Public Access for appointments" ON public.appointments
  FOR ALL TO public USING (true) WITH CHECK (true);
`;

export interface SupabaseExtraState {
  imageSlots?: import('../types').ImageSlots;
  calendarSlots?: import('../types').CalendarTimeSlot[];
  updatedAt?: number;
}

/**
 * Handles saving boutique settings (hero color, boutique name, typography, etc.) to Supabase.
 * Optionally bundles imageSlots, calendarSlots, and numeric updatedAt inside the settings JSONB payload
 * so Vercel cold starts and client devices stay 100% synchronized without requiring extra tables.
 */
export async function syncSettingsToSupabase(
  client: SupabaseClient,
  settings: Partial<BoutiqueSettings>,
  extra?: SupabaseExtraState
): Promise<SupabaseSyncResult> {
  if (!client) {
    return {
      success: false,
      code: 'NO_CLIENT',
      message: 'Supabase client is not initialized. Please verify your Project URL and Anon Key in Settings.',
    };
  }

  const syncTimestamp = extra?.updatedAt || Date.now();
  const buildSettingsJson = (omitLargeDataUris = false) => {
    const cleanSettings: Record<string, any> = { ...(settings || {}) };
    delete cleanSettings._image_slots;
    delete cleanSettings._calendar_slots;
    delete cleanSettings._updated_at;

    let packedImages = extra?.imageSlots;
    if (packedImages && omitLargeDataUris) {
      const cloned: Record<string, any> = { ...packedImages };
      for (const [k, v] of Object.entries(cloned)) {
        if (typeof v === 'string' && v.startsWith('data:') && v.length > 200000) {
          delete cloned[k];
        }
      }
      packedImages = cloned as any;
    }

    return {
      ...cleanSettings,
      ...(packedImages ? { _image_slots: packedImages } : {}),
      ...(Array.isArray(extra?.calendarSlots) ? { _calendar_slots: extra.calendarSlots } : {}),
      _updated_at: syncTimestamp,
    };
  };

  try {
    // Primary approach: Upsert into boutique_settings table with structured columns + json payload
    const makePayload = (omitLargeDataUris = false) => ({
      id: 'current',
      hero_bg_color: settings.hero_bg_color,
      hero_accent_color: settings.hero_accent_color,
      boutique_name: settings.boutique_name,
      tagline: settings.tagline,
      whatsapp_number: settings.whatsapp_number,
      hero_description: settings.hero_description,
      settings: buildSettingsJson(omitLargeDataUris),
      updated_at: new Date(syncTimestamp).toISOString(),
    });

    let { error } = await client
      .from('boutique_settings')
      .upsert(makePayload(false), { onConflict: 'id' });

    // Retry without large inline data URIs if request payload exceeded REST limits
    if (
      error &&
      extra?.imageSlots &&
      (error.code === '413' ||
        error.message?.toLowerCase().includes('payload') ||
        error.message?.toLowerCase().includes('too large'))
    ) {
      const retryRes = await client
        .from('boutique_settings')
        .upsert(makePayload(true), { onConflict: 'id' });
      error = retryRes.error;
    }

    if (!error) {
      return {
        success: true,
        message: 'Boutique settings saved to Supabase (boutique_settings)! Changes persist permanently in the cloud.',
      };
    }

    // Permission denied: RLS policy blocked insert/update
    if (
      error.code === '42501' ||
      error.message?.toLowerCase().includes('row-level security') ||
      error.message?.toLowerCase().includes('permission')
    ) {
      return {
        success: false,
        code: error.code || 'RLS_DENIED',
        message: 'Supabase RLS Policy: Permission denied for table "boutique_settings". Run the permissive SQL script in your Supabase SQL editor to allow updates.',
        details: error.message,
      };
    }

    // Table does not exist in schema cache
    if (
      error.code === 'PGRST205' ||
      error.code === '42P01' ||
      error.message?.toLowerCase().includes('could not find the table')
    ) {
      // Fallback: try saving to generic 'settings' table if user named it that way
      const fallbackResult = await client
        .from('settings')
        .upsert({ id: 'current', ...settings, updated_at: new Date(syncTimestamp).toISOString() });

      if (!fallbackResult.error) {
        return {
          success: true,
          message: 'Boutique settings saved to Supabase ("settings" table)!',
        };
      }

      return {
        success: false,
        code: error.code || 'TABLE_NOT_FOUND',
        message: 'Table "boutique_settings" not found in Supabase schema. Copy the SQL setup from the Supabase tab to create it.',
        details: error.message,
      };
    }

    // If column mismatch error (e.g. custom table with different column names), try saving as raw JSON
    if (
      error.code === '42703' ||
      error.code === 'PGRST204' ||
      error.message?.toLowerCase().includes('column')
    ) {
      const jsonOnly = await client
        .from('boutique_settings')
        .upsert(
          { id: 'current', settings: buildSettingsJson(false), updated_at: new Date(syncTimestamp).toISOString() },
          { onConflict: 'id' }
        );
      if (!jsonOnly.error) {
        return {
          success: true,
          message: 'Boutique settings saved to Supabase (JSON column)!',
        };
      }
    }

    return {
      success: false,
      code: error.code,
      message: `Supabase save warning: ${error.message}`,
      details: error.details,
    };
  } catch (err: any) {
    return {
      success: false,
      code: 'NETWORK_ERROR',
      message: `Failed to connect to Supabase: ${err.message || 'Unknown network error'}`,
    };
  }
}

/**
 * Handles saving services catalog to Supabase.
 * Checks and handles database permissions and table existence appropriately.
 */
export async function syncServicesToSupabase(
  client: SupabaseClient,
  services: ServiceItem[]
): Promise<SupabaseSyncResult> {
  if (!client) {
    return {
      success: false,
      code: 'NO_CLIENT',
      message: 'Supabase client is not initialized. Please verify your Project URL and Anon Key in Settings.',
    };
  }

  if (!Array.isArray(services)) {
    return {
      success: false,
      code: 'INVALID_DATA',
      message: 'Invalid services list.',
    };
  }

  try {
    const keepIds = new Set(services.map((s) => s.id));

    if (services.length > 0) {
      const rows = services.map((s, idx) => ({
        id: s.id,
        category: s.category,
        number: s.number || String(idx + 1).padStart(2, '0'),
        title: s.title,
        description: s.description || '',
        price: Number(s.price) || 0,
        duration_min: Number(s.duration_min) || 60,
        hide_duration: Boolean(s.hide_duration),
        is_popular: Boolean(s.is_popular),
        is_active: s.is_active !== false,
        updated_at: new Date().toISOString(),
      }));

      let { error } = await client
        .from('services')
        .upsert(rows, { onConflict: 'id' });

      // Fallback if optional columns (hide_duration / is_popular) aren't in Postgres schema yet
      if (
        error &&
        (error.code === '42703' ||
          error.code === 'PGRST204' ||
          error.message?.toLowerCase().includes('column'))
      ) {
        const basicRows = services.map((s, idx) => ({
          id: s.id,
          category: s.category,
          number: s.number || String(idx + 1).padStart(2, '0'),
          title: s.title,
          description: s.description || '',
          price: Number(s.price) || 0,
          duration_min: Number(s.duration_min) || 60,
          is_active: s.is_active !== false,
          updated_at: new Date().toISOString(),
        }));
        const retryRes = await client
          .from('services')
          .upsert(basicRows, { onConflict: 'id' });
        error = retryRes.error;
      }

      if (error) {
        // Handle errors below
        if (
          error.code === '42501' ||
          error.message?.toLowerCase().includes('row-level security') ||
          error.message?.toLowerCase().includes('permission')
        ) {
          return {
            success: false,
            code: error.code || 'RLS_DENIED',
            message: 'Supabase RLS Policy: Permission denied for table "services". Run the permissive SQL script in your Supabase SQL editor to allow updates.',
            details: error.message,
          };
        }

        if (
          error.code === 'PGRST205' ||
          error.code === '42P01' ||
          error.message?.toLowerCase().includes('could not find the table')
        ) {
          return {
            success: false,
            code: error.code || 'TABLE_NOT_FOUND',
            message: 'Table "services" not found in Supabase schema. Copy the SQL setup from the Supabase tab to create it.',
            details: error.message,
          };
        }

        return {
          success: false,
          code: error.code,
          message: `Supabase services sync warning: ${error.message}`,
          details: error.details,
        };
      }
    }

    // Delete any services that were removed by admin so they don't reappear on reload
    const { data: existingRows } = await client.from('services').select('id');
    if (Array.isArray(existingRows) && existingRows.length > 0) {
      const removedIds = existingRows
        .map((r: any) => r.id)
        .filter((id: string) => !keepIds.has(id));
      if (removedIds.length > 0) {
        await client.from('services').delete().in('id', removedIds);
      }
    }

    return {
      success: true,
      message: `Successfully synced ${services.length} services to Supabase database! Changes persist permanently in the cloud.`,
    };
  } catch (err: any) {
    return {
      success: false,
      code: 'NETWORK_ERROR',
      message: `Failed to connect to Supabase: ${err.message || 'Unknown network error'}`,
    };
  }
}

/**
 * Loads boutique settings (and embedded imageSlots/calendarSlots/updatedAt) from Supabase if table exists.
 */
export async function fetchSettingsFromSupabase(
  client: SupabaseClient
): Promise<{
  success: boolean;
  settings?: Partial<BoutiqueSettings>;
  imageSlots?: Partial<import('../types').ImageSlots>;
  calendarSlots?: import('../types').CalendarTimeSlot[];
  updatedAt?: number;
  error?: string;
}> {
  if (!client) return { success: false, error: 'No client' };
  try {
    const { data, error } = await client
      .from('boutique_settings')
      .select('*')
      .eq('id', 'current')
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }
    if (!data) {
      return { success: false, error: 'No row found' };
    }

    const rawSettings: Record<string, any> = { ...(data.settings || {}) };
    const imageSlots = rawSettings._image_slots as Partial<import('../types').ImageSlots> | undefined;
    const calendarSlots = Array.isArray(rawSettings._calendar_slots)
      ? (rawSettings._calendar_slots as import('../types').CalendarTimeSlot[])
      : undefined;
    const embeddedTs = Number(rawSettings._updated_at || 0);
    const columnTs = data.updated_at ? Date.parse(data.updated_at) || 0 : 0;
    const updatedAt = embeddedTs > 0 ? embeddedTs : columnTs;

    delete rawSettings._image_slots;
    delete rawSettings._calendar_slots;
    delete rawSettings._updated_at;

    // Extract settings from json payload or columns
    const extracted: Partial<BoutiqueSettings> = {
      ...rawSettings,
      ...(data.hero_bg_color ? { hero_bg_color: data.hero_bg_color } : {}),
      ...(data.hero_accent_color ? { hero_accent_color: data.hero_accent_color } : {}),
      ...(data.boutique_name ? { boutique_name: data.boutique_name } : {}),
      ...(data.tagline ? { tagline: data.tagline } : {}),
      ...(data.whatsapp_number ? { whatsapp_number: data.whatsapp_number } : {}),
      ...(data.hero_description ? { hero_description: data.hero_description } : {}),
    };

    return {
      success: true,
      settings: extracted,
      imageSlots,
      calendarSlots,
      updatedAt,
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Loads services list from Supabase if table exists.
 */
export async function fetchServicesFromSupabase(
  client: SupabaseClient
): Promise<{ success: boolean; services?: ServiceItem[]; updatedAt?: number; error?: string }> {
  if (!client) return { success: false, error: 'No client' };
  try {
    const { data, error } = await client
      .from('services')
      .select('*')
      .order('number', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }
    if (!data || data.length === 0) {
      return { success: false, error: 'Empty table' };
    }

    let maxUpdatedAt = 0;
    const mapped: ServiceItem[] = data.map((row) => {
      const ts = row.updated_at ? Date.parse(row.updated_at) || 0 : 0;
      if (ts > maxUpdatedAt) maxUpdatedAt = ts;
      return {
        id: row.id,
        category: row.category as any,
        number: row.number,
        title: row.title,
        description: row.description,
        price: Number(row.price),
        duration_min: Number(row.duration_min),
        is_active: row.is_active !== false,
        is_popular: row.is_popular,
        hide_duration: Boolean(row.hide_duration),
      };
    });

    return { success: true, services: mapped, updatedAt: maxUpdatedAt };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Runs a health check on the tables and returns detailed permission & existence status.
 */
export async function checkSupabaseHealth(client: SupabaseClient): Promise<SupabaseHealthStatus> {
  if (!client) {
    return {
      connected: false,
      settingsTable: 'error',
      servicesTable: 'error',
      appointmentsTable: 'error',
      message: 'Client not configured',
    };
  }

  const checkTable = async (tableName: string): Promise<'ready' | 'missing' | 'permission_denied' | 'error'> => {
    try {
      const { error } = await client.from(tableName).select('id').limit(1);
      if (!error) return 'ready';
      if (
        error.code === '42501' ||
        error.message?.toLowerCase().includes('row-level security') ||
        error.message?.toLowerCase().includes('permission')
      ) {
        return 'permission_denied';
      }
      if (
        error.code === 'PGRST205' ||
        error.code === '42P01' ||
        error.message?.toLowerCase().includes('could not find the table')
      ) {
        return 'missing';
      }
      return 'error';
    } catch {
      return 'error';
    }
  };

  const [settingsStatus, servicesStatus, appointmentsStatus] = await Promise.all([
    checkTable('boutique_settings'),
    checkTable('services'),
    checkTable('appointments'),
  ]);

  const allReady =
    settingsStatus === 'ready' && servicesStatus === 'ready' && appointmentsStatus === 'ready';

  let msg = 'Supabase connected and database tables are ready.';
  if (!allReady) {
    const issues: string[] = [];
    if (settingsStatus === 'missing') issues.push('boutique_settings (missing)');
    if (settingsStatus === 'permission_denied') issues.push('boutique_settings (RLS blocked)');
    if (servicesStatus === 'missing') issues.push('services (missing)');
    if (servicesStatus === 'permission_denied') issues.push('services (RLS blocked)');
    if (appointmentsStatus === 'missing') issues.push('appointments (missing)');
    if (appointmentsStatus === 'permission_denied') issues.push('appointments (RLS blocked)');
    msg = `Tables need setup: ${issues.join(', ')}. Run the SQL script below in Supabase.`;
  }

  return {
    connected: true,
    settingsTable: settingsStatus,
    servicesTable: servicesStatus,
    appointmentsTable: appointmentsStatus,
    message: msg,
  };
}
