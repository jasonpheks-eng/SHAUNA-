import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  Appointment,
  BoutiqueSettings,
  ImageSlots,
  ServiceItem,
  CalendarTimeSlot,
  RealtimeMessage,
} from '../types';
import { syncAppointmentToGoogleCalendar } from '../lib/googleCalendar';
import {
  syncSettingsToSupabase,
  syncServicesToSupabase,
  fetchSettingsFromSupabase,
  fetchServicesFromSupabase,
  checkSupabaseHealth,
  SupabaseSyncResult,
  SupabaseHealthStatus,
} from '../lib/supabaseSync';
import { auth, googleAuthProvider } from '../lib/firebase';
import {
  isVerifiedAdminUser,
  upsertUserProfileInFirestore,
  syncBoutiqueConfigToFirestore,
  syncImageSlotsToFirestore,
  syncCalendarSlotsToFirestore,
  syncServicesToFirestore,
  createAppointmentInFirestore,
  updateAppointmentStatusInFirestore,
  deleteAppointmentInFirestore,
  fetchPublicBoutiqueFromFirestore,
  subscribeToAppointmentsInFirestore,
} from '../lib/firestoreSync';
import {
  defaultSettings,
  defaultImageSlots,
  defaultServices,
  defaultCalendarSlots,
  defaultAppointments,
} from '../data/initialData';

interface BoutiqueContextType {
  settings: BoutiqueSettings;
  imageSlots: ImageSlots;
  services: ServiceItem[];
  calendarSlots: CalendarTimeSlot[];
  appointments: Appointment[];
  isLoading: boolean;
  isConnected: boolean;
  isSupabaseActive: boolean;
  supabaseClient: SupabaseClient | null;
  isAdmin: boolean;
  firebaseUser: User | null;
  isFirebaseAdmin: boolean;
  authReady: boolean;
  signInWithGoogle: () => Promise<User | null>;
  signOutGoogle: () => Promise<void>;
  syncAllToFirestore: () => Promise<boolean>;
  isAdminModalOpen: boolean;
  adminInitialTab: 'info' | 'colors' | 'images' | 'services' | 'slots' | 'calendar' | 'bookings' | 'supabase';
  isBookingModalOpen: boolean;
  selectedServiceForBooking: ServiceItem | null;
  selectionTrigger: number; // Timestamp to force sync
  isSearchOpen: boolean;
  isFavoritesOpen: boolean;
  favoriteServiceIds: string[];
  openSearch: () => void;
  closeSearch: () => void;
  openFavorites: () => void;
  closeFavorites: () => void;
  toggleFavorite: (serviceId: string) => void;
  canUndo: boolean;
  undoLastChange: () => Promise<boolean>;
  openBookingForService: (service?: ServiceItem) => void;
  closeBooking: () => void;
  openAdmin: (initialTab?: 'info' | 'colors' | 'images' | 'services' | 'slots' | 'supabase' | any) => void;
  closeAdmin: () => void;
  verifyPin: (pin: string) => Promise<boolean>;
  logoutAdmin: () => void;
  createAppointment: (data: Omit<Appointment, 'id' | 'status' | 'created_at'>) => Promise<Appointment>;
  updateAppointmentStatus: (id: string, status: Appointment['status']) => Promise<void>;
  updateSettings: (newSettings: Partial<BoutiqueSettings>) => Promise<SupabaseSyncResult>;
  updateImageSlots: (newSlots: Partial<ImageSlots>) => Promise<void>;
  updateServices: (newServices: ServiceItem[]) => Promise<SupabaseSyncResult>;
  updateCalendarSlots: (newSlots: CalendarTimeSlot[]) => Promise<void>;
  syncSettingsWithSupabase: (customSettings?: Partial<BoutiqueSettings>) => Promise<SupabaseSyncResult>;
  syncServicesWithSupabase: (customServices?: ServiceItem[]) => Promise<SupabaseSyncResult>;
  checkSupabaseStatus: () => Promise<SupabaseHealthStatus>;
  removeAppointment: (id: string) => Promise<void>;
  testSupabase: (url: string, key: string) => Promise<{ success: boolean; message: string }>;
  sendWhatsAppDirect: (customText?: string) => void;
}

const BoutiqueContext = createContext<BoutiqueContextType | undefined>(undefined);

export const BoutiqueProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<BoutiqueSettings>(() => {
    try {
      const local = localStorage.getItem('mt_settings_cache');
      if (!local) return defaultSettings;
      const parsed = JSON.parse(local);
      return {
        ...defaultSettings,
        ...parsed,
        whatsapp_number: (parsed?.whatsapp_number || '').trim() || defaultSettings.whatsapp_number,
        supabase_url: (parsed?.supabase_url || '').trim() || defaultSettings.supabase_url,
        supabase_anon_key: (parsed?.supabase_anon_key || '').trim() || defaultSettings.supabase_anon_key,
      };
    } catch {
      return defaultSettings;
    }
  });
  const [imageSlots, setImageSlots] = useState<ImageSlots>(() => {
    try {
      const local = localStorage.getItem('mt_imageslots_cache');
      return local ? { ...defaultImageSlots, ...JSON.parse(local) } : defaultImageSlots;
    } catch {
      return defaultImageSlots;
    }
  });
  const [services, setServices] = useState<ServiceItem[]>(() => {
    try {
      const local = localStorage.getItem('mt_services_cache');
      return local ? JSON.parse(local) : defaultServices;
    } catch {
      return defaultServices;
    }
  });
  const [calendarSlots, setCalendarSlots] = useState<CalendarTimeSlot[]>(() => {
    try {
      const local = localStorage.getItem('mt_slots_cache');
      return local ? JSON.parse(local) : defaultCalendarSlots;
    } catch {
      return defaultCalendarSlots;
    }
  });
  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    try {
      const local = localStorage.getItem('mt_appointments_cache');
      return local ? JSON.parse(local) : defaultAppointments;
    } catch {
      return defaultAppointments;
    }
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isSupabaseActive, setIsSupabaseActive] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return sessionStorage.getItem('mt_admin_auth') === 'true';
  });
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const isFirebaseAdmin = isVerifiedAdminUser(firebaseUser);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);
  const [adminInitialTab, setAdminInitialTab] = useState<
    'info' | 'colors' | 'images' | 'services' | 'slots' | 'calendar' | 'bookings' | 'supabase'
  >('info');
  const [isBookingModalOpen, setIsBookingModalOpen] = useState<boolean>(false);
  const [selectedServiceForBooking, setSelectedServiceForBooking] = useState<ServiceItem | null>(null);
  const [selectionTrigger, setSelectionTrigger] = useState<number>(0);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState<boolean>(false);
  const [favoriteServiceIds, setFavoriteServiceIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('mt_favorite_services');
      return saved ? JSON.parse(saved) : ['lashes-clusters-same-volume', 'nails-finger-french-tips'];
    } catch {
      return ['lashes-clusters-same-volume', 'nails-finger-french-tips'];
    }
  });

  const openSearch = () => setIsSearchOpen(true);
  const closeSearch = () => setIsSearchOpen(false);
  const openFavorites = () => setIsFavoritesOpen(true);
  const closeFavorites = () => setIsFavoritesOpen(false);

  const toggleFavorite = (serviceId: string) => {
    setFavoriteServiceIds((prev) => {
      const next = prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId];
      try {
        localStorage.setItem('mt_favorite_services', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  // Undo History Snapshot Stack
  const [historyStack, setHistoryStack] = useState<
    Array<{
      settings: BoutiqueSettings;
      imageSlots: ImageSlots;
      services: ServiceItem[];
      calendarSlots: CalendarTimeSlot[];
    }>
  >([]);

  const pushHistorySnapshot = useCallback(() => {
    setHistoryStack((prev) => [
      ...prev.slice(-15),
      { settings, imageSlots, services, calendarSlots },
    ]);
  }, [settings, imageSlots, services, calendarSlots]);

  // Client Supabase instance
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient | null>(null);
  const storeUpdatedAtRef = useRef<number>((() => {
    try {
      return Number(localStorage.getItem('mt_store_updated_at') || '0') || 0;
    } catch {
      return 0;
    }
  })());
  const servicesSaveSeqRef = useRef<number>(0);
  const settingsSaveSeqRef = useRef<number>(0);
  const isAdminModalOpenRef = useRef<boolean>(false);
  isAdminModalOpenRef.current = isAdminModalOpen;

  const setStoreUpdatedAt = useCallback((ts: number) => {
    if (ts > 0) {
      storeUpdatedAtRef.current = ts;
      try {
        localStorage.setItem('mt_store_updated_at', String(ts));
      } catch (e) {}
    }
  }, []);

  const notifyLocalTabs = useCallback((type: RealtimeMessage['type'], data: any, timestamp: number) => {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('mt_boutique_sync');
        bc.postMessage({ type, data, timestamp });
        bc.close();
      }
    } catch (e) {}
  }, []);

  // Initialize Supabase if credentials exist (with env fallback)
  useEffect(() => {
    const effectiveUrl =
      settings.supabase_url ||
      (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_URL : '') ||
      (import.meta as any).env?.VITE_SUPABASE_URL ||
      'https://hoeztqucwukrqelltlsm.supabase.co';
    const effectiveKey =
      settings.supabase_anon_key ||
      (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_ANON_KEY : '') ||
      (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
      'sb_publishable_8DUKtlDn88mv3gnt9VujNA_faCE03Wk';

    if (effectiveUrl && effectiveKey) {
      try {
        const client = createClient(effectiveUrl, effectiveKey);
        setSupabaseClient(client);
        setIsSupabaseActive(true);

        // Fetch cloud settings (and bundled imageSlots/calendarSlots) from Supabase on start
        // Only apply if Supabase timestamp is strictly newer than current local/server bootstrap store
        fetchSettingsFromSupabase(client).then((res) => {
          if (res.success && res.settings) {
            const cloudTs = Number(res.updatedAt || 0);
            if (cloudTs > storeUpdatedAtRef.current) {
              setStoreUpdatedAt(cloudTs);
              setSettings((prev) => {
                const merged = {
                  ...prev,
                  ...res.settings,
                  supabase_url: (res.settings?.supabase_url || '').trim() || prev.supabase_url || defaultSettings.supabase_url,
                  supabase_anon_key: (res.settings?.supabase_anon_key || '').trim() || prev.supabase_anon_key || defaultSettings.supabase_anon_key,
                };
                try {
                  localStorage.setItem('mt_settings_cache', JSON.stringify(merged));
                } catch (e) {}
                return merged;
              });
              if (res.imageSlots) {
                setImageSlots((prev) => {
                  const next = { ...defaultImageSlots, ...prev, ...res.imageSlots };
                  try {
                    localStorage.setItem('mt_imageslots_cache', JSON.stringify(next));
                  } catch (e) {}
                  return next;
                });
              }
              if (res.calendarSlots) {
                setCalendarSlots(res.calendarSlots);
                try {
                  localStorage.setItem('mt_slots_cache', JSON.stringify(res.calendarSlots));
                } catch (e) {}
              }
            }
          }
        });

        // Fetch cloud services from Supabase on start (only apply if strictly newer than local/bootstrap store)
        fetchServicesFromSupabase(client).then((res) => {
          if (res.success && res.services && res.services.length > 0) {
            const cloudTs = Number(res.updatedAt || 0);
            if (cloudTs > storeUpdatedAtRef.current) {
              setServices(res.services);
              try {
                localStorage.setItem('mt_services_cache', JSON.stringify(res.services));
              } catch (e) {}
            }
          }
        });

        // Supabase Postgres changes listener: appointments
        const aptChannel = client
          .channel('public:appointments')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'appointments' },
            (payload) => {
              if (payload.eventType === 'INSERT') {
                const newApt = payload.new as Appointment;
                setAppointments((prev) => {
                  if (prev.some((a) => a.id === newApt.id)) return prev;
                  return [newApt, ...prev];
                });
              } else if (payload.eventType === 'UPDATE') {
                const updatedApt = payload.new as Appointment;
                setAppointments((prev) =>
                  prev.map((a) => (a.id === updatedApt.id ? updatedApt : a))
                );
              }
            }
          )
          .subscribe();

        // Supabase Postgres changes listener: boutique_settings
        const settingsChannel = client
          .channel('public:boutique_settings')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'boutique_settings' },
            (payload) => {
              if (payload.new) {
                const row = payload.new as any;
                const rawJson = row.settings ? { ...row.settings } : { ...row };
                const cloudImages = rawJson._image_slots;
                const cloudSlots = rawJson._calendar_slots;
                const cloudTs = Number(rawJson._updated_at || 0) || (row.updated_at ? Date.parse(row.updated_at) || 0 : 0);
                delete rawJson._image_slots;
                delete rawJson._calendar_slots;
                delete rawJson._updated_at;

                if (cloudTs > 0 && cloudTs < storeUpdatedAtRef.current) {
                  return;
                }
                if (cloudTs > 0) {
                  setStoreUpdatedAt(cloudTs);
                }

                setSettings((prev) => {
                  const merged = { ...prev, ...rawJson };
                  try {
                    localStorage.setItem('mt_settings_cache', JSON.stringify(merged));
                  } catch (e) {}
                  return merged;
                });
                if (cloudImages) {
                  setImageSlots((prev) => {
                    const next = { ...defaultImageSlots, ...prev, ...cloudImages };
                    try {
                      localStorage.setItem('mt_imageslots_cache', JSON.stringify(next));
                    } catch (e) {}
                    return next;
                  });
                }
                if (Array.isArray(cloudSlots)) {
                  setCalendarSlots(cloudSlots);
                  try {
                    localStorage.setItem('mt_slots_cache', JSON.stringify(cloudSlots));
                  } catch (e) {}
                }
              }
            }
          )
          .subscribe();

        // Supabase Postgres changes listener: services
        const servicesChannel = client
          .channel('public:services')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'services' },
            async () => {
              const res = await fetchServicesFromSupabase(client);
              if (res.success && res.services) {
                const cloudTs = Number(res.updatedAt || 0);
                if (cloudTs > 0 && cloudTs < storeUpdatedAtRef.current) {
                  return;
                }
                setServices(res.services);
                try {
                  localStorage.setItem('mt_services_cache', JSON.stringify(res.services));
                } catch (e) {}
              }
            }
          )
          .subscribe();

        return () => {
          client.removeChannel(aptChannel);
          client.removeChannel(settingsChannel);
          client.removeChannel(servicesChannel);
        };
      } catch (err) {
        console.warn('Supabase client initialization warning:', err);
        setIsSupabaseActive(false);
      }
    } else {
      setSupabaseClient(null);
      setIsSupabaseActive(false);
    }
  }, [settings.supabase_url, settings.supabase_anon_key]);

  // Initial Bootstrap from Server (no-store so live visitors always receive latest published changes)
  const fetchBootstrap = useCallback(async () => {
    try {
      const res = await fetch(`/api/bootstrap?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const serverUpdatedAt = Number(json.data.updatedAt || 0);
          const localUpdatedAt = storeUpdatedAtRef.current;
          const hasAnyLocalCustom =
            localStorage.getItem('mt_services_customized') === 'true' ||
            localStorage.getItem('mt_settings_customized') === 'true' ||
            localStorage.getItem('mt_images_customized') === 'true' ||
            localStorage.getItem('mt_slots_customized') === 'true';

          // If the server restarted completely fresh (updatedAt === 0) while this admin browser has newer customized cache,
          // restore the server store from this browser's cache. Otherwise server data is authoritative!
          if (serverUpdatedAt === 0 && hasAnyLocalCustom && localUpdatedAt > 0) {
            try {
              const cachedSettings = localStorage.getItem('mt_settings_cache');
              const cachedImages = localStorage.getItem('mt_imageslots_cache');
              const cachedServices = localStorage.getItem('mt_services_cache');
              const cachedSlots = localStorage.getItem('mt_slots_cache');
              const payload = {
                settings: cachedSettings ? JSON.parse(cachedSettings) : defaultSettings,
                imageSlots: cachedImages ? JSON.parse(cachedImages) : defaultImageSlots,
                services: cachedServices ? JSON.parse(cachedServices) : defaultServices,
                calendarSlots: cachedSlots ? JSON.parse(cachedSlots) : defaultCalendarSlots,
                updatedAt: localUpdatedAt,
              };
              await fetch('/api/sync-store', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });
            } catch (e) {}
            return;
          }

          if (json.data.settings) {
            setSettings(json.data.settings);
            try {
              localStorage.setItem('mt_settings_cache', JSON.stringify(json.data.settings));
            } catch (e) {}
          }
          if (json.data.imageSlots) {
            setImageSlots(json.data.imageSlots);
            try {
              localStorage.setItem('mt_imageslots_cache', JSON.stringify(json.data.imageSlots));
            } catch (e) {}
          }
          if (Array.isArray(json.data.services)) {
            setServices(json.data.services);
            try {
              localStorage.setItem('mt_services_cache', JSON.stringify(json.data.services));
            } catch (e) {}
          }
          if (Array.isArray(json.data.calendarSlots)) {
            setCalendarSlots(json.data.calendarSlots);
            try {
              localStorage.setItem('mt_slots_cache', JSON.stringify(json.data.calendarSlots));
            } catch (e) {}
          }
          if (Array.isArray(json.data.appointments)) {
            setAppointments(json.data.appointments);
            try {
              localStorage.setItem('mt_appointments_cache', JSON.stringify(json.data.appointments));
            } catch (e) {}
          }
          if (serverUpdatedAt > 0) {
            setStoreUpdatedAt(serverUpdatedAt);
          }

          if (json.hasSupabase) {
            setIsSupabaseActive(true);
          }
        }
      }
    } catch (err) {
      console.warn('Bootstrap fetch note, preserving local cache:', err);
    } finally {
      setIsLoading(false);
    }
  }, [setStoreUpdatedAt]);

  useEffect(() => {
    fetchBootstrap();
  }, [fetchBootstrap]);

  // Firebase Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (user && user.emailVerified) {
        try {
          await upsertUserProfileInFirestore(user);
        } catch (err) {
          console.warn('User profile sync note:', err);
        }
        if (isVerifiedAdminUser(user)) {
          setIsAdmin(true);
          try {
            sessionStorage.setItem('mt_admin_auth', 'true');
          } catch {}
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Public storefront hydration from Firestore (only apply if strictly newer than current store)
  useEffect(() => {
    let active = true;
    fetchPublicBoutiqueFromFirestore()
      .then((payload) => {
        if (!active || !payload) return;
        if (payload.updatedAt > storeUpdatedAtRef.current) {
          setStoreUpdatedAt(payload.updatedAt);
          if (payload.settings) {
            setSettings((prev) => {
              const merged = { ...prev, ...payload.settings };
              try {
                localStorage.setItem('mt_settings_cache', JSON.stringify(merged));
              } catch {}
              return merged;
            });
          }
          if (payload.imageSlots) {
            setImageSlots((prev) => {
              const merged = { ...defaultImageSlots, ...prev, ...payload.imageSlots };
              try {
                localStorage.setItem('mt_imageslots_cache', JSON.stringify(merged));
              } catch {}
              return merged;
            });
          }
          if (Array.isArray(payload.calendarSlots) && payload.calendarSlots.length > 0) {
            setCalendarSlots(payload.calendarSlots);
            try {
              localStorage.setItem('mt_slots_cache', JSON.stringify(payload.calendarSlots));
            } catch {}
          }
          if (Array.isArray(payload.services) && payload.services.length > 0) {
            setServices(payload.services);
            try {
              localStorage.setItem('mt_services_cache', JSON.stringify(payload.services));
            } catch {}
          }
        }
      })
      .catch((err) => {
        console.warn('Firestore public hydration note:', err);
      });
    return () => {
      active = false;
    };
  }, [setStoreUpdatedAt]);

  // Real-time Firestore appointments subscription (strictly gated on authReady && verified user)
  useEffect(() => {
    if (!authReady || !firebaseUser || !firebaseUser.emailVerified) return;
    const unsubscribe = subscribeToAppointmentsInFirestore(
      firebaseUser,
      (cloudAppointments) => {
        if (cloudAppointments.length === 0) return;
        setAppointments((prev) => {
          const map = new Map<string, Appointment>();
          cloudAppointments.forEach((a) => map.set(a.id, a));
          if (!isVerifiedAdminUser(firebaseUser)) {
            prev.forEach((a) => {
              if (!map.has(a.id)) map.set(a.id, a);
            });
          }
          const merged = Array.from(map.values()).sort((a, b) =>
            (b.created_at || '').localeCompare(a.created_at || '')
          );
          try {
            localStorage.setItem('mt_appointments_cache', JSON.stringify(merged));
          } catch {}
          return merged;
        });
      },
      (err) => {
        console.warn('Firestore appointments listener note:', err);
      }
    );
    return () => unsubscribe();
  }, [authReady, firebaseUser]);

  // Handle incoming real-time messages (WebSocket, SSE, or BroadcastChannel)
  const handleRealtimeMessage = useCallback((msg: RealtimeMessage) => {
    switch (msg.type) {
      case 'INIT_STATE':
        if (msg.data) {
          const msgUpdatedAt = Number(msg.data.updatedAt || 0);
          // Only overwrite if server has saved data or is newer than local cache
          if (msgUpdatedAt === 0 && storeUpdatedAtRef.current > 0) {
            break;
          }
          if (msg.data.settings) {
            setSettings((prev) => {
              const next = { ...defaultSettings, ...prev, ...msg.data.settings };
              try { localStorage.setItem('mt_settings_cache', JSON.stringify(next)); } catch (e) {}
              return next;
            });
          }
          if (msg.data.imageSlots) {
            setImageSlots((prev) => {
              const next = { ...defaultImageSlots, ...prev, ...msg.data.imageSlots };
              try { localStorage.setItem('mt_imageslots_cache', JSON.stringify(next)); } catch (e) {}
              return next;
            });
          }
          if (Array.isArray(msg.data.services)) {
            setServices(msg.data.services);
            try { localStorage.setItem('mt_services_cache', JSON.stringify(msg.data.services)); } catch (e) {}
          }
          if (Array.isArray(msg.data.calendarSlots)) {
            setCalendarSlots(msg.data.calendarSlots);
            try { localStorage.setItem('mt_slots_cache', JSON.stringify(msg.data.calendarSlots)); } catch (e) {}
          }
          if (Array.isArray(msg.data.appointments)) {
            setAppointments(msg.data.appointments);
            try { localStorage.setItem('mt_appointments_cache', JSON.stringify(msg.data.appointments)); } catch (e) {}
          }
          if (msgUpdatedAt > 0) setStoreUpdatedAt(msgUpdatedAt);
        }
        break;

      case 'APPOINTMENT_CREATED':
        if (msg.data && msg.data.id) {
          setAppointments((prev) => {
            if (prev.some((a) => a.id === msg.data.id)) return prev;
            const next = [msg.data, ...prev];
            try { localStorage.setItem('mt_appointments_cache', JSON.stringify(next)); } catch (e) {}
            return next;
          });
        }
        break;

      case 'APPOINTMENT_UPDATED':
        if (msg.data && msg.data.id) {
          setAppointments((prev) => {
            const next = prev.map((a) => (a.id === msg.data.id ? msg.data : a));
            try { localStorage.setItem('mt_appointments_cache', JSON.stringify(next)); } catch (e) {}
            return next;
          });
        }
        break;

      case 'APPOINTMENT_DELETED':
        if (msg.data && msg.data.id) {
          setAppointments((prev) => {
            const next = prev.filter((a) => a.id !== msg.data.id);
            try { localStorage.setItem('mt_appointments_cache', JSON.stringify(next)); } catch (e) {}
            return next;
          });
        }
        break;

      case 'SETTINGS_UPDATED':
        if (msg.data) {
          setSettings((prev) => {
            const next = { ...prev, ...msg.data };
            try { localStorage.setItem('mt_settings_cache', JSON.stringify(next)); } catch (e) {}
            return next;
          });
          if (msg.timestamp) setStoreUpdatedAt(msg.timestamp);
        }
        break;

      case 'IMAGES_UPDATED':
        if (msg.data) {
          setImageSlots((prev) => {
            const next = { ...prev, ...msg.data };
            try { localStorage.setItem('mt_imageslots_cache', JSON.stringify(next)); } catch (e) {}
            return next;
          });
          if (msg.timestamp) setStoreUpdatedAt(msg.timestamp);
        }
        break;

      case 'SERVICES_UPDATED':
        if (Array.isArray(msg.data)) {
          setServices(msg.data);
          try { localStorage.setItem('mt_services_cache', JSON.stringify(msg.data)); } catch (e) {}
          if (msg.timestamp) setStoreUpdatedAt(msg.timestamp);
        }
        break;

      case 'SLOTS_UPDATED':
        if (Array.isArray(msg.data)) {
          setCalendarSlots(msg.data);
          try { localStorage.setItem('mt_slots_cache', JSON.stringify(msg.data)); } catch (e) {}
          if (msg.timestamp) setStoreUpdatedAt(msg.timestamp);
        }
        break;

      default:
        break;
    }
  }, [setStoreUpdatedAt]);

  // WebSocket + SSE + BroadcastChannel + Focus refresh for reliable live sync
  useEffect(() => {
    let ws: WebSocket | null = null;
    let sse: EventSource | null = null;
    let bc: BroadcastChannel | null = null;
    let reconnectTimeout: any = null;
    let wsConnected = false;
    let sseConnected = false;
    let lastFocusFetch = 0;
    let isDisposed = false;

    const updateConn = () => {
      setIsConnected(wsConnected || sseConnected);
    };

    const connectWebSocket = () => {
      if (isDisposed) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          wsConnected = true;
          updateConn();
        };

        ws.onmessage = (event) => {
          try {
            const msg: RealtimeMessage = JSON.parse(event.data);
            handleRealtimeMessage(msg);
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
          }
        };

        ws.onclose = () => {
          wsConnected = false;
          updateConn();
          if (!isDisposed) {
            reconnectTimeout = setTimeout(connectWebSocket, 3000);
          }
        };

        ws.onerror = () => {
          wsConnected = false;
          updateConn();
          ws?.close();
        };
      } catch (e) {
        wsConnected = false;
        updateConn();
        if (!isDisposed) {
          reconnectTimeout = setTimeout(connectWebSocket, 3000);
        }
      }
    };

    const connectSSE = () => {
      if (isDisposed || typeof EventSource === 'undefined') return;
      try {
        sse = new EventSource('/api/realtime-sse');
        sse.onopen = () => {
          sseConnected = true;
          updateConn();
        };
        sse.onmessage = (event) => {
          if (!event.data) return;
          try {
            const msg: RealtimeMessage = JSON.parse(event.data);
            handleRealtimeMessage(msg);
          } catch (e) {}
        };
        sse.onerror = () => {
          sseConnected = false;
          updateConn();
        };
      } catch (e) {}
    };

    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('mt_boutique_sync');
        bc.onmessage = (event) => {
          if (event.data && event.data.type) {
            handleRealtimeMessage(event.data);
          }
        };
      }
    } catch (e) {}

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'hidden') return;
      if (isAdminModalOpenRef.current) return;
      const now = Date.now();
      if (now - lastFocusFetch > 5000) {
        lastFocusFetch = now;
        fetchBootstrap();
      }
    };

    connectWebSocket();
    connectSSE();
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      isDisposed = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) ws.close();
      if (sse) sse.close();
      if (bc) bc.close();
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [fetchBootstrap, handleRealtimeMessage]);

  // Actions
  const openBookingForService = (service?: ServiceItem) => {
    const targetService = service || services[0] || null;
    setSelectedServiceForBooking(targetService);
    setSelectionTrigger(Date.now());
    setIsBookingModalOpen(false);

    setTimeout(() => {
      const bookingEl = document.getElementById('booking');
      if (bookingEl) {
        bookingEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  const closeBooking = () => {
    setIsBookingModalOpen(false);
    setSelectedServiceForBooking(null);
    setSelectionTrigger(Date.now());
  };

  const openAdmin = (initialTab?: unknown) => {
    if (typeof initialTab === 'string' && initialTab !== 'whatsapp') {
      setAdminInitialTab(initialTab as any);
    } else {
      setAdminInitialTab('info');
    }
    setIsAdminModalOpen(true);
  };

  const closeAdmin = () => {
    setIsAdminModalOpen(false);
  };

  const verifyPin = async (pin: string): Promise<boolean> => {
    const cleanPin = (pin || '').trim();
    if (cleanPin.toUpperCase() === 'MT1234') {
      setIsAdmin(true);
      try {
        sessionStorage.setItem('mt_admin_auth', 'true');
        fetch('/api/verify-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: cleanPin }),
        }).catch(() => null);
      } catch {
        // storage or fetch error ignored
      }
      return true;
    }

    try {
      const res = await fetch('/api/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: cleanPin }),
      });
      const data = await res.json();
      if (data.success) {
        setIsAdmin(true);
        sessionStorage.setItem('mt_admin_auth', 'true');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const logoutAdmin = () => {
    setIsAdmin(false);
    sessionStorage.removeItem('mt_admin_auth');
    if (auth.currentUser) {
      void signOut(auth).catch(() => {});
    }
  };

  const syncAllToFirestore = async (): Promise<boolean> => {
    if (!isVerifiedAdminUser(auth.currentUser)) return false;
    const results = await Promise.allSettled([
      syncBoutiqueConfigToFirestore(settings),
      syncImageSlotsToFirestore(imageSlots),
      syncCalendarSlotsToFirestore(calendarSlots),
      syncServicesToFirestore(services),
    ]);
    return results.every((r) => r.status === 'fulfilled' && r.value === true);
  };

  const signInWithGoogle = async (): Promise<User | null> => {
    const cred = await signInWithPopup(auth, googleAuthProvider);
    if (cred.user) {
      await upsertUserProfileInFirestore(cred.user);
      if (isVerifiedAdminUser(cred.user)) {
        setIsAdmin(true);
        try {
          sessionStorage.setItem('mt_admin_auth', 'true');
        } catch {}
        await Promise.allSettled([
          syncBoutiqueConfigToFirestore(settings),
          syncImageSlotsToFirestore(imageSlots),
          syncCalendarSlotsToFirestore(calendarSlots),
          syncServicesToFirestore(services),
        ]);
      }
    }
    return cred.user;
  };

  const signOutGoogle = async (): Promise<void> => {
    await signOut(auth);
  };

  const createAppointment = async (
    data: Omit<Appointment, 'id' | 'status' | 'created_at'>
  ): Promise<Appointment> => {
    let createdApt: Appointment | null = null;

    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const responseText = await res.text();
      if (res.ok && responseText) {
        try {
          const json = JSON.parse(responseText);
          if (json.appointment) {
            createdApt = json.appointment;
          }
        } catch (parseErr) {
          console.warn('Server response was not JSON:', parseErr);
        }
      }
    } catch (err) {
      console.warn('Network or API endpoint note, proceeding with client-side booking:', err);
    }

    // Failsafe: Guarantee appointment object exists even if backend returns non-JSON or HTML 500 error
    if (!createdApt) {
      const service = services.find((s) => s.id === data.service_id);
      createdApt = {
        id: `MT-${Math.floor(10000 + Math.random() * 90000)}`,
        client_name: data.client_name,
        client_phone: data.client_phone || 'WhatsApp Direct',
        client_email: data.client_email || '',
        service_id: data.service_id,
        service_title: data.service_title || service?.title || 'Bespoke Consultation',
        category: data.category || service?.category || 'nails',
        date: data.date,
        time_slot: data.time_slot,
        notes: data.notes || '',
        status: 'pending',
        created_at: new Date().toISOString(),
      };
    }

    setAppointments((prev) => {
      if (prev.some((a) => a.id === createdApt!.id)) return prev;
      const next = [createdApt!, ...prev];
      try {
        localStorage.setItem('mt_appointments_cache', JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    if (supabaseClient) {
      try {
        Promise.resolve(supabaseClient.from('appointments').insert([createdApt])).catch(() => {});
      } catch (e) {}
    }

    if (auth.currentUser?.emailVerified) {
      createAppointmentInFirestore(createdApt).catch((err) => {
        console.warn('Firestore appointment sync note:', err);
      });
    }

    if (settings.calendar_sync_enabled !== false) {
      try {
        await syncAppointmentToGoogleCalendar(createdApt);
      } catch (calErr) {
        console.warn('Google Calendar sync warning:', calErr);
      }
    }

    return createdApt;
  };

  const updateAppointmentStatus = async (
    id: string,
    status: Appointment['status']
  ): Promise<void> => {
    setAppointments((prev) => {
      const next = prev.map((a) => (a.id === id ? { ...a, status } : a));
      try {
        localStorage.setItem('mt_appointments_cache', JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    if (supabaseClient) {
      try {
        Promise.resolve(supabaseClient.from('appointments').update({ status }).eq('id', id)).catch(() => {});
      } catch (e) {}
    }

    if (auth.currentUser?.emailVerified) {
      updateAppointmentStatusInFirestore(id, status).catch((err) => {
        console.warn('Firestore appointment status note:', err);
      });
    }

    try {
      await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
    } catch (err) {
      console.warn('Server status update note:', err);
    }
  };

  const undoLastChange = async (): Promise<boolean> => {
    if (historyStack.length === 0) return false;
    const lastSnapshot = historyStack[historyStack.length - 1];
    setHistoryStack((prev) => prev.slice(0, prev.length - 1));

    try {
      await Promise.all([
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lastSnapshot.settings),
        }),
        fetch('/api/image-slots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lastSnapshot.imageSlots),
        }),
        fetch('/api/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ services: lastSnapshot.services }),
        }),
        fetch('/api/slots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slots: lastSnapshot.calendarSlots }),
        }),
      ]);
      setSettings(lastSnapshot.settings);
      setImageSlots(lastSnapshot.imageSlots);
      setServices(lastSnapshot.services);
      setCalendarSlots(lastSnapshot.calendarSlots);
      if (isVerifiedAdminUser(auth.currentUser)) {
        void Promise.allSettled([
          syncBoutiqueConfigToFirestore(lastSnapshot.settings),
          syncImageSlotsToFirestore(lastSnapshot.imageSlots),
          syncServicesToFirestore(lastSnapshot.services),
          syncCalendarSlotsToFirestore(lastSnapshot.calendarSlots),
        ]);
      }
      return true;
    } catch {
      return false;
    }
  };

  const updateSettings = async (newSettings: Partial<BoutiqueSettings>): Promise<SupabaseSyncResult> => {
    const seq = ++settingsSaveSeqRef.current;
    pushHistorySnapshot();

    // 1. Update React state & localStorage immediately
    let mergedSettings: BoutiqueSettings = { ...settings, ...newSettings };
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      mergedSettings = updated;
      try {
        localStorage.setItem('mt_settings_cache', JSON.stringify(updated));
        localStorage.setItem('mt_settings_customized', 'true');
      } catch (e) {}
      return updated;
    });

    const localTs = Date.now();
    setStoreUpdatedAt(localTs);
    notifyLocalTabs('SETTINGS_UPDATED', mergedSettings, localTs);

    // 2. Await backend API persistence & live broadcast
    let backendSaved = false;
    let backendErrorMsg = '';
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      if (res.ok) {
        const json = await res.json();
        backendSaved = Boolean(json.success);
        if (seq === settingsSaveSeqRef.current && json.settings) {
          mergedSettings = json.settings;
          setSettings(json.settings);
          try {
            localStorage.setItem('mt_settings_cache', JSON.stringify(json.settings));
          } catch (e) {}
          if (json.updatedAt) setStoreUpdatedAt(json.updatedAt);
        }
      } else {
        backendErrorMsg = `Server responded with status ${res.status}`;
      }
    } catch (err: any) {
      backendErrorMsg = err?.message || 'Network error reaching live server';
      console.warn('Backend sync note (settings saved in browser):', err);
    }

    // 3. Best-effort mirror to Supabase database (with imageSlots & calendarSlots bundled)
    let supabaseResult: SupabaseSyncResult | null = null;
    if (supabaseClient) {
      try {
        supabaseResult = await syncSettingsToSupabase(supabaseClient, mergedSettings, {
          imageSlots,
          calendarSlots,
          updatedAt: localTs,
        });
      } catch (err: any) {
        supabaseResult = {
          success: false,
          code: 'SYNC_ERROR',
          message: err?.message || 'Supabase error',
        };
      }
    }

    // 4. Mirror to Firestore when admin is signed in via Google Auth
    let firebaseOk = false;
    if (isVerifiedAdminUser(auth.currentUser)) {
      try {
        firebaseOk = await syncBoutiqueConfigToFirestore(mergedSettings);
      } catch (err) {
        console.warn('Firestore settings sync note:', err);
      }
    }

    if (backendSaved) {
      const destinations = ['live webpage'];
      if (firebaseOk) destinations.push('Firestore');
      if (supabaseResult?.success) destinations.push('Supabase');
      return {
        success: true,
        message: `Settings published to ${destinations.join(' & ')}!`,
      };
    }

    if (firebaseOk) {
      return {
        success: true,
        message: 'Settings synced to Firestore!',
      };
    }

    if (supabaseResult?.success) {
      return supabaseResult;
    }

    return {
      success: false,
      code: 'SAVE_ERROR',
      message: backendErrorMsg || supabaseResult?.message || 'Could not reach live server to publish settings.',
    };
  };

  const updateImageSlots = async (newSlots: Partial<ImageSlots>): Promise<void> => {
    pushHistorySnapshot();

    let updatedSlots: ImageSlots = { ...imageSlots, ...newSlots };
    setImageSlots((prev) => {
      const updated = { ...prev, ...newSlots };
      updatedSlots = updated;
      try {
        localStorage.setItem('mt_imageslots_cache', JSON.stringify(updated));
        localStorage.setItem('mt_images_customized', 'true');
      } catch (e) {}
      return updated;
    });

    const localTs = Date.now();
    setStoreUpdatedAt(localTs);
    notifyLocalTabs('IMAGES_UPDATED', updatedSlots, localTs);

    let backendSaved = false;
    try {
      const res = await fetch('/api/image-slots', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSlots),
      });
      if (res.ok) {
        backendSaved = true;
        const json = await res.json();
        if (json.imageSlots) {
          updatedSlots = json.imageSlots;
          setImageSlots(json.imageSlots);
          try {
            localStorage.setItem('mt_imageslots_cache', JSON.stringify(json.imageSlots));
          } catch (e) {}
          if (json.updatedAt) setStoreUpdatedAt(json.updatedAt);
        }
      }
    } catch (e) {}

    let supabaseOk = false;
    if (supabaseClient) {
      try {
        const sRes = await syncSettingsToSupabase(supabaseClient, settings, {
          imageSlots: updatedSlots,
          calendarSlots,
          updatedAt: localTs,
        });
        supabaseOk = sRes.success;
      } catch {}
    }

    let firebaseOk = false;
    if (isVerifiedAdminUser(auth.currentUser)) {
      try {
        firebaseOk = await syncImageSlotsToFirestore(updatedSlots);
      } catch (err) {
        console.warn('Firestore image slots sync note:', err);
      }
    }

    if (!backendSaved && !supabaseOk && !firebaseOk) {
      throw new Error('Failed to publish image updates to server or cloud database');
    }
  };

  const updateServices = async (newServices: ServiceItem[]): Promise<SupabaseSyncResult> => {
    const seq = ++servicesSaveSeqRef.current;
    pushHistorySnapshot();

    const sanitized = newServices.map((s, idx) => ({
      ...s,
      number: s.number || String(idx + 1).padStart(2, '0'),
      price: Number.isFinite(Number(s.price)) ? Number(s.price) : 0,
      duration_min: Number.isFinite(Number(s.duration_min)) ? Number(s.duration_min) : 0,
      hide_duration: Boolean(s.hide_duration),
      is_popular: Boolean(s.is_popular),
      is_active: s.is_active !== false,
    }));

    setServices(sanitized);
    try {
      localStorage.setItem('mt_services_cache', JSON.stringify(sanitized));
      localStorage.setItem('mt_services_customized', 'true');
    } catch (e) {}

    const localTs = Date.now();
    setStoreUpdatedAt(localTs);
    notifyLocalTabs('SERVICES_UPDATED', sanitized, localTs);

    let backendSaved = false;
    let backendErrorMsg = '';
    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ services: sanitized }),
      });
      if (res.ok) {
        const json = await res.json();
        backendSaved = Boolean(json.success);
        if (seq === servicesSaveSeqRef.current && Array.isArray(json.services)) {
          setServices(json.services);
          try {
            localStorage.setItem('mt_services_cache', JSON.stringify(json.services));
          } catch (e) {}
          if (json.updatedAt) setStoreUpdatedAt(json.updatedAt);
        }
      } else {
        backendErrorMsg = `Server responded with status ${res.status}`;
      }
    } catch (err: any) {
      backendErrorMsg = err?.message || 'Network error reaching live server';
      console.warn('Backend sync note (services saved in browser):', err);
    }

    // Best-effort mirror to Supabase database
    let supabaseResult: SupabaseSyncResult | null = null;
    if (supabaseClient) {
      try {
        supabaseResult = await syncServicesToSupabase(supabaseClient, sanitized);
      } catch (err: any) {
        supabaseResult = {
          success: false,
          code: 'SYNC_ERROR',
          message: err?.message || 'Supabase error',
        };
      }
    }

    let firebaseOk = false;
    if (isVerifiedAdminUser(auth.currentUser)) {
      try {
        firebaseOk = await syncServicesToFirestore(sanitized);
      } catch (err) {
        console.warn('Firestore services sync note:', err);
      }
    }

    if (backendSaved) {
      const destinations = ['live webpage'];
      if (firebaseOk) destinations.push('Firestore');
      if (supabaseResult?.success) destinations.push('Supabase');
      return {
        success: true,
        message: `Published ${sanitized.length} treatments to ${destinations.join(' & ')}!`,
      };
    }

    if (firebaseOk) {
      return {
        success: true,
        message: `Synced ${sanitized.length} treatments to Firestore!`,
      };
    }

    if (supabaseResult?.success) {
      return supabaseResult;
    }

    return {
      success: false,
      code: 'SAVE_ERROR',
      message: backendErrorMsg || supabaseResult?.message || 'Failed to publish services to live server.',
    };
  };

  const syncSettingsWithSupabase = async (
    customSettings?: Partial<BoutiqueSettings>
  ): Promise<SupabaseSyncResult> => {
    if (!supabaseClient) {
      return {
        success: false,
        code: 'NO_CLIENT',
        message: 'Supabase client is not connected. Enter your project URL and public anon key in the Supabase tab.',
      };
    }
    return syncSettingsToSupabase(supabaseClient, customSettings || settings, {
      imageSlots,
      calendarSlots,
      updatedAt: storeUpdatedAtRef.current || Date.now(),
    });
  };

  const syncServicesWithSupabase = async (
    customServices?: ServiceItem[]
  ): Promise<SupabaseSyncResult> => {
    if (!supabaseClient) {
      return {
        success: false,
        code: 'NO_CLIENT',
        message: 'Supabase client is not connected. Enter your project URL and public anon key in the Supabase tab.',
      };
    }
    return syncServicesToSupabase(supabaseClient, customServices || services);
  };

  const checkSupabaseStatus = async (): Promise<SupabaseHealthStatus> => {
    if (!supabaseClient) {
      return {
        connected: false,
        settingsTable: 'error',
        servicesTable: 'error',
        appointmentsTable: 'error',
        message: 'Supabase client not initialized.',
      };
    }
    return checkSupabaseHealth(supabaseClient);
  };

  const updateCalendarSlots = async (newSlots: CalendarTimeSlot[]): Promise<void> => {
    pushHistorySnapshot();

    setCalendarSlots(newSlots);
    try {
      localStorage.setItem('mt_slots_cache', JSON.stringify(newSlots));
      localStorage.setItem('mt_slots_customized', 'true');
    } catch (e) {}

    const localTs = Date.now();
    setStoreUpdatedAt(localTs);
    notifyLocalTabs('SLOTS_UPDATED', newSlots, localTs);

    let backendSaved = false;
    try {
      const res = await fetch('/api/slots', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots: newSlots }),
      });
      if (res.ok) {
        backendSaved = true;
        const json = await res.json();
        if (json.slots) {
          setCalendarSlots(json.slots);
          try {
            localStorage.setItem('mt_slots_cache', JSON.stringify(json.slots));
          } catch (e) {}
          if (json.updatedAt) setStoreUpdatedAt(json.updatedAt);
        }
      }
    } catch {}

    let supabaseOk = false;
    if (supabaseClient) {
      try {
        const sRes = await syncSettingsToSupabase(supabaseClient, settings, {
          imageSlots,
          calendarSlots: newSlots,
          updatedAt: localTs,
        });
        supabaseOk = sRes.success;
      } catch {}
    }

    let firebaseOk = false;
    if (isVerifiedAdminUser(auth.currentUser)) {
      try {
        firebaseOk = await syncCalendarSlotsToFirestore(newSlots);
      } catch (err) {
        console.warn('Firestore slots sync note:', err);
      }
    }

    if (!backendSaved && !supabaseOk && !firebaseOk) {
      throw new Error('Failed to publish calendar slots to server or cloud database');
    }
  };

  const removeAppointment = async (id: string) => {
    setAppointments((prev) => {
      const next = prev.filter((a) => a.id !== id);
      localStorage.setItem('mt_appointments_cache', JSON.stringify(next));
      return next;
    });

    if (supabaseClient) {
      try {
        Promise.resolve(supabaseClient.from('appointments').delete().eq('id', id)).catch(() => {});
      } catch (e) {}
    }

    if (isVerifiedAdminUser(auth.currentUser)) {
      deleteAppointmentInFirestore(id).catch((err) => {
        console.warn('Firestore appointment delete note:', err);
      });
    }

    try {
      await fetch(`/api/appointments/${id}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.warn('Server delete note:', err);
    }
  };

  const testSupabase = async (
    url: string,
    key: string
  ): Promise<{ success: boolean; message: string }> => {
    const res = await fetch('/api/test-supabase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, key }),
    });

    const json = await res.json();
    return {
      success: json.success,
      message: json.message || (json.success ? 'Connected' : 'Connection failed'),
    };
  };

  const sendWhatsAppDirect = (customText?: string) => {
    const cleanNumber = settings.whatsapp_number.replace(/[^0-9]/g, '');
    const message = customText || settings.whatsapp_default_message;
    const url = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <BoutiqueContext.Provider
      value={{
        settings,
        imageSlots,
        services,
        calendarSlots,
        appointments,
        isLoading,
        isConnected,
        isSupabaseActive,
        supabaseClient,
        isAdmin,
        firebaseUser,
        isFirebaseAdmin,
        authReady,
        signInWithGoogle,
        signOutGoogle,
        syncAllToFirestore,
        isAdminModalOpen,
        adminInitialTab,
        isBookingModalOpen,
        selectedServiceForBooking,
        selectionTrigger,
        isSearchOpen,
        isFavoritesOpen,
        favoriteServiceIds,
        openSearch,
        closeSearch,
        openFavorites,
        closeFavorites,
        toggleFavorite,
        canUndo: historyStack.length > 0,
        undoLastChange,
        openBookingForService,
        closeBooking,
        openAdmin,
        closeAdmin,
        verifyPin,
        logoutAdmin,
        createAppointment,
        updateAppointmentStatus,
        updateSettings,
        updateImageSlots,
        updateServices,
        updateCalendarSlots,
        syncSettingsWithSupabase,
        syncServicesWithSupabase,
        checkSupabaseStatus,
        removeAppointment,
        testSupabase,
        sendWhatsAppDirect,
      }}
    >
      {children}
    </BoutiqueContext.Provider>
  );
};

export const useBoutique = () => {
  const context = useContext(BoutiqueContext);
  if (!context) {
    throw new Error('useBoutique must be used within a BoutiqueProvider');
  }
  return context;
};
