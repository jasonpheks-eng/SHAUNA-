import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import {
  Appointment,
  BoutiqueSettings,
  CalendarTimeSlot,
  ImageSlots,
  ServiceItem,
} from '../types';

const ADMIN_EMAIL = 'jasonpheks@gmail.com';

export function isVerifiedAdminUser(user: User | null | undefined): boolean {
  return Boolean(user && user.emailVerified && user.email === ADMIN_EMAIL);
}

const ALLOWED_CONFIG_KEYS: Array<keyof BoutiqueSettings> = [
  'whatsapp_number',
  'boutique_name',
  'tagline',
  'hero_description',
  'address',
  'city_region',
  'opening_hours',
  'currency_symbol',
  'currency_code',
  'instagram_url',
  'tiktok_url',
  'pinterest_url',
  'whatsapp_default_message',
  'hero_bg_color',
  'hero_accent_color',
  'hero_text_color',
  'navbar_bg_color',
  'navbar_text_color',
  'details_bg_color',
  'details_text_color',
  'services_bg_color',
  'services_card_bg_color',
  'services_text_color',
  'booking_bg_color',
  'booking_card_bg_color',
  'booking_accent_color',
  'about_bg_color',
  'about_text_color',
  'experiences_bg_color',
  'experiences_title_color',
  'experiences_subtitle_color',
  'footer_bg_color',
  'footer_text_color',
  'hero_gradient_enabled',
  'hero_gradient_start',
  'hero_gradient_end',
  'gooey_color_1',
  'gooey_color_2',
  'theme_preset',
  'hero_font_size',
  'hero_description_line_height',
  'hero_description_align',
  'hero_button_text',
  'hero_scroll_text',
  'hero_gooey_sensitivity',
  'services_gooey_sensitivity',
  'booking_gooey_sensitivity',
  'experiences_gooey_sensitivity',
  'hero_gooey_opacity',
  'services_gooey_opacity',
  'booking_gooey_opacity',
  'experiences_gooey_opacity',
];

function sanitizeBoutiqueConfigPayload(settings: BoutiqueSettings): Record<string, any> {
  const payload: Record<string, any> = {
    boutique_name: (settings.boutique_name || 'MT Mansion').slice(0, 120),
    whatsapp_number: (settings.whatsapp_number || '+265 888 38 29 38').slice(0, 40),
    currency_symbol: (settings.currency_symbol || 'MWK').slice(0, 16),
    updatedAt: serverTimestamp(),
  };

  for (const key of ALLOWED_CONFIG_KEYS) {
    const val = settings[key];
    if (val === undefined || val === null) continue;
    if (typeof val === 'string') {
      payload[key] = val.slice(0, 1000);
    } else if (typeof val === 'boolean' || typeof val === 'number') {
      payload[key] = val;
    }
  }
  return payload;
}

function sanitizeImageSlotsPayload(slots: ImageSlots): Record<string, any> {
  const clampSlot = (v: string | undefined, maxLen: number, fallback: string) => {
    const raw = typeof v === 'string' ? v : fallback;
    return raw.length <= maxLen ? raw : fallback;
  };

  const gallery = (Array.isArray(slots.experience_gallery) ? slots.experience_gallery : [])
    .filter((u): u is string => typeof u === 'string' && u.trim().length > 0 && u.length <= 200000)
    .slice(0, 40);

  return {
    logo_url: clampSlot(slots.logo_url, 200000, '/assets/aistudio/Black_and_White_Minimalist_Initials_Logo__1__19e0d52a.jpg'),
    hero_image: clampSlot(slots.hero_image, 200000, '/assets/boutique/hero_hand_mt.png'),
    services_feature: clampSlot(slots.services_feature, 850000, '/assets/boutique/services_polish_hands.png'),
    service_nails: clampSlot(slots.service_nails, 200000, '/assets/boutique/service_nails.png'),
    service_lashes: clampSlot(slots.service_lashes, 200000, '/assets/boutique/service_lashes.png'),
    service_hair: clampSlot(slots.service_hair, 200000, '/assets/boutique/service_hair.png'),
    about_image: clampSlot(slots.about_image, 200000, '/assets/boutique/about_applicators.png'),
    hero_secondary_image: clampSlot(slots.hero_secondary_image, 200000, '/assets/boutique/hero_secondary.png'),
    experience_gallery: gallery,
    configs: slots.configs || {},
    updatedAt: serverTimestamp(),
  };
}

export async function upsertUserProfileInFirestore(user: User): Promise<void> {
  if (!user.emailVerified || !user.email) return;
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        email: user.email.slice(0, 254),
        ...(user.displayName ? { displayName: user.displayName.slice(0, 120) } : {}),
        ...(user.photoURL ? { photoURL: user.photoURL.slice(0, 512) } : {}),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        uid: user.uid,
        email: user.email.slice(0, 254),
        ...(user.displayName ? { displayName: user.displayName.slice(0, 120) } : {}),
        ...(user.photoURL ? { photoURL: user.photoURL.slice(0, 512) } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncBoutiqueConfigToFirestore(settings: BoutiqueSettings): Promise<boolean> {
  if (!isVerifiedAdminUser(auth.currentUser)) return false;
  const path = 'boutique_config/current';
  try {
    await setDoc(doc(db, 'boutique_config', 'current'), sanitizeBoutiqueConfigPayload(settings));
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncImageSlotsToFirestore(slots: ImageSlots): Promise<boolean> {
  if (!isVerifiedAdminUser(auth.currentUser)) return false;
  const path = 'image_slots/current';
  try {
    await setDoc(doc(db, 'image_slots', 'current'), sanitizeImageSlotsPayload(slots));
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncCalendarSlotsToFirestore(slots: CalendarTimeSlot[]): Promise<boolean> {
  if (!isVerifiedAdminUser(auth.currentUser)) return false;
  const path = 'calendar_slots/current';
  try {
    await setDoc(doc(db, 'calendar_slots', 'current'), {
      slots: (Array.isArray(slots) ? slots : []).slice(0, 48),
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncServicesToFirestore(services: ServiceItem[]): Promise<boolean> {
  if (!isVerifiedAdminUser(auth.currentUser)) return false;
  const path = 'services';
  try {
    const existingSnap = await getDocs(collection(db, 'services'));
    const keepIds = new Set(services.map((s) => s.id));
    const batch = writeBatch(db);

    existingSnap.forEach((docSnap) => {
      if (!keepIds.has(docSnap.id)) {
        batch.delete(docSnap.ref);
      }
    });

    services.forEach((s, idx) => {
      const safeId = (s.id || `service-${idx + 1}`).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
      batch.set(doc(db, 'services', safeId), {
        id: safeId,
        category: s.category === 'lashes' || s.category === 'hair' ? s.category : 'nails',
        number: (s.number || String(idx + 1).padStart(2, '0')).slice(0, 16),
        title: (s.title || 'Untitled Treatment').slice(0, 160),
        description: (s.description || '').slice(0, 600),
        price: Number.isFinite(Number(s.price)) ? Math.max(0, Number(s.price)) : 0,
        duration_min: Number.isFinite(Number(s.duration_min)) ? Math.max(0, Number(s.duration_min)) : 0,
        hide_duration: Boolean(s.hide_duration),
        is_active: s.is_active !== false,
        is_popular: Boolean(s.is_popular),
        updatedAt: serverTimestamp(),
      });
    });

    await batch.commit();
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function createAppointmentInFirestore(appointment: Appointment): Promise<boolean> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return false;
  const safeId = appointment.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  const path = `appointments/${safeId}`;
  try {
    await setDoc(doc(db, 'appointments', safeId), {
      id: safeId,
      clientUid: user.uid,
      client_name: (appointment.client_name || 'Guest').slice(0, 120),
      client_phone: (appointment.client_phone || 'WhatsApp Direct').slice(0, 40),
      client_email: (appointment.client_email || user.email || '').slice(0, 254),
      service_id: (appointment.service_id || 'service').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128),
      service_title: (appointment.service_title || 'Bespoke Treatment').slice(0, 160),
      category: appointment.category === 'lashes' || appointment.category === 'hair' ? appointment.category : 'nails',
      date: /^\d{4}-\d{2}-\d{2}$/.test(appointment.date) ? appointment.date : '2026-11-12',
      time_slot: (appointment.time_slot || '10:00 AM').slice(0, 32),
      notes: (appointment.notes || '').slice(0, 600),
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateAppointmentStatusInFirestore(
  id: string,
  status: Appointment['status']
): Promise<boolean> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return false;
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  const path = `appointments/${safeId}`;
  try {
    await updateDoc(doc(db, 'appointments', safeId), {
      status,
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteAppointmentInFirestore(id: string): Promise<boolean> {
  if (!isVerifiedAdminUser(auth.currentUser)) return false;
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  const path = `appointments/${safeId}`;
  try {
    await deleteDoc(doc(db, 'appointments', safeId));
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export interface FirestoreHydrationPayload {
  settings?: Partial<BoutiqueSettings>;
  imageSlots?: Partial<ImageSlots>;
  calendarSlots?: CalendarTimeSlot[];
  services?: ServiceItem[];
  updatedAt: number;
}

export async function fetchPublicBoutiqueFromFirestore(): Promise<FirestoreHydrationPayload | null> {
  let maxUpdatedAt = 0;
  const result: FirestoreHydrationPayload = { updatedAt: 0 };

  try {
    const [configSnap, imageSnap, slotsSnap, servicesSnap] = await Promise.all([
      getDoc(doc(db, 'boutique_config', 'current')),
      getDoc(doc(db, 'image_slots', 'current')),
      getDoc(doc(db, 'calendar_slots', 'current')),
      getDocs(collection(db, 'services')),
    ]);

    if (configSnap.exists()) {
      const data = configSnap.data();
      const ts = data.updatedAt?.toMillis?.() || 0;
      if (ts > maxUpdatedAt) maxUpdatedAt = ts;
      const { updatedAt: _u, ...rest } = data;
      result.settings = rest as Partial<BoutiqueSettings>;
    }

    if (imageSnap.exists()) {
      const data = imageSnap.data();
      const ts = data.updatedAt?.toMillis?.() || 0;
      if (ts > maxUpdatedAt) maxUpdatedAt = ts;
      const { updatedAt: _u, ...rest } = data;
      result.imageSlots = rest as Partial<ImageSlots>;
    }

    if (slotsSnap.exists()) {
      const data = slotsSnap.data();
      const ts = data.updatedAt?.toMillis?.() || 0;
      if (ts > maxUpdatedAt) maxUpdatedAt = ts;
      if (Array.isArray(data.slots)) {
        result.calendarSlots = data.slots as CalendarTimeSlot[];
      }
    }

    if (!servicesSnap.empty) {
      const list: ServiceItem[] = [];
      servicesSnap.forEach((docSnap) => {
        const d = docSnap.data();
        const ts = d.updatedAt?.toMillis?.() || 0;
        if (ts > maxUpdatedAt) maxUpdatedAt = ts;
        list.push({
          id: d.id || docSnap.id,
          category: d.category,
          number: d.number || '01',
          title: d.title,
          description: d.description || '',
          price: Number(d.price) || 0,
          duration_min: Number(d.duration_min) || 0,
          hide_duration: Boolean(d.hide_duration),
          is_active: d.is_active !== false,
          is_popular: Boolean(d.is_popular),
        });
      });
      list.sort((a, b) => Number(a.number) - Number(b.number));
      result.services = list;
    }

    result.updatedAt = maxUpdatedAt;
    return maxUpdatedAt > 0 || result.services?.length ? result : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'boutique_config/current');
  }
}

export function subscribeToAppointmentsInFirestore(
  user: User,
  onData: (appointments: Appointment[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const path = 'appointments';
  const col = collection(db, path);
  const q = isVerifiedAdminUser(user) ? col : query(col, where('clientUid', '==', user.uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: Appointment[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        items.push({
          id: d.id || docSnap.id,
          client_name: d.client_name,
          client_phone: d.client_phone,
          client_email: d.client_email || '',
          service_id: d.service_id,
          service_title: d.service_title,
          category: d.category,
          date: d.date,
          time_slot: d.time_slot,
          notes: d.notes || '',
          status: d.status,
          created_at: d.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
        });
      });
      items.sort((a, b) => b.created_at.localeCompare(a.created_at));
      onData(items);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}
