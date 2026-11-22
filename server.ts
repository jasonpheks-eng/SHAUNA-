import express, { Request, Response } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  Appointment,
  BoutiqueSettings,
  ImageSlots,
  ServiceItem,
  CalendarTimeSlot,
  RealtimeMessage,
} from './src/types';

dotenv.config();

const app = express();
const server = http.createServer(app);
const port = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Data Directory (supports local dev & Vercel serverless bundle via includeFiles)
const isVercel = Boolean(process.env.VERCEL);
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoStoreCandidates = [
  path.resolve(process.cwd(), 'data', 'boutique_store.json'),
  path.resolve(currentDir, 'data', 'boutique_store.json'),
  path.resolve(currentDir, '..', 'data', 'boutique_store.json'),
];
const repoStorePath = repoStoreCandidates.find((p) => fs.existsSync(p)) || repoStoreCandidates[0];
const dataDir = isVercel ? path.resolve('/tmp', 'data') : path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch (e) {}
}
const storeFilePath = path.join(dataDir, 'boutique_store.json');
const BUNDLED_UPDATED_AT = 1795351465000;

// Default Initial Data matching current published boutique configuration
const defaultSettings: BoutiqueSettings = {
  whatsapp_number: '+265 888 38 29 38',
  boutique_name: 'MT Mansion',
  tagline: 'Where Beauty Meets Elegance',
  hero_description:
    'Welcome to MT Maison, your beauty destination for flawless nails, beautiful wig installations and stunning lashes. We help you look good, feel confident and express your unique style.',
  address: '142 Luxury Lane, Suite 4B',
  city_region: 'Mayfair, London',
  opening_hours: 'Tue – Sat: 10:00 AM – 7:30 PM | Sun: 11:00 AM – 5:00 PM',
  currency_symbol: 'MWK',
  currency_code: 'MWK',
  instagram_url: 'https://instagram.com',
  tiktok_url: 'https://tiktok.com',
  pinterest_url: 'https://pinterest.com',
  whatsapp_default_message:
    'Hello MT Mansion! I would like to inquire about booking an appointment for bespoke beauty styling.',
  supabase_url: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://hoeztqucwukrqelltlsm.supabase.co',
  supabase_anon_key: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_8DUKtlDn88mv3gnt9VujNA_faCE03Wk',
  hero_bg_color: '#701932',
  hero_accent_color: '#ea297e',
  hero_text_color: '#a1a1aa',
  navbar_bg_color: '#000000',
  navbar_text_color: '#ea297e',
  details_bg_color: '#501D2C',
  details_text_color: '#E5B8C0',
  services_bg_color: '#501D2C',
  services_card_bg_color: '#3B1622',
  services_text_color: '#F49AC2',
  booking_bg_color: '#5b0827',
  booking_card_bg_color: '#2E1222',
  booking_accent_color: '#C45266',
  about_bg_color: '#240F1B',
  about_text_color: '#FBF8F6',
  experiences_bg_color: '#180711',
  experiences_title_color: '#FFFFFF',
  experiences_subtitle_color: '#F49AC2',
  footer_bg_color: '#1A0A13',
  footer_text_color: '#FBF8F6',
  ceo_google_email: 'jasonpheks@gmail.com',
  calendar_sync_enabled: true,
  calendar_reminder_min: 30,
  hero_gradient_enabled: false,
  hero_gradient_start: '#701932',
  hero_gradient_end: '#240F1B',
  gooey_color_1: '#701932',
  gooey_color_2: '#240F1B',
  theme_preset: 'brutalist',
  hero_font_size: 65,
  hero_description_line_height: 22.25,
  hero_description_align: 'left',
  hero_button_text: 'Reserve Your Slot',
  hero_scroll_text: 'Scroll to Explore',
  hero_gooey_sensitivity: 80,
  services_gooey_sensitivity: 80,
  booking_gooey_sensitivity: 80,
  experiences_gooey_sensitivity: 80,
  hero_gooey_opacity: 60,
  services_gooey_opacity: 50,
  booking_gooey_opacity: 50,
  experiences_gooey_opacity: 50,
};

const defaultImageSlots: ImageSlots = {
  logo_url: '/assets/aistudio/Black_and_White_Minimalist_Initials_Logo__1__19e0d52a.jpg',
  hero_image: '/assets/boutique/hero_hand_mt.png',
  services_feature: '/assets/boutique/services_polish_hands.png',
  service_nails: '/assets/boutique/service_nails.png',
  service_lashes: '/assets/boutique/service_lashes.png',
  service_hair: '/assets/boutique/service_hair.png',
  about_image: '/assets/boutique/about_applicators.png',
  hero_secondary_image: '/assets/boutique/hero_secondary.png',
  experience_gallery: [
    '/assets/aistudio/13998f8d-380c-4b71-9751-6e1ea433019b_2c25dc48.JPG',
    '/assets/aistudio/ce1db7c4-b5d7-49db-825b-98d7af5aead9_cb5c47a2.JPG',
    '/assets/aistudio/5f98f16d-bbe2-48b5-a06c-09976a5479a8_76b7e070.JPG',
    '/assets/aistudio/b81ce228-2111-4462-a523-5229869cfcd8_90af3cce.JPG',
    '/assets/aistudio/f1e4eb20-44af-47da-a0fd-bf98b481f545_4d3766bb.JPG',
    '/assets/aistudio/1a757418-5fe1-4def-9298-d7ace052e2ab_7e053458.JPG',
    '/assets/aistudio/41c0c53b-44f4-4fb6-ae1d-04879ccf276e_56611958.JPG',
    '/assets/aistudio/35427d84-2ec9-4082-8c11-2f586e4fce63_21f9ecec.JPG'
  ],
  configs: {
    hero_image: {
      aspectRatio: '4/5',
      position: 'center',
      scale: 1.15,
      flipH: false,
      flipV: false,
      removeBg: false,
    },
  },
};

const defaultServices: ServiceItem[] = [
  {
    id: 'lashes-clusters-same-volume',
    category: 'lashes',
    number: '01',
    title: 'Same volume (Clusters)',
    description: 'Eye lashes (clusters)',
    price: 12000,
    duration_min: 0,
    hide_duration: true,
    is_active: true,
  },
  {
    id: 'lashes-clusters-cateye',
    category: 'lashes',
    number: '02',
    title: 'Cateye (Clusters)',
    description: 'Eye lashes (clusters)',
    price: 15000,
    duration_min: 0,
    hide_duration: true,
    is_active: true,
  },
  {
    id: 'lashes-clusters-wimpy',
    category: 'lashes',
    number: '03',
    title: 'Wimpy (Clusters)',
    description: 'Eye lashes (clusters)',
    price: 18000,
    duration_min: 0,
    hide_duration: true,
    is_active: true,
  },
  {
    id: 'lashes-individual-same-volume',
    category: 'lashes',
    number: '04',
    title: 'Same volume (Individual)',
    description: 'Individual lashes',
    price: 20000,
    duration_min: 0,
    hide_duration: true,
    is_active: true,
  },
  {
    id: 'lashes-individual-cateye',
    category: 'lashes',
    number: '05',
    title: 'Cateye (Individual)',
    description: 'Individual lashes',
    price: 25000,
    duration_min: 0,
    hide_duration: true,
    is_active: true,
  },
  {
    id: 'lashes-individual-hybrid',
    category: 'lashes',
    number: '06',
    title: 'Hybrid',
    description: 'Individual lashes',
    price: 30000,
    duration_min: 0,
    hide_duration: true,
    is_active: true,
  },
  {
    id: 'lashes-individual-volume',
    category: 'lashes',
    number: '07',
    title: 'Volume',
    description: 'Individual lashes',
    price: 35000,
    duration_min: 0,
    hide_duration: true,
    is_active: true,
  },
  {
    id: 'lashes-individual-wimpy',
    category: 'lashes',
    number: '08',
    title: 'Wimpy (Individual)',
    description: 'Individual lashes',
    price: 35000,
    duration_min: 0,
    hide_duration: true,
    is_active: true,
  },
  {
    id: 'lashes-removal',
    category: 'lashes',
    number: '09',
    title: 'Lash removal',
    description: 'Individual lashes · Gentle removal',
    price: 8000,
    duration_min: 0,
    hide_duration: true,
    is_active: true,
  },
  {
    id: 'nails-finger-gel-natural',
    category: 'nails',
    number: '10',
    title: 'Gel on natural nails',
    description: 'Nails (finger nails)',
    price: 10000,
    duration_min: 0,
    hide_duration: true,
    is_active: true,
  },
  {
    id: 'nails-finger-plain-set',
    category: 'nails',
    number: '11',
    title: 'Plain set',
    description: 'Nails (finger nails) · Price increase depending on the design',
    price: 12000,
    duration_min: 0,
    hide_duration: true,
    is_active: true,
  },
  {
    id: 'nails-finger-french-tips',
    category: 'nails',
    number: '12',
    title: 'French tips',
    description: 'Nails (finger nails)',
    price: 15000,
    duration_min: 0,
    hide_duration: true,
    is_active: true,
  },
  {
    id: 'nails-toe-plain',
    category: 'nails',
    number: '13',
    title: 'Toe nails plain',
    description: 'Toe nails · Price increase depending on design',
    price: 10000,
    duration_min: 0,
    hide_duration: true,
    is_active: true,
  },
  {
    id: 'nails-soak-off',
    category: 'nails',
    number: '14',
    title: 'Soak off',
    description: 'Toe nails / finger nails soak off',
    price: 8000,
    duration_min: 0,
    hide_duration: true,
    is_active: true,
  },
  {
    id: 'hair-blowout',
    category: 'hair',
    number: '15',
    title: 'Wig Installation and Custom Styling',
    description: 'Bespoke lace customization, seamless skin melt, secure installation, and precision thermal styling for a flawless, natural silhouette.',
    price: 25000,
    duration_min: 0,
    hide_duration: true,
    is_active: true,
  },
];

const defaultCalendarSlots: CalendarTimeSlot[] = [
  { time: '10:00 AM', period: 'morning', is_available: true },
  { time: '11:30 AM', period: 'morning', is_available: true },
  { time: '01:00 PM', period: 'afternoon', is_available: true },
  { time: '02:30 PM', period: 'afternoon', is_available: true },
  { time: '04:00 PM', period: 'afternoon', is_available: true },
  { time: '05:30 PM', period: 'evening', is_available: true },
  { time: '07:00 PM', period: 'evening', is_available: true },
];

const defaultAppointments: Appointment[] = [
  {
    id: 'MT-89101',
    client_name: 'Elena Rostova',
    client_phone: '+44 7911 123456',
    client_email: 'elena.rostova@example.com',
    service_id: 'nails-art',
    service_title: 'Your signature nail art',
    category: 'nails',
    date: '2026-11-12',
    time_slot: '02:30 PM',
    notes: 'Pastel French with delicate chrome aura lines',
    status: 'confirmed',
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: 'MT-89102',
    client_name: 'Camilla Dupont',
    client_phone: '+44 7911 654321',
    client_email: 'camilla.d@example.com',
    service_id: 'lashes-classic',
    service_title: 'Silk Lash Extensions',
    category: 'lashes',
    date: '2026-11-13',
    time_slot: '11:30 AM',
    notes: 'Natural cat-eye effect for an upcoming gala',
    status: 'pending',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
];

interface BoutiqueStore {
  settings: BoutiqueSettings;
  imageSlots: ImageSlots;
  services: ServiceItem[];
  calendarSlots: CalendarTimeSlot[];
  appointments: Appointment[];
  updatedAt: number;
}

let store: BoutiqueStore = {
  settings: defaultSettings,
  imageSlots: defaultImageSlots,
  services: defaultServices,
  calendarSlots: defaultCalendarSlots,
  appointments: defaultAppointments,
  updatedAt: BUNDLED_UPDATED_AT,
};

const mergeLoadedSettings = (incoming: Partial<BoutiqueSettings> | undefined): BoutiqueSettings => ({
  ...defaultSettings,
  ...(incoming || {}),
  whatsapp_number: (incoming?.whatsapp_number || '').trim() || defaultSettings.whatsapp_number,
  supabase_url: (incoming?.supabase_url || '').trim() || defaultSettings.supabase_url,
  supabase_anon_key: (incoming?.supabase_anon_key || '').trim() || defaultSettings.supabase_anon_key,
});

// Load saved data if present (prefer newer between /tmp runtime store on Vercel and bundled repoStorePath)
try {
  let fileToLoad = '';
  if (fs.existsSync(storeFilePath) && fs.existsSync(repoStorePath) && storeFilePath !== repoStorePath) {
    const tmpParsed = JSON.parse(fs.readFileSync(storeFilePath, 'utf-8'));
    const repoParsed = JSON.parse(fs.readFileSync(repoStorePath, 'utf-8'));
    const tmpTs = typeof tmpParsed.updatedAt === 'number' ? tmpParsed.updatedAt : 0;
    const repoTs = typeof repoParsed.updatedAt === 'number' ? repoParsed.updatedAt : 0;
    fileToLoad = repoTs >= tmpTs ? repoStorePath : storeFilePath;
  } else if (fs.existsSync(storeFilePath)) {
    fileToLoad = storeFilePath;
  } else if (fs.existsSync(repoStorePath)) {
    fileToLoad = repoStorePath;
  }

  if (fileToLoad) {
    const raw = fs.readFileSync(fileToLoad, 'utf-8');
    const parsed = JSON.parse(raw);
    const statMtime = Math.floor(fs.statSync(fileToLoad).mtimeMs) || BUNDLED_UPDATED_AT;
    store = {
      settings: mergeLoadedSettings(parsed.settings),
      imageSlots: { ...defaultImageSlots, ...(parsed.imageSlots || {}) },
      services: Array.isArray(parsed.services) ? parsed.services : defaultServices,
      calendarSlots: Array.isArray(parsed.calendarSlots) ? parsed.calendarSlots : defaultCalendarSlots,
      appointments: Array.isArray(parsed.appointments) ? parsed.appointments : defaultAppointments,
      updatedAt: typeof parsed.updatedAt === 'number' && parsed.updatedAt > 0 ? parsed.updatedAt : statMtime,
    };
    console.log(`Loaded store from: ${fileToLoad}`);
  }
} catch (err) {
  console.error('Error reading store file, using defaults:', err);
}

const writeJsonAtomic = (targetPath: string, data: string) => {
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpPath = `${targetPath}.tmp`;
  try {
    fs.writeFileSync(tmpPath, data, 'utf-8');
    fs.renameSync(tmpPath, targetPath);
  } catch {
    fs.writeFileSync(targetPath, data, 'utf-8');
  }
};

const persistStore = () => {
  const serialized = JSON.stringify(store, null, 2);
  try {
    writeJsonAtomic(storeFilePath, serialized);
  } catch (err) {
    console.warn('Error persisting store to storeFilePath:', err);
  }
  if (!isVercel && repoStorePath !== storeFilePath) {
    try {
      if (fs.existsSync(path.dirname(repoStorePath))) {
        writeJsonAtomic(repoStorePath, serialized);
      }
    } catch (e) {}
  }
};

// Supabase Client Management
let supabase: SupabaseClient | null = null;
let lastSupabaseReconcileAt = 0;

const mirrorSettingsBundleToSupabase = async (targetClient: SupabaseClient | null = supabase) => {
  if (!targetClient) return;
  const syncTs = store.updatedAt || Date.now();
  const buildSettingsJson = (omitLargeDataUris = false) => {
    const cleanSettings: Record<string, any> = { ...store.settings };
    delete cleanSettings._image_slots;
    delete cleanSettings._calendar_slots;
    delete cleanSettings._updated_at;

    let packedImages: Record<string, any> = { ...store.imageSlots };
    if (omitLargeDataUris) {
      for (const [k, v] of Object.entries(packedImages)) {
        if (typeof v === 'string' && v.startsWith('data:') && v.length > 200000) {
          delete packedImages[k];
        }
      }
    }
    return {
      ...cleanSettings,
      _image_slots: packedImages,
      _calendar_slots: store.calendarSlots,
      _updated_at: syncTs,
    };
  };

  try {
    const makePayload = (omitLarge = false) => ({
      id: 'current',
      hero_bg_color: store.settings.hero_bg_color,
      hero_accent_color: store.settings.hero_accent_color,
      boutique_name: store.settings.boutique_name,
      tagline: store.settings.tagline,
      whatsapp_number: store.settings.whatsapp_number,
      hero_description: store.settings.hero_description,
      settings: buildSettingsJson(omitLarge),
      updated_at: new Date(syncTs).toISOString(),
    });

    const { error } = await targetClient
      .from('boutique_settings')
      .upsert(makePayload(false), { onConflict: 'id' });

    if (error && (error.code === '413' || error.message?.toLowerCase().includes('payload') || error.message?.toLowerCase().includes('too large'))) {
      await targetClient.from('boutique_settings').upsert(makePayload(true), { onConflict: 'id' });
    }
  } catch {
    // Supabase mirror error ignored (table may not be created yet)
  }
};

const mirrorServicesToSupabase = async (targetClient: SupabaseClient | null = supabase) => {
  if (!targetClient) return;
  try {
    const keepIds = new Set(store.services.map((s) => s.id));
    if (store.services.length > 0) {
      const nowIso = new Date(store.updatedAt || Date.now()).toISOString();
      const rows = store.services.map((s, idx) => ({
        id: s.id,
        category: s.category,
        number: s.number || String(idx + 1).padStart(2, '0'),
        title: s.title,
        description: s.description || '',
        price: Number(s.price) || 0,
        duration_min: Number(s.duration_min) || 0,
        hide_duration: Boolean(s.hide_duration),
        is_popular: Boolean(s.is_popular),
        is_active: s.is_active !== false,
        updated_at: nowIso,
      }));
      const { error } = await targetClient.from('services').upsert(rows, { onConflict: 'id' });
      if (error && (error.code === '42703' || error.code === 'PGRST204' || error.message?.toLowerCase().includes('column'))) {
        const basicRows = store.services.map((s, idx) => ({
          id: s.id,
          category: s.category,
          number: s.number || String(idx + 1).padStart(2, '0'),
          title: s.title,
          description: s.description || '',
          price: Number(s.price) || 0,
          duration_min: Number(s.duration_min) || 0,
          is_active: s.is_active !== false,
          updated_at: nowIso,
        }));
        await targetClient.from('services').upsert(basicRows, { onConflict: 'id' });
      }
    }
    const { data: existingRows } = await targetClient.from('services').select('id');
    if (Array.isArray(existingRows) && existingRows.length > 0) {
      const removedIds = existingRows.map((r: any) => r.id).filter((id: string) => !keepIds.has(id));
      if (removedIds.length > 0) {
        await targetClient.from('services').delete().in('id', removedIds);
      }
    }
  } catch {
    // Supabase services mirror ignored
  }
};

const reconcileWithSupabase = async (force = false) => {
  if (!supabase) return;
  const now = Date.now();
  if (!force && now - lastSupabaseReconcileAt < 10000) return;
  lastSupabaseReconcileAt = now;

  try {
    const [{ data: settingsRow, error: settingsErr }, { data: serviceRows, error: servicesErr }] = await Promise.all([
      supabase.from('boutique_settings').select('*').eq('id', 'current').maybeSingle(),
      supabase.from('services').select('*').order('number', { ascending: true }),
    ]);

    const settingsTableReady = !settingsErr;
    const servicesTableReady = !servicesErr;
    if (!settingsTableReady && !servicesTableReady) return;

    const rawJson = (settingsRow?.settings || {}) as Record<string, any>;
    const cloudTs = Number(rawJson._updated_at || 0) || (settingsRow?.updated_at ? Date.parse(settingsRow.updated_at) || 0 : 0);

    if (cloudTs > store.updatedAt && settingsRow) {
      const cleanCloudSettings = { ...rawJson };
      const cloudImages = cleanCloudSettings._image_slots as Partial<ImageSlots> | undefined;
      const cloudSlots = Array.isArray(cleanCloudSettings._calendar_slots)
        ? (cleanCloudSettings._calendar_slots as CalendarTimeSlot[])
        : undefined;
      delete cleanCloudSettings._image_slots;
      delete cleanCloudSettings._calendar_slots;
      delete cleanCloudSettings._updated_at;

      store.settings = mergeLoadedSettings({
        ...store.settings,
        ...cleanCloudSettings,
        ...(settingsRow.hero_bg_color ? { hero_bg_color: settingsRow.hero_bg_color } : {}),
        ...(settingsRow.hero_accent_color ? { hero_accent_color: settingsRow.hero_accent_color } : {}),
        ...(settingsRow.boutique_name ? { boutique_name: settingsRow.boutique_name } : {}),
        ...(settingsRow.tagline ? { tagline: settingsRow.tagline } : {}),
        ...(settingsRow.whatsapp_number ? { whatsapp_number: settingsRow.whatsapp_number } : {}),
        ...(settingsRow.hero_description ? { hero_description: settingsRow.hero_description } : {}),
      });
      if (cloudImages) {
        store.imageSlots = { ...store.imageSlots, ...cloudImages };
      }
      if (cloudSlots) {
        store.calendarSlots = cloudSlots;
      }
      if (servicesTableReady && Array.isArray(serviceRows) && serviceRows.length > 0) {
        store.services = serviceRows.map((row: any) => ({
          id: row.id,
          category: row.category,
          number: row.number,
          title: row.title,
          description: row.description || '',
          price: Number(row.price) || 0,
          duration_min: Number(row.duration_min) || 0,
          hide_duration: Boolean(row.hide_duration),
          is_popular: Boolean(row.is_popular),
          is_active: row.is_active !== false,
        }));
      }
      store.updatedAt = cloudTs;
      persistStore();
    } else {
      // Auto-seed or update Supabase whenever tables exist and are empty or older than current repo/store
      if (settingsTableReady && (!settingsRow || store.updatedAt > cloudTs)) {
        await mirrorSettingsBundleToSupabase(supabase);
      }
      const maxServiceTs = Array.isArray(serviceRows)
        ? serviceRows.reduce((m: number, r: any) => Math.max(m, r.updated_at ? Date.parse(r.updated_at) || 0 : 0), 0)
        : 0;
      if (servicesTableReady && (!serviceRows || serviceRows.length === 0 || store.updatedAt > maxServiceTs)) {
        await mirrorServicesToSupabase(supabase);
      }
    }
  } catch {
    // Non-fatal reconcile failure
  }
};

const initSupabase = (url: string, key: string) => {
  if (url && key) {
    try {
      supabase = createClient(url, key);
      console.log('Connected to Supabase project:', url);
      void reconcileWithSupabase(true);
      // Listen for Postgres changes on appointments table if available
      try {
        supabase
          .channel('schema-db-changes')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'appointments' },
            (payload) => {
              console.log('Supabase Postgres change detected:', payload.eventType);
              if (payload.eventType === 'INSERT' && payload.new) {
                const newApt = payload.new as Appointment;
                if (!store.appointments.some((a) => a.id === newApt.id)) {
                  store.appointments.unshift(newApt);
                  persistStore();
                  broadcast({
                    type: 'APPOINTMENT_CREATED',
                    data: newApt,
                    timestamp: Date.now(),
                  });
                }
              } else if (payload.eventType === 'UPDATE' && payload.new) {
                const updatedApt = payload.new as Appointment;
                store.appointments = store.appointments.map((a) =>
                  a.id === updatedApt.id ? updatedApt : a
                );
                persistStore();
                broadcast({
                  type: 'APPOINTMENT_UPDATED',
                  data: updatedApt,
                  timestamp: Date.now(),
                });
              }
            }
          )
          .subscribe();
      } catch (subErr) {
        console.warn('Supabase realtime channel subscription note:', subErr);
      }
    } catch (err) {
      console.error('Failed to create Supabase client:', err);
      supabase = null;
    }
  } else {
    supabase = null;
  }
};

if (store.settings.supabase_url && store.settings.supabase_anon_key) {
  initSupabase(store.settings.supabase_url, store.settings.supabase_anon_key);
}

// WebSocket Server for zero-refresh real-time sync across all client sessions
const wss = new WebSocketServer({ noServer: true });
const activeClients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  activeClients.add(ws);

  // Send initial bootstrap state on connect
  const initMsg: RealtimeMessage = {
    type: 'INIT_STATE',
    data: store,
    timestamp: Date.now(),
  };
  ws.send(JSON.stringify(initMsg));

  ws.on('close', () => {
    activeClients.delete(ws);
  });

  ws.on('error', (err) => {
    console.error('WebSocket client error:', err);
    activeClients.delete(ws);
  });
});

// Broadcast helper: delivers to all open client sessions instantly
const broadcast = (message: RealtimeMessage) => {
  const payload = JSON.stringify(message);
  for (const client of activeClients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(payload);
      } catch (err) {
        console.error('Error broadcasting to client:', err);
      }
    }
  }

  // Also notify any Server-Sent Events listeners
  sseListeners.forEach((res) => {
    try {
      res.write(`data: ${payload}\n\n`);
    } catch (e) {
      // client disconnected
    }
  });
};

// SSE Fallback listeners
const sseListeners = new Set<Response>();

// Handle HTTP upgrade to WebSocket
server.on('upgrade', (request, socket, head) => {
  if (request.url === '/ws' || request.url?.startsWith('/ws')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

// API Router supporting both direct /api/* calls and Vercel rewritten /* calls
const apiRouter = express.Router();

apiRouter.get('/bootstrap', async (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Reconcile with Supabase (pull newer admin edits on cold Vercel starts, or auto-seed Supabase if tables are ready)
  await Promise.race([
    reconcileWithSupabase(false),
    new Promise((resolve) => setTimeout(resolve, 2500)),
  ]);

  res.json({
    success: true,
    data: store,
    hasSupabase: Boolean(supabase),
  });
});

apiRouter.post('/verify-pin', (req: Request, res: Response) => {
  const { pin } = req.body;
  const cleanPin = typeof pin === 'string' ? pin.trim().toUpperCase() : '';
  if (cleanPin === 'MT1234') {
    res.json({ success: true, message: 'Admin authenticated' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid Admin PIN' });
  }
});

apiRouter.post('/appointments', async (req: Request, res: Response) => {
  const {
    client_name,
    client_phone,
    client_email,
    service_id,
    service_title,
    services_summary,
    service_ids,
    date,
    time_slot,
    notes,
  } = req.body;

  if (!client_name || !client_phone || !service_id || !date || !time_slot) {
    return res.status(400).json({ success: false, message: 'Missing required booking fields' });
  }

  const normalizedIds = Array.isArray(service_ids) && service_ids.length > 0
    ? service_ids.map((id: any) => String(id)).slice(0, 20)
    : [String(service_id)];
  const matchedServices = normalizedIds
    .map((id) => store.services.find((s) => s.id === id))
    .filter((s): s is ServiceItem => Boolean(s));
  const primaryService = matchedServices[0] || store.services.find((s) => s.id === service_id);

  const computedTitle =
    typeof service_title === 'string' && service_title.trim()
      ? service_title.trim().slice(0, 160)
      : matchedServices.length > 1
      ? `${matchedServices.length} Treatments: ${matchedServices.map((s) => s.title).join(', ')}`.slice(0, 160)
      : primaryService?.title || 'Bespoke Consultation';

  const newAppointment: Appointment = {
    id: `MT-${Math.floor(10000 + Math.random() * 90000)}`,
    client_name,
    client_phone,
    client_email: client_email || '',
    service_id: String(service_id),
    service_title: computedTitle,
    ...(typeof services_summary === 'string' && services_summary.trim()
      ? { services_summary: services_summary.trim().slice(0, 500) }
      : {}),
    service_ids: normalizedIds,
    category: primaryService?.category || 'nails',
    date,
    time_slot,
    notes: notes || '',
    status: 'pending',
    created_at: new Date().toISOString(),
  };

  store.appointments.unshift(newAppointment);
  store.updatedAt = Date.now();
  persistStore();

  // Try mirroring to Supabase if configured
  if (supabase) {
    try {
      await supabase.from('appointments').insert([newAppointment]);
    } catch (err) {
      console.warn('Note: Could not insert to Supabase table (table may not exist yet):', err);
    }
  }

  // Instant real-time broadcast to all browser sessions
  broadcast({
    type: 'APPOINTMENT_CREATED',
    data: newAppointment,
    timestamp: Date.now(),
  });

  res.json({ success: true, appointment: newAppointment });
});

apiRouter.patch('/appointments/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, notes, time_slot, date } = req.body;

  const index = store.appointments.findIndex((a) => a.id === id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Appointment not found' });
  }

  const updated: Appointment = {
    ...store.appointments[index],
    ...(status ? { status } : {}),
    ...(notes !== undefined ? { notes } : {}),
    ...(time_slot ? { time_slot } : {}),
    ...(date ? { date } : {}),
  };

  store.appointments[index] = updated;
  store.updatedAt = Date.now();
  persistStore();

  if (supabase) {
    try {
      await supabase.from('appointments').update(updated).eq('id', id);
    } catch (err) {
      console.warn('Supabase update note:', err);
    }
  }

  broadcast({
    type: 'APPOINTMENT_UPDATED',
    data: updated,
    timestamp: Date.now(),
  });

  res.json({ success: true, appointment: updated });
});

apiRouter.delete('/appointments/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const index = store.appointments.findIndex((a) => a.id === id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Appointment not found' });
  }

  store.appointments.splice(index, 1);
  store.updatedAt = Date.now();
  persistStore();

  if (supabase) {
    try {
      await supabase.from('appointments').delete().eq('id', id);
    } catch (err) {
      console.warn('Supabase delete note:', err);
    }
  }

  broadcast({
    type: 'APPOINTMENT_DELETED' as any,
    data: { id },
    timestamp: Date.now(),
  });

  res.json({ success: true, message: 'Appointment deleted' });
});

apiRouter.post('/settings', async (req: Request, res: Response) => {
  const newSettings = req.body;
  store.settings = {
    ...store.settings,
    ...newSettings,
  };
  store.updatedAt = Date.now();
  persistStore();

  if (newSettings.supabase_url !== undefined || newSettings.supabase_anon_key !== undefined) {
    initSupabase(store.settings.supabase_url, store.settings.supabase_anon_key);
  }

  // Mirror settings + embedded imageSlots/calendarSlots to Supabase (best-effort)
  await mirrorSettingsBundleToSupabase(supabase);

  broadcast({
    type: 'SETTINGS_UPDATED',
    data: store.settings,
    timestamp: store.updatedAt,
  });

  res.json({ success: true, settings: store.settings, updatedAt: store.updatedAt });
});

apiRouter.post('/image-slots', async (req: Request, res: Response) => {
  const newImageSlots = req.body;
  store.imageSlots = {
    ...store.imageSlots,
    ...newImageSlots,
  };
  store.updatedAt = Date.now();
  persistStore();

  await mirrorSettingsBundleToSupabase(supabase);

  broadcast({
    type: 'IMAGES_UPDATED',
    data: store.imageSlots,
    timestamp: store.updatedAt,
  });

  res.json({ success: true, imageSlots: store.imageSlots, updatedAt: store.updatedAt });
});

apiRouter.post('/services', async (req: Request, res: Response) => {
  const { services } = req.body;
  if (Array.isArray(services)) {
    const sanitizedServices: ServiceItem[] = services.map((s: any, idx: number) => ({
      id: String(s.id || `service-${Date.now()}-${idx}`),
      category: s.category === 'lashes' || s.category === 'hair' ? s.category : 'nails',
      number: s.number || String(idx + 1).padStart(2, '0'),
      title: String(s.title || 'Untitled Treatment'),
      description: String(s.description || ''),
      price: Number.isFinite(Number(s.price)) ? Number(s.price) : 0,
      duration_min: Number.isFinite(Number(s.duration_min)) ? Number(s.duration_min) : 0,
      hide_duration: Boolean(s.hide_duration),
      is_active: s.is_active !== false,
      is_popular: Boolean(s.is_popular),
    }));

    store.services = sanitizedServices;
    store.updatedAt = Date.now();
    persistStore();

    // Mirror services to Supabase (best-effort, including deletions)
    await mirrorServicesToSupabase(supabase);

    broadcast({
      type: 'SERVICES_UPDATED',
      data: store.services,
      timestamp: store.updatedAt,
    });

    res.json({ success: true, services: store.services, updatedAt: store.updatedAt });
  } else {
    res.status(400).json({ success: false, message: 'Services array expected' });
  }
});

apiRouter.post('/slots', async (req: Request, res: Response) => {
  const { slots } = req.body;
  if (Array.isArray(slots)) {
    store.calendarSlots = slots;
    store.updatedAt = Date.now();
    persistStore();

    await mirrorSettingsBundleToSupabase(supabase);

    broadcast({
      type: 'SLOTS_UPDATED',
      data: store.calendarSlots,
      timestamp: store.updatedAt,
    });

    res.json({ success: true, slots: store.calendarSlots, updatedAt: store.updatedAt });
  } else {
    res.status(400).json({ success: false, message: 'Slots array expected' });
  }
});

apiRouter.post('/sync-store', async (req: Request, res: Response) => {
  const clientStore = req.body;
  if (clientStore && typeof clientStore === 'object') {
    if (clientStore.settings) store.settings = mergeLoadedSettings({ ...store.settings, ...clientStore.settings });
    if (clientStore.imageSlots) store.imageSlots = { ...store.imageSlots, ...clientStore.imageSlots };
    if (Array.isArray(clientStore.services)) store.services = clientStore.services;
    if (Array.isArray(clientStore.calendarSlots)) store.calendarSlots = clientStore.calendarSlots;
    const syncTs = typeof clientStore.updatedAt === 'number' ? clientStore.updatedAt : Date.now();
    store.updatedAt = syncTs;
    persistStore();

    await Promise.all([
      mirrorSettingsBundleToSupabase(supabase),
      mirrorServicesToSupabase(supabase),
    ]);

    broadcast({
      type: 'INIT_STATE',
      data: store,
      timestamp: syncTs,
    });
  }
  res.json({ success: true, store });
});

// Test Supabase connection endpoint
apiRouter.post('/test-supabase', async (req: Request, res: Response) => {
  const { url, key } = req.body;
  if (!url || !key) {
    return res.status(400).json({ success: false, message: 'URL and Anon key required' });
  }

  try {
    const testClient = createClient(url, key);
    const { error } = await testClient.from('appointments').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      return res.json({
        success: true,
        reachable: true,
        tableExists: false,
        message: `Connected to Supabase! Note: 'appointments' table does not exist yet (${error.message}). Realtime sync is active for other channels.`,
      });
    }
    return res.json({
      success: true,
      reachable: true,
      tableExists: true,
      message: 'Supabase connected successfully with Postgres changes listener active!',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      reachable: false,
      message: err.message || 'Failed to connect to Supabase project',
    });
  }
});

// Google Calendar sync endpoint
apiRouter.post('/calendar/sync', async (req: Request, res: Response) => {
  const { appointment, apiKey, calendarId } = req.body;
  if (!appointment || !appointment.client_name) {
    return res.status(400).json({ success: false, message: 'Invalid appointment payload' });
  }

  const [year, month, day] = (appointment.date || '2026-11-12').split('-').map(Number);
  let hours = 14;
  let minutes = 30;
  try {
    const match = (appointment.time_slot || '').match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (match) {
      hours = parseInt(match[1], 10);
      minutes = parseInt(match[2], 10);
      const ampm = match[3].toUpperCase();
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
    }
  } catch (e) {}

  const startDate = new Date(year, (month || 1) - 1, day || 1, hours, minutes, 0);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
  const formatISO = (d: Date) => d.toISOString().replace(/-|:|\.\d+/g, '');
  const dates = `${formatISO(startDate)}/${formatISO(endDate)}`;

  const title = `MT Mansion: ${appointment.service_title} - ${appointment.client_name}`;
  const details = `Boutique Appointment Booking\n\nClient: ${appointment.client_name}\nPhone: ${appointment.client_phone}\nTreatment: ${appointment.service_title}\nDate: ${appointment.date}\nTime: ${appointment.time_slot}\n${appointment.notes ? `Notes: ${appointment.notes}\n` : ''}Ref: ${appointment.id}`;
  const eventLocation = 'MT Mansion Luxury Boutique';
  const targetEmail = calendarId || store.settings.ceo_google_email || 'jasonpheks@gmail.com';
  const webLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${encodeURIComponent(dates)}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(eventLocation)}&add=${encodeURIComponent(targetEmail)}`;

  if (apiKey) {
    try {
      const targetCal = calendarId || store.settings.ceo_google_email || 'primary';
      const eventPayload = {
        summary: title,
        description: details,
        location: eventLocation,
        start: { dateTime: startDate.toISOString() },
        end: { dateTime: endDate.toISOString() },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: store.settings.calendar_reminder_min || 30 },
            { method: 'email', minutes: store.settings.calendar_reminder_min || 30 }
          ]
        }
      };

      const googleRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCal)}/events?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventPayload),
        }
      );
      if (googleRes.ok) {
        return res.json({ success: true, synced: true, webLink, message: 'Synced to Google Calendar via API key' });
      }
    } catch (gErr) {
      console.warn('Google Calendar API sync error:', gErr);
    }
  }

  return res.json({ success: true, synced: false, webLink, message: 'Google Calendar web link generated' });
});

// SSE endpoint for fallback real-time streaming
apiRouter.get('/realtime-sse', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write('\n');
  sseListeners.add(res);

  req.on('close', () => {
    sseListeners.delete(res);
  });
});

// Mount on both /api (standard) and / (Vercel rewrite fallback)
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Vite Middleware integration in Dev / Static Serving in Prod
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(port, '0.0.0.0', () => {
    console.log(`MT Mansion server running on http://localhost:${port}`);
  });
}

if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export default app;
