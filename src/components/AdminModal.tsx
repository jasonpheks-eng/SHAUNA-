import React, { useState } from 'react';
import { useBoutique } from '../context/BoutiqueContext';
import {
  X,
  Lock,
  Calendar,
  MessageCircle,
  Image as ImageIcon,
  DollarSign,
  Clock,
  Settings,
  Database,
  CheckCircle,
  AlertCircle,
  LogOut,
  RotateCcw,
  Palette,
  Save,
  ShieldCheck,
  Eye,
  EyeOff,
} from 'lucide-react';

import { TabLoader } from './admin/TabLoader';

// Lazy-loaded Admin Tabs for code splitting and instant mobile responsiveness
const TabInfo = React.lazy(() => import('./admin/tabs/TabInfo').then((m) => ({ default: m.TabInfo })));
const TabColors = React.lazy(() => import('./admin/tabs/TabColors').then((m) => ({ default: m.TabColors })));
const TabImages = React.lazy(() => import('./admin/tabs/TabImages').then((m) => ({ default: m.TabImages })));
const TabServices = React.lazy(() => import('./admin/tabs/TabServices').then((m) => ({ default: m.TabServices })));
const TabSlots = React.lazy(() => import('./admin/tabs/TabSlots').then((m) => ({ default: m.TabSlots })));
const TabCalendar = React.lazy(() => import('./admin/tabs/TabCalendar').then((m) => ({ default: m.TabCalendar })));
const TabBookingsCalendar = React.lazy(() => import('./admin/tabs/TabBookingsCalendar').then((m) => ({ default: m.TabBookingsCalendar })));
const TabSupabase = React.lazy(() => import('./admin/tabs/TabSupabase').then((m) => ({ default: m.TabSupabase })));

export const AdminModal: React.FC = () => {
  const {
    isAdminModalOpen,
    closeAdmin,
    isAdmin,
    firebaseUser,
    isFirebaseAdmin,
    signInWithGoogle,
    signOutGoogle,
    syncAllToFirestore,
    verifyPin,
    logoutAdmin,
    settings,
    updateSettings,
    imageSlots,
    updateImageSlots,
    services,
    updateServices,
    calendarSlots,
    updateCalendarSlots,
    syncSettingsWithSupabase,
    syncServicesWithSupabase,
    checkSupabaseStatus,
    testSupabase,
    isSupabaseActive,
    isConnected,
    adminInitialTab,
    canUndo,
    undoLastChange,
  } = useBoutique();

  // Pin entry & Google Sign-In state
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Active Admin Tab
  const [activeTab, setActiveTab] = useState<
    'info' | 'colors' | 'images' | 'services' | 'slots' | 'calendar' | 'bookings' | 'supabase'
  >('info');

  // Local state for forms
  const [settingsForm, setSettingsFormState] = useState(settings);
  const [imageSlotsForm, setImageSlotsFormState] = useState(imageSlots);
  const [servicesList, setServicesListState] = useState(services);
  const [slotsList, setSlotsListState] = useState(calendarSlots);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingImages, setIsSavingImages] = useState(false);
  const [isSavingServices, setIsSavingServices] = useState(false);
  const [isSavingSlots, setIsSavingSlots] = useState(false);

  // Refs & dirty flags so background WebSocket updates never wipe active edits and saves never read stale closures
  const wasOpenRef = React.useRef(false);
  const settingsDirtyRef = React.useRef(false);
  const imagesDirtyRef = React.useRef(false);
  const servicesDirtyRef = React.useRef(false);
  const slotsDirtyRef = React.useRef(false);

  const settingsFormRef = React.useRef(settingsForm);
  const imageSlotsFormRef = React.useRef(imageSlotsForm);
  const servicesListRef = React.useRef(servicesList);
  const slotsListRef = React.useRef(slotsList);

  const setSettingsForm: React.Dispatch<React.SetStateAction<typeof settings>> = React.useCallback((updater) => {
    settingsDirtyRef.current = true;
    setSettingsFormState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      settingsFormRef.current = next;
      return next;
    });
  }, []);

  const setImageSlotsForm: React.Dispatch<React.SetStateAction<typeof imageSlots>> = React.useCallback((updater) => {
    imagesDirtyRef.current = true;
    setImageSlotsFormState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      imageSlotsFormRef.current = next;
      return next;
    });
  }, []);

  const setServicesList: React.Dispatch<React.SetStateAction<typeof services>> = React.useCallback((updater) => {
    servicesDirtyRef.current = true;
    setServicesListState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      servicesListRef.current = next;
      return next;
    });
  }, []);

  const setSlotsList: React.Dispatch<React.SetStateAction<typeof calendarSlots>> = React.useCallback((updater) => {
    slotsDirtyRef.current = true;
    setSlotsListState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      slotsListRef.current = next;
      return next;
    });
  }, []);

  // Hydrate forms when modal opens
  React.useEffect(() => {
    if (isAdminModalOpen && !wasOpenRef.current) {
      settingsDirtyRef.current = false;
      imagesDirtyRef.current = false;
      servicesDirtyRef.current = false;
      slotsDirtyRef.current = false;
      setSettingsFormState(settings);
      settingsFormRef.current = settings;
      setImageSlotsFormState(imageSlots);
      imageSlotsFormRef.current = imageSlots;
      setServicesListState(services);
      servicesListRef.current = services;
      setSlotsListState(calendarSlots);
      slotsListRef.current = calendarSlots;
    }
    wasOpenRef.current = isAdminModalOpen;
  }, [isAdminModalOpen, settings, imageSlots, services, calendarSlots]);

  // Only sync external updates into forms if user does NOT have unsaved edits in that area
  React.useEffect(() => {
    if (isAdminModalOpen && !settingsDirtyRef.current) {
      setSettingsFormState(settings);
      settingsFormRef.current = settings;
    }
  }, [settings, isAdminModalOpen]);

  React.useEffect(() => {
    if (isAdminModalOpen && !imagesDirtyRef.current) {
      setImageSlotsFormState(imageSlots);
      imageSlotsFormRef.current = imageSlots;
    }
  }, [imageSlots, isAdminModalOpen]);

  React.useEffect(() => {
    if (isAdminModalOpen && !servicesDirtyRef.current) {
      setServicesListState(services);
      servicesListRef.current = services;
    }
  }, [services, isAdminModalOpen]);

  React.useEffect(() => {
    if (isAdminModalOpen && !slotsDirtyRef.current) {
      setSlotsListState(calendarSlots);
      slotsListRef.current = calendarSlots;
    }
  }, [calendarSlots, isAdminModalOpen]);

  React.useEffect(() => {
    if (adminInitialTab) {
      setActiveTab(adminInitialTab);
    }
  }, [adminInitialTab, isAdminModalOpen]);

  if (!isAdminModalOpen) return null;

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setPinError('');
    const valid = await verifyPin(pinInput);
    setIsVerifying(false);
    if (!valid) {
      setPinError('Incorrect password. Please try again.');
    } else {
      setPinInput('');
    }
  };

  const handleGoogleAdminSignIn = async () => {
    setIsGoogleSigningIn(true);
    setPinError('');
    try {
      const user = await signInWithGoogle();
      if (user && user.emailVerified && user.email === 'jasonpheks@gmail.com') {
        showSuccessNotice('Signed in with Google & synced boutique data to Firestore!');
      } else {
        await signOutGoogle();
        setPinError('This Google account is not authorized as boutique owner. Use your PIN or owner Google account.');
      }
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setPinError(err?.message || 'Google Sign-In failed. Please try again or use your PIN.');
      }
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  const handleManualCloudSync = async () => {
    setIsSyncingCloud(true);
    try {
      const ok = await syncAllToFirestore();
      if (ok) {
        showSuccessNotice('All boutique settings, images, services & slots synced to Firestore!');
      } else {
        showSuccessNotice('Cloud sync completed with partial updates.');
      }
    } catch {
      showSuccessNotice('Could not reach Firestore right now.');
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const showSuccessNotice = (msg: string) => {
    setSaveSuccessMsg(msg);
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  const handleSaveSettings = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setIsSavingSettings(true);
    try {
      const currentSettings = settingsFormRef.current;
      const syncResult = await updateSettings(currentSettings);
      settingsDirtyRef.current = false;
      if (syncResult && !syncResult.success) {
        showSuccessNotice(`Save warning: ${syncResult.message}`);
      } else {
        showSuccessNotice(syncResult?.message || 'Boutique & color settings stored and published live!');
      }
    } catch (err: any) {
      console.warn('Settings save warning:', err);
      showSuccessNotice('Failed to reach live server. Changes saved in browser.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSaveImageSlots = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setIsSavingImages(true);
    try {
      await updateImageSlots(imageSlotsFormRef.current);
      imagesDirtyRef.current = false;
      showSuccessNotice('Logo & images stored and published live to the webpage!');
    } catch (err) {
      console.warn('Images save warning:', err);
      showSuccessNotice('Image update warning: saved in browser, could not sync to server.');
    } finally {
      setIsSavingImages(false);
    }
  };

  const handleSaveServices = async (overrideList?: typeof services) => {
    setIsSavingServices(true);
    try {
      const targetList = Array.isArray(overrideList) ? overrideList : servicesListRef.current;
      const syncResult = await updateServices(targetList);
      servicesDirtyRef.current = false;
      if (syncResult && !syncResult.success) {
        showSuccessNotice(`Services warning: ${syncResult.message}`);
      } else {
        showSuccessNotice(
          syncResult?.message || `Published ${targetList.length} services & prices live to the webpage!`
        );
      }
    } catch {
      showSuccessNotice('Failed to publish services to live server.');
    } finally {
      setIsSavingServices(false);
    }
  };

  const handleSaveAllSlots = async () => {
    setIsSavingSlots(true);
    try {
      await updateCalendarSlots(slotsListRef.current);
      slotsDirtyRef.current = false;
      showSuccessNotice('All time slots stored and published live!');
    } catch {
      showSuccessNotice('Failed to publish calendar slots to live server.');
    } finally {
      setIsSavingSlots(false);
    }
  };

  const flushDirtyChanges = async () => {
    if (!isAdmin) return;
    if (servicesDirtyRef.current) {
      await updateServices(servicesListRef.current).catch(() => {});
      servicesDirtyRef.current = false;
    }
    if (settingsDirtyRef.current) {
      await updateSettings(settingsFormRef.current).catch(() => {});
      settingsDirtyRef.current = false;
    }
    if (imagesDirtyRef.current) {
      await updateImageSlots(imageSlotsFormRef.current).catch(() => {});
      imagesDirtyRef.current = false;
    }
    if (slotsDirtyRef.current) {
      await updateCalendarSlots(slotsListRef.current).catch(() => {});
      slotsDirtyRef.current = false;
    }
  };

  const handleTabSwitch = (
    nextTab: 'info' | 'colors' | 'images' | 'services' | 'slots' | 'calendar' | 'bookings' | 'supabase'
  ) => {
    if (nextTab !== activeTab) {
      void flushDirtyChanges();
      setActiveTab(nextTab);
    }
  };

  const handleCloseAdmin = async () => {
    await flushDirtyChanges();
    closeAdmin();
  };

  const handleGlobalSave = () => {
    switch (activeTab) {
      case 'info':
      case 'colors':
      case 'calendar':
      case 'supabase':
        handleSaveSettings();
        break;
      case 'images':
        handleSaveImageSlots();
        break;
      case 'services':
        handleSaveServices();
        break;
      case 'slots':
        handleSaveAllSlots();
        break;
      default:
        break;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full h-[100dvh] sm:h-auto max-w-5xl sm:max-h-[92vh] bg-[#2D1B28] text-white rounded-none sm:rounded-3xl border-0 sm:border border-white/20 shadow-2xl flex flex-col overflow-hidden"
        style={{ fontFamily: 'Verdana, Geneva, sans-serif' }}
      >
        
        {/* Top Header */}
        <div className="px-6 py-5 border-b border-white/10 bg-[#251421] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#C45266] text-white flex items-center justify-center font-bold">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[11px] text-white/80">
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span>{isConnected ? 'Real-Time Sync Active' : 'Offline'}</span>
                {isSupabaseActive && (
                  <span className="text-emerald-300 font-mono">· Supabase Postgres Changes Connected</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                {isFirebaseAdmin ? (
                  <button
                    type="button"
                    onClick={handleManualCloudSync}
                    disabled={isSyncingCloud}
                    className="px-3 py-1.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                    title={`Firestore Cloud Sync active (${firebaseUser?.email}) — Click to push latest data`}
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">
                      {isSyncingCloud ? 'Syncing...' : 'Firestore Synced'}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleGoogleAdminSignIn}
                    disabled={isGoogleSigningIn}
                    className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/90 border border-white/15 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Connect owner Google account to enable Firestore Cloud Sync"
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">
                      {isGoogleSigningIn ? 'Connecting...' : 'Connect Cloud Sync'}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleGlobalSave}
                  className="px-3 py-1.5 rounded-full bg-[#C45266] hover:bg-[#b04356] text-white text-xs font-medium flex items-center gap-1.5 transition-all shadow cursor-pointer border border-white/10"
                  title="Save changes in current tab"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Save Changes</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const undone = await undoLastChange();
                    if (undone) {
                      settingsDirtyRef.current = false;
                      imagesDirtyRef.current = false;
                      servicesDirtyRef.current = false;
                      slotsDirtyRef.current = false;
                      showSuccessNotice('Reverted last admin change!');
                    }
                  }}
                  disabled={!canUndo}
                  className={`px-3 py-1.5 rounded-full border text-xs font-medium flex items-center gap-1.5 transition-all ${
                    canUndo
                      ? 'bg-amber-500/20 hover:bg-amber-500/40 text-amber-200 border-amber-400/40 cursor-pointer shadow'
                      : 'bg-white/5 text-white/30 border-white/10 cursor-not-allowed opacity-50'
                  }`}
                  title="Undo previous admin action"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Undo Last Change</span>
                </button>

                <button
                  type="button"
                  onClick={logoutAdmin}
                  className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs text-white/80 flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Lock Session"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={handleCloseAdmin}
              className="p-2 text-white/80 hover:text-white bg-white/10 rounded-full transition-colors cursor-pointer"
              aria-label="Close portal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        {!isAdmin ? (
          /* PIN Verification Gate */
          <div className="p-8 sm:p-12 text-center max-w-md mx-auto my-auto space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-[#C45266]/20 text-white/80 border border-rose-400/40 flex items-center justify-center mx-auto shadow-inner">
              <ShieldCheck className="w-8 h-8" />
            </div>

            <div>
              <h3 className="font-editorial text-3xl text-white">Staff Authentication</h3>
              <p className="text-xs text-white/60 mt-1">
                Enter your boutique security PIN to access appointment bookings and live settings.
              </p>
            </div>

            {pinError && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{pinError}</span>
              </div>
            )}

            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoFocus
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Enter Password"
                  className="w-full text-center tracking-[0.3em] font-mono text-xl bg-white/5 border border-white/20 rounded-2xl py-3 px-12 text-white focus:outline-none focus:border-white/50 focus:ring-1 focus:ring-rose-400 placeholder:text-neutral-500 placeholder:tracking-normal placeholder:text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-1 transition-colors cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <button
                type="submit"
                disabled={isVerifying}
                className="w-full py-3.5 rounded-full bg-[#C45266] hover:bg-[#b04356] text-white font-medium text-sm transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>{isVerifying ? 'Checking...' : 'Unlock Management Panel'}</span>
              </button>
            </form>

            <div className="flex items-center gap-3 text-[11px] text-white/40">
              <span className="flex-1 h-px bg-white/10" />
              <span>or</span>
              <span className="flex-1 h-px bg-white/10" />
            </div>

            <button
              type="button"
              onClick={handleGoogleAdminSignIn}
              disabled={isGoogleSigningIn}
              className="w-full py-3 rounded-full bg-white/10 hover:bg-white/15 border border-white/20 text-white font-medium text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Database className="w-4 h-4 text-rose-300" />
              <span>{isGoogleSigningIn ? 'Signing in...' : 'Sign in with Google (Owner Cloud Sync)'}</span>
            </button>
          </div>
        ) : (
          /* Authenticated Dashboard */
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            
            {/* Mobile Touch Horizontal Tab Bar */}
            <div className="md:hidden border-b border-white/10 bg-[#1F0E1A] shrink-0 px-3 py-2.5 flex gap-2 overflow-x-auto no-scrollbar items-center touch-pan-x">
              <button
                type="button"
                onClick={() => handleTabSwitch('info')}
                className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap flex items-center gap-1.5 shrink-0 min-h-[40px] cursor-pointer ${
                  activeTab === 'info' ? 'bg-[#C45266] text-white shadow-md font-semibold' : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Info</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabSwitch('colors')}
                className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap flex items-center gap-1.5 shrink-0 min-h-[40px] cursor-pointer ${
                  activeTab === 'colors' ? 'bg-[#C45266] text-white shadow-md font-semibold' : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>Colors</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabSwitch('images')}
                className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap flex items-center gap-1.5 shrink-0 min-h-[40px] cursor-pointer ${
                  activeTab === 'images' ? 'bg-[#C45266] text-white shadow-md font-semibold' : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Images</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabSwitch('services')}
                className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap flex items-center gap-1.5 shrink-0 min-h-[40px] cursor-pointer ${
                  activeTab === 'services' ? 'bg-[#C45266] text-white shadow-md font-semibold' : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Services</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabSwitch('slots')}
                className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap flex items-center gap-1.5 shrink-0 min-h-[40px] cursor-pointer ${
                  activeTab === 'slots' ? 'bg-[#C45266] text-white shadow-md font-semibold' : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Slots</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabSwitch('calendar')}
                className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap flex items-center gap-1.5 shrink-0 min-h-[40px] cursor-pointer ${
                  activeTab === 'calendar' ? 'bg-[#C45266] text-white shadow-md font-semibold' : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Google Cal</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabSwitch('bookings')}
                className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap flex items-center gap-1.5 shrink-0 min-h-[40px] cursor-pointer ${
                  activeTab === 'bookings' ? 'bg-[#C45266] text-white shadow-md font-semibold' : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-rose-300" />
                <span>Bookings Calendar</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabSwitch('supabase')}
                className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap flex items-center gap-1.5 shrink-0 min-h-[40px] cursor-pointer ${
                  activeTab === 'supabase' ? 'bg-[#C45266] text-white shadow-md font-semibold' : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>Supabase</span>
              </button>
            </div>

            {/* Desktop Sidebar Tabs */}
            <div className="hidden md:flex w-56 bg-[#1F0E1A] border-r border-white/10 p-4 flex-col gap-1 shrink-0">

              <button
                type="button"
                onClick={() => handleTabSwitch('info')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium tracking-wide transition-all cursor-pointer ${
                  activeTab === 'info'
                    ? 'bg-[#C45266] text-white shadow-md'
                    : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Boutique Info</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabSwitch('colors')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium tracking-wide transition-all cursor-pointer ${
                  activeTab === 'colors'
                    ? 'bg-[#C45266] text-white shadow-md'
                    : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Palette className="w-4 h-4" />
                <span>Theme & Colors</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabSwitch('images')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium tracking-wide transition-all cursor-pointer ${
                  activeTab === 'images'
                    ? 'bg-[#C45266] text-white shadow-md'
                    : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                <span>Logo & Images</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabSwitch('services')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium tracking-wide transition-all cursor-pointer ${
                  activeTab === 'services'
                    ? 'bg-[#C45266] text-white shadow-md'
                    : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <DollarSign className="w-4 h-4" />
                <span>Services & Prices</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabSwitch('slots')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium tracking-wide transition-all cursor-pointer ${
                  activeTab === 'slots'
                    ? 'bg-[#C45266] text-white shadow-md'
                    : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>Calendar Slots</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabSwitch('calendar')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium tracking-wide transition-all cursor-pointer ${
                  activeTab === 'calendar'
                    ? 'bg-[#C45266] text-white shadow-md'
                    : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Google Calendar</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabSwitch('bookings')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium tracking-wide transition-all cursor-pointer ${
                  activeTab === 'bookings'
                    ? 'bg-[#C45266] text-white shadow-md'
                    : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Calendar className="w-4 h-4 text-rose-300" />
                <span>Bookings Calendar</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabSwitch('supabase')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium tracking-wide transition-all cursor-pointer ${
                  activeTab === 'supabase'
                    ? 'bg-[#C45266] text-white shadow-md'
                    : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Database className="w-4 h-4" />
                <span>Supabase Sync</span>
              </button>
            </div>

            {/* Main Panel Content with Code-Splitting Suspense */}
            <div className="flex-1 p-4 sm:p-8 overflow-y-auto pb-48 sm:pb-12 scroll-smooth overscroll-contain">
              {saveSuccessMsg && (
                <div className="mb-6 p-3.5 rounded-2xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              <React.Suspense fallback={<TabLoader />}>
                {activeTab === 'info' && (
                  <TabInfo
                    settingsForm={settingsForm}
                    setSettingsForm={setSettingsForm}
                    handleSaveSettings={handleSaveSettings}
                    isSavingSettings={isSavingSettings}
                    isSupabaseActive={isSupabaseActive}
                  />
                )}
                {activeTab === 'colors' && (
                  <TabColors
                    settingsForm={settingsForm}
                    setSettingsForm={setSettingsForm}
                    handleSaveSettings={handleSaveSettings}
                    updateSettings={async (next) => {
                      const res = await updateSettings(next);
                      settingsDirtyRef.current = false;
                      return res;
                    }}
                    showSuccessNotice={showSuccessNotice}
                    isSavingSettings={isSavingSettings}
                    isSupabaseActive={isSupabaseActive}
                  />
                )}
                {activeTab === 'images' && (
                  <TabImages
                    imageSlotsForm={imageSlotsForm}
                    setImageSlotsForm={setImageSlotsForm}
                    handleSaveImageSlots={handleSaveImageSlots}
                    isSavingImages={isSavingImages}
                    updateImageSlots={async (partial) => {
                      await updateImageSlots(partial);
                      imagesDirtyRef.current = false;
                    }}
                    showSuccessNotice={showSuccessNotice}
                  />
                )}
                {activeTab === 'services' && (
                  <TabServices
                    servicesList={servicesList}
                    setServicesList={setServicesList}
                    updateServices={async (nextServices) => {
                      const res = await updateServices(nextServices);
                      servicesDirtyRef.current = false;
                      return res;
                    }}
                    handleSaveServices={handleSaveServices}
                    isSavingServices={isSavingServices}
                    settingsForm={settingsForm}
                    showSuccessNotice={showSuccessNotice}
                    isSupabaseActive={isSupabaseActive}
                  />
                )}
                {activeTab === 'slots' && (
                  <TabSlots
                    slotsList={slotsList}
                    setSlotsList={setSlotsList}
                    updateCalendarSlots={async (nextSlots) => {
                      await updateCalendarSlots(nextSlots);
                      slotsDirtyRef.current = false;
                    }}
                    handleSaveAllSlots={handleSaveAllSlots}
                    isSavingSlots={isSavingSlots}
                    showSuccessNotice={showSuccessNotice}
                  />
                )}
                {activeTab === 'calendar' && (
                  <TabCalendar
                    settingsForm={settingsForm}
                    setSettingsForm={setSettingsForm}
                    handleSaveSettings={handleSaveSettings}
                    isSavingSettings={isSavingSettings}
                  />
                )}
                {activeTab === 'bookings' && (
                  <TabBookingsCalendar />
                )}
                {activeTab === 'supabase' && (
                  <TabSupabase
                    settingsForm={settingsForm}
                    setSettingsForm={setSettingsForm}
                    servicesList={servicesList}
                    isSupabaseActive={isSupabaseActive}
                    testSupabase={testSupabase}
                    checkSupabaseStatus={checkSupabaseStatus}
                    syncSettingsWithSupabase={syncSettingsWithSupabase}
                    syncServicesWithSupabase={syncServicesWithSupabase}
                    showSuccessNotice={showSuccessNotice}
                  />
                )}
              </React.Suspense>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
