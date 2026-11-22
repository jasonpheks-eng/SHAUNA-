import React, { useState, useMemo } from 'react';
import { useBoutique } from '../context/BoutiqueContext';
import { ServiceItem, Appointment } from '../types';
import { GooeyGradientBackground } from './GooeyGradientBackground';
import { formatAppointmentWhatsAppMessage, buildWhatsAppUrl } from '../lib/whatsapp';
import { buildGoogleCalendarWebLink } from '../lib/googleCalendar';
import {
  Clock,
  CheckCircle,
  MessageCircle,
  User,
  Phone,
  AlertCircle,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowUp,
  X,
} from 'lucide-react';

const NailIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 3h6v4H9z" />
    <path d="M10 7v3a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V7" />
    <path d="M8 12h8a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2z" />
    <circle cx="12" cy="16" r="1.5" fill="currentColor" />
  </svg>
);

const LashIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M3 7.5L1.5 5.5" />
    <path d="M7 4.5L6 2" />
    <path d="M12 3.5V1" />
    <path d="M17 4.5l1-2.5" />
    <path d="M21 7.5l1.5-2" />
  </svg>
);

const HairIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <line x1="20" y1="4" x2="8.12" y2="15.88" />
    <line x1="14.47" y1="14.48" x2="20" y2="20" />
    <line x1="8.12" y1="8.12" x2="12" y2="12" />
  </svg>
);

const getCategoryIcon = (category?: string, className = "w-4 h-4") => {
  switch (category?.toLowerCase()) {
    case 'nails':
      return <NailIcon className={className} />;
    case 'lashes':
      return <LashIcon className={className} />;
    case 'hair':
      return <HairIcon className={className} />;
    default:
      return <Sparkles className={className} />;
  }
};

export const BookingSection: React.FC = () => {
  const {
    services,
    createAppointment,
    removeAppointment,
    settings,
    selectedServiceForBooking,
    selectedServicesForBooking,
    removeServiceSelection,
    clearSelectedServices,
    selectionTrigger,
  } = useBoutique();

  const sym = settings.currency_symbol || 'MWK';

  React.useEffect(() => {
    if (selectedServiceForBooking && selectionTrigger > 0) {
      const bookingEl = document.getElementById('booking');
      if (bookingEl) {
        bookingEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [selectedServiceForBooking, selectionTrigger]);

  const totalSelectedPrice = useMemo(() => {
    return selectedServicesForBooking.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
  }, [selectedServicesForBooking]);

  // Calendar Month State (defaults to November 2026)
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date(2026, 10, 1));

  const prevMonth = () => {
    setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1));
  };

  const formatDateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const monthDays = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    const startingDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1; // 0: Mon, 6: Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      days.push(dateObj);
    }
    return days;
  }, [currentMonthDate]);

  const monthName = currentMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const [selectedDate, setSelectedDate] = useState<string>('2026-11-12');
  const [preferredTime24, setPreferredTime24] = useState<string>('14:30');

  const selectedTimeSlot = useMemo(() => {
    const match = (preferredTime24 || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return '02:30 PM';
    let h = parseInt(match[1], 10);
    const m = match[2];
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
  }, [preferredTime24]);

  // Form Fields
  const [clientName, setClientName] = useState<string>('');
  const [clientPhone, setClientPhone] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Status State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [confirmedBooking, setConfirmedBooking] = useState<Appointment | null>(null);
  const [confirmedTreatments, setConfirmedTreatments] = useState<ServiceItem[]>([]);
  const [sentBookings, setSentBookings] = useState<Appointment[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Formatted Selected Date Label
  const selectedDateLabel = useMemo(() => {
    try {
      const [y, m, d] = selectedDate.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  // Submission Handler
  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || selectedServicesForBooking.length === 0) {
      setErrorMessage('Please enter your name and select at least one treatment.');
      return;
    }
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const bookedTreatments = [...selectedServicesForBooking];
      const primaryService = bookedTreatments[0];
      const serviceIds = bookedTreatments.map((s) => s.id).slice(0, 20);
      const combinedTitle =
        bookedTreatments.length === 1
          ? primaryService.title
          : `${bookedTreatments.length} Treatments: ${bookedTreatments.map((s) => s.title).join(', ')}`.slice(0, 160);
      const servicesSummary = `${bookedTreatments
        .map((s) => `${s.title} (${sym} ${(s.price || 0).toLocaleString()})`)
        .join(' + ')} | Total: ${sym} ${totalSelectedPrice.toLocaleString()}`.slice(0, 500);

      const appointment = await createAppointment({
        client_name: clientName.trim(),
        client_phone: clientPhone.trim() || 'WhatsApp Direct',
        service_id: primaryService.id,
        service_ids: serviceIds,
        service_title: combinedTitle,
        services_summary: servicesSummary,
        category: primaryService.category,
        date: selectedDate,
        time_slot: selectedTimeSlot,
        notes: notes.trim(),
      });

      setConfirmedTreatments(bookedTreatments);
      setConfirmedBooking(appointment);
      setSentBookings((prev) => [appointment, ...prev.filter((b) => b.id !== appointment.id)]);

      // Organized WhatsApp Message with every booked treatment & summed total
      const waText = formatAppointmentWhatsAppMessage({
        boutiqueName: settings.boutique_name,
        clientName: appointment.client_name,
        serviceTitle: appointment.service_title,
        servicesSummary: appointment.services_summary,
        treatments: bookedTreatments.map((s) => ({
          title: s.title,
          category: s.category,
          price: s.price,
        })),
        category: primaryService.category,
        price: totalSelectedPrice,
        currencySymbol: settings.currency_symbol,
        date: appointment.date,
        timeSlot: appointment.time_slot,
        bookingRef: appointment.id,
        notes: notes.trim(),
      });

      const waUrl = buildWhatsAppUrl(settings.whatsapp_number, waText);
      window.open(waUrl, '_blank', 'noopener,noreferrer');

      // Scroll smoothly to confirmation card
      setTimeout(() => {
        const itinerarySection = document.getElementById('my-bookings-section') || document.getElementById('booking');
        if (itinerarySection) {
          itinerarySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);

      setNotes('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Booking submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section 
      id="booking" 
      className="relative overflow-hidden text-white py-16 lg:py-24 px-4 sm:px-6 lg:px-8 scroll-mt-16 transition-colors duration-300"
      style={{ backgroundColor: settings.booking_bg_color || '#5b0827' }}
    >
      <div className="absolute inset-0 pointer-events-none z-0">
        <GooeyGradientBackground 
          interactive={false} 
          sensitivity={settings.booking_gooey_sensitivity}
          opacity={settings.booking_gooey_opacity}
        />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        
        {/* Simple Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-semibold tracking-[0.25em] uppercase text-rose-300">
            Fast Boutique Reservation
          </span>
          <h2 
            className="font-editorial text-4xl sm:text-5xl lg:text-6xl font-normal text-white mt-2"
            style={{ fontSize: '42px' }}
          >
            Make a Booking
          </h2>
          <p className="mt-3 text-sm text-rose-100/80 font-light">
            Select your desired treatment, choose a date on the boutique calendar, and confirm your request instantly on WhatsApp.
          </p>
        </div>

        {confirmedBooking ? (
          /* Simplified Confirmation Card */
          <div 
            className="max-w-xl mx-auto rounded-3xl p-8 border border-rose-400/30 shadow-2xl text-center space-y-6 animate-in fade-in"
            style={{ backgroundColor: settings.booking_card_bg_color || '#2E1222' }}
          >
            <div className="w-14 h-14 rounded-full bg-rose-500/20 text-rose-300 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-rose-300" />
            </div>

            <div>
              <span className="text-xs font-mono uppercase tracking-widest text-rose-300">
                Booking Ref #{confirmedBooking.id}
              </span>
              <h3 className="font-editorial text-3xl text-white mt-1">
                Appointment Requested!
              </h3>
              <p className="text-rose-100/90 text-sm mt-2">
                We've reserved <strong className="text-white">{confirmedBooking.services_summary || confirmedBooking.service_title}</strong> for you on <strong className="text-white">{confirmedBooking.date}</strong> at <strong className="text-white">{confirmedBooking.time_slot}</strong>.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  const calUrl = buildGoogleCalendarWebLink(confirmedBooking, settings.calendar_reminder_min || 30, settings.ceo_google_email || 'jasonpheks@gmail.com');
                  window.open(calUrl, '_blank', 'noopener,noreferrer');
                }}
                className="w-full sm:w-auto px-6 py-3.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-lg transition-colors cursor-pointer"
              >
                <CalendarIcon className="w-4 h-4 text-blue-200" />
                <span>Add to Google Calendar ↗</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const fallbackIds: string[] = Array.isArray(confirmedBooking.service_ids)
                    ? confirmedBooking.service_ids
                    : [confirmedBooking.service_id];
                  const treatmentsList: ServiceItem[] = confirmedTreatments.length > 0
                    ? confirmedTreatments
                    : fallbackIds
                        .map((id) => services.find((s) => s.id === id))
                        .filter((s): s is ServiceItem => Boolean(s));
                  const summedTotal = treatmentsList.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
                  const waText = formatAppointmentWhatsAppMessage({
                    boutiqueName: settings.boutique_name,
                    clientName: confirmedBooking.client_name,
                    serviceTitle: confirmedBooking.service_title,
                    servicesSummary: confirmedBooking.services_summary,
                    treatments: treatmentsList.map((s) => ({
                      title: s.title,
                      category: s.category,
                      price: s.price,
                    })),
                    category: confirmedBooking.category,
                    price: summedTotal || services.find((s) => s.id === confirmedBooking.service_id)?.price,
                    currencySymbol: settings.currency_symbol,
                    date: confirmedBooking.date,
                    timeSlot: confirmedBooking.time_slot,
                    bookingRef: confirmedBooking.id,
                    notes: confirmedBooking.notes,
                  });
                  const waUrl = buildWhatsAppUrl(settings.whatsapp_number, waText);
                  window.open(waUrl, '_blank', 'noopener,noreferrer');
                }}
                className="w-full sm:w-auto px-7 py-3.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Open WhatsApp ↗</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmedBooking(null);
                  setConfirmedTreatments([]);
                  clearSelectedServices();
                  setClientName('');
                  setClientPhone('');
                  setNotes('');
                }}
                className="w-full sm:w-auto px-6 py-3.5 rounded-full border border-white/20 hover:bg-white/10 text-white text-xs transition-colors cursor-pointer"
              >
                Book Another
              </button>
            </div>

            {sentBookings.length > 0 && (
              <div id="my-bookings-section" className="pt-6 border-t border-white/10 text-left animate-in slide-in-from-bottom-4 duration-500">
                <h3 className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-rose-200 mb-4 px-1">
                  4. My Bookings
                </h3>
                <div className="space-y-3">
                  {sentBookings.map((apt) => (
                    <div key={apt.id} className="p-4 rounded-2xl bg-black/20 border border-white/5 text-xs text-rose-100 relative group hover:bg-black/30 transition-colors">
                      <div className="flex justify-between font-bold text-white mb-1 pr-8">
                        <span className="truncate">{apt.services_summary || apt.service_title}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSentBookings((prev) => prev.filter((item) => item.id !== apt.id));
                            removeAppointment(apt.id);
                          }}
                          className="absolute top-4 right-4 text-rose-300/50 hover:text-white transition-colors p-1"
                          title="Delete booking"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="opacity-70 flex items-center gap-1.5 mt-1">
                        <CalendarIcon className="w-3 h-3" />
                        <span>{apt.date} at {apt.time_slot}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Streamlined 2-Column Booking Layout with Visual Calendar */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
            
            {/* Left Column: Calendar Date Selection first, then Treatment Selection */}
            <div 
              className="lg:col-span-7 rounded-3xl p-5 sm:p-8 border border-white/10 shadow-xl space-y-6 transition-colors duration-300"
              style={{ backgroundColor: settings.booking_card_bg_color || '#111010' }}
            >
              
              {/* Step 1: The Visual Calendar & Time Slots */}
              <div className="space-y-4">
                
                {/* Calendar Month Header & Controls */}
                <div className="pb-2 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-rose-300" />
                    <h3 className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-rose-200">
                      1. SELECT DATE
                    </h3>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <span className="text-sm font-editorial font-medium text-white tracking-wide">
                      {monthName}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={prevMonth}
                        className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center justify-center"
                        aria-label="Previous Month"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={nextMonth}
                        className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center justify-center"
                        aria-label="Next Month"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Weekday Column Headers */}
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-mono text-rose-300/70 uppercase">
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
                  <span>Sun</span>
                </div>

                {/* Calendar Days Grid */}
                <div className="grid grid-cols-7 gap-1.5 p-1.5 sm:p-2 rounded-2xl bg-black/30 border border-white/10">
                  {monthDays.map((d, index) => {
                    if (!d) {
                      return <div key={`empty-${index}`} className="aspect-square" />;
                    }
                    const dateKey = formatDateKey(d);
                    const isSelected = selectedDate === dateKey;
                    const isPast = d < new Date(2026, 10, 5); // disable past demo dates

                    return (
                      <button
                        key={dateKey}
                        type="button"
                        disabled={isPast}
                        onClick={() => setSelectedDate(dateKey)}
                        className={`aspect-square min-h-[44px] rounded-xl flex flex-col items-center justify-center font-mono text-xs sm:text-sm transition-all ${
                          isSelected
                            ? 'bg-[#C45266] text-white font-bold shadow-lg ring-2 ring-white/60'
                            : isPast
                            ? 'text-white/20 cursor-not-allowed'
                            : 'text-rose-100 hover:bg-white/15 hover:text-white'
                        }`}
                        style={isSelected ? { backgroundColor: settings.hero_accent_color || '#C45266' } : {}}
                      >
                        <span>{d.getDate()}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Preferred Time Selection */}
                <div className="pt-2">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-rose-300 mb-3 font-medium">
                    <label htmlFor="preferred-time-input">
                      Preferred Time on {selectedDateLabel}:
                    </label>
                    <span className="text-white font-bold font-mono tabular-nums">{selectedTimeSlot}</span>
                  </div>

                  <div className="relative">
                    <Clock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
                    <input
                      id="preferred-time-input"
                      type="time"
                      required
                      value={preferredTime24}
                      onChange={(e) => {
                        if (e.target.value) {
                          setPreferredTime24(e.target.value);
                        }
                      }}
                      className="w-full min-h-[48px] bg-white text-neutral-900 border border-white/20 rounded-2xl pl-12 pr-4 py-3 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-rose-400/50 shadow-inner cursor-pointer"
                    />
                  </div>
                  <p className="text-[11px] text-rose-200/70 mt-2">
                    Choose any arrival time that works best for you.
                  </p>
                </div>

              </div>

              {/* Step 2: Selected Treatments Display */}
              <div className="pt-4 border-t border-white/10 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-rose-200">
                      2. Selected Treatments
                    </h3>
                    <span className="text-[10px] text-rose-300/70">
                      {selectedServicesForBooking.length > 0
                        ? `${selectedServicesForBooking.length} ${selectedServicesForBooking.length === 1 ? 'treatment' : 'treatments'} booked · Total ${sym} ${totalSelectedPrice.toLocaleString()}`
                        : 'Your chosen treatments from Our Services will appear here'}
                    </span>
                  </div>
                </div>

                {/* Selected Treatments List */}
                {selectedServicesForBooking.length === 0 ? (
                  <div className="p-4 rounded-2xl border border-dashed border-white/25 bg-black/25 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className="w-11 h-11 rounded-xl text-white flex items-center justify-center shrink-0 shadow-lg"
                        style={{ backgroundColor: settings.hero_accent_color || '#C45266' }}
                      >
                        <Sparkles className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm sm:text-base font-semibold text-white">
                          No treatments selected yet
                        </h4>
                        <p className="text-xs text-rose-200/80 mt-0.5">
                          Click "Book Another Treatment" below to select treatments from Our Services.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {selectedServicesForBooking.map((service) => (
                      <div
                        key={service.id}
                        className="p-4 rounded-2xl border border-rose-300/40 transition-all flex items-center justify-between gap-4 shadow-md"
                        style={{ backgroundColor: `${settings.hero_accent_color || '#C45266'}28` }}
                      >
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          <div
                            className="w-10 h-10 rounded-xl text-white flex items-center justify-center shrink-0 shadow-md"
                            style={{ backgroundColor: settings.hero_accent_color || '#C45266' }}
                          >
                            {getCategoryIcon(service.category, "w-5 h-5 text-white")}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm sm:text-base font-semibold text-white truncate">
                              {service.title}
                            </h4>
                            <div className="text-xs text-rose-200/90 font-mono mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 tabular-nums">
                              <span className="font-bold text-white">
                                {service.id === 'hair-blowout' ? 'MK' : sym} {service.price ? service.price.toLocaleString() : 0}
                              </span>
                              <span className="opacity-40">·</span>
                              <span className="capitalize font-sans text-rose-200/80">{service.category}</span>
                              {!service.hide_duration && service.duration_min > 0 && (
                                <>
                                  <span className="opacity-40">·</span>
                                  <span>{service.duration_min} mins</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeServiceSelection(service.id)}
                          className="h-9 px-3 rounded-xl bg-black/40 hover:bg-red-950/60 text-rose-200 hover:text-white text-xs font-medium border border-white/10 transition-all flex items-center justify-center gap-1 shrink-0 cursor-pointer"
                          title={`Remove ${service.title}`}
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Book Another Treatment Button - Directs user right up to Our Services */}
                <button
                  type="button"
                  onClick={() => {
                    document.getElementById('services')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="w-full min-h-[44px] py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/25 hover:border-rose-300/60 text-white text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <ArrowUp className="w-4 h-4 text-rose-300" />
                  <span>Book Another Treatment</span>
                </button>
              </div>

            </div>

            {/* Right Column: Reservation Details & WhatsApp Request */}
            <div className="lg:col-span-5 bg-gradient-to-br from-[#b43859] to-[#701932] rounded-3xl p-6 sm:p-8 border border-white/20 shadow-2xl backdrop-blur-md space-y-6 lg:sticky lg:top-24"
                 style={{ backgroundImage: `linear-gradient(to bottom right, ${settings.hero_accent_color || '#b43859'}ee, ${settings.booking_bg_color || '#701932'}ff)` }}>
              
              <div className="border-b border-white/10 pb-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-rose-100">
                  3. Your Details
                </h3>
                <p className="text-xs text-rose-200/70 mt-1">
                  We'll prepare your request and open WhatsApp directly with all details filled in.
                </p>
              </div>

              {errorMessage && (
                <div className="p-4 rounded-xl bg-red-950/60 border border-red-500/50 text-red-100 text-xs flex items-center gap-2 animate-shake">
                  <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleBookingSubmit} className="space-y-5">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-rose-200 mb-1.5 font-semibold px-1">
                    Your Full Name *
                  </label>
                  <div className="relative group">
                    <User className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within:text-rose-400 transition-colors" />
                    <input
                      type="text"
                      required
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="e.g. Sophia Vance"
                      className="w-full min-h-[48px] bg-white text-neutral-900 border border-white/20 rounded-2xl pl-12 pr-4 py-3 text-sm placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-rose-400/50 shadow-inner"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-rose-200 mb-1.5 font-semibold px-1">
                    WhatsApp Phone Number *
                  </label>
                  <div className="relative group">
                    <Phone className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within:text-rose-400 transition-colors" />
                    <input
                      type="tel"
                      required
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      placeholder="e.g. +265 888..."
                      className="w-full min-h-[48px] bg-white text-neutral-900 border border-white/20 rounded-2xl pl-12 pr-4 py-3 text-sm placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-rose-400/50 shadow-inner"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-rose-200 mb-1.5 font-semibold px-1">
                    Styling Notes (Optional)
                  </label>
                  <div className="relative group">
                    <MessageCircle className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within:text-rose-400 transition-colors" />
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Soft almond shape, French chrome line..."
                      className="w-full min-h-[48px] bg-white text-neutral-900 border border-white/20 rounded-2xl pl-12 pr-4 py-3 text-sm placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-rose-400/50 shadow-inner"
                    />
                  </div>
                </div>

                {/* Live Selection Summary */}
                {selectedServicesForBooking.length > 0 && (
                  <div className="p-5 rounded-2xl bg-black/25 border border-white/15 text-xs space-y-3 backdrop-blur-md">
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <span className="uppercase tracking-widest text-[10px] font-bold text-rose-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" /> Request Overview ({selectedServicesForBooking.length})
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <span className="uppercase tracking-widest text-[9px] font-bold text-rose-200/70 block">
                        {selectedServicesForBooking.length === 1 ? 'Service' : 'Booked Treatments'}
                      </span>
                      {selectedServicesForBooking.map((s) => (
                        <div key={s.id} className="flex justify-between items-start gap-3 text-rose-100">
                          <span className="text-white font-semibold leading-tight">{s.title}</span>
                          <span className="font-mono text-rose-200 shrink-0 tabular-nums">
                            {sym} {(s.price || 0).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between items-start gap-4 text-rose-200 pt-1 border-t border-white/10">
                      <span className="uppercase tracking-widest text-[9px] font-bold opacity-70 shrink-0 mt-0.5">Schedule</span>
                      <span className="text-white font-medium text-right leading-tight">{selectedDateLabel} @ {selectedTimeSlot}</span>
                    </div>
                    {clientName.trim() && (
                      <div className="flex justify-between items-start gap-4 text-rose-200">
                        <span className="uppercase tracking-widest text-[9px] font-bold opacity-70 shrink-0 mt-0.5">Client</span>
                        <span className="text-white font-medium text-right">{clientName.trim()}</span>
                      </div>
                    )}
                    {clientPhone.trim() && (
                      <div className="flex justify-between items-start gap-4 text-rose-200">
                        <span className="uppercase tracking-widest text-[9px] font-bold opacity-70 shrink-0 mt-0.5">Phone</span>
                        <span className="text-white font-medium text-right">{clientPhone.trim()}</span>
                      </div>
                    )}
                    {notes.trim() && (
                      <div className="flex justify-between items-start gap-4 text-rose-200">
                        <span className="uppercase tracking-widest text-[9px] font-bold opacity-70 shrink-0 mt-0.5">Notes</span>
                        <span className="text-white/90 italic text-right text-[11px] truncate max-w-[180px]">"{notes.trim()}"</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center gap-4 text-rose-200 pt-3 border-t border-white/10">
                      <span className="uppercase tracking-widest text-[9px] font-bold opacity-70 shrink-0">Total Fee</span>
                      <span className="text-white font-bold text-base font-mono tabular-nums">{sym} {totalSelectedPrice.toLocaleString()}</span>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full min-h-[56px] rounded-full bg-[#34A853] hover:bg-[#2e9449] text-white font-bold text-sm tracking-widest uppercase transition-all shadow-xl hover:shadow-2xl flex items-center justify-center gap-2.5 active:scale-95 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed group"
                >
                  <MessageCircle className="w-5 h-5 text-white group-hover:rotate-12 transition-transform" />
                  <span>{isSubmitting ? 'Securing Slot...' : 'Request via WhatsApp ↗'}</span>
                </button>
              </form>

              {/* Step 4: My Bookings - Only visible after a WhatsApp booking request is sent */}
              {sentBookings.length > 0 && (
                <div id="my-bookings-section" className="pt-6 border-t border-white/10 animate-in slide-in-from-bottom-4 duration-500">
                  <h3 className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-rose-200 mb-4 px-1">
                    4. My Bookings
                  </h3>
                  <div className="space-y-3">
                    {sentBookings.map((apt) => (
                      <div key={apt.id} className="p-4 rounded-2xl bg-black/20 border border-white/5 text-xs text-rose-100 relative group hover:bg-black/30 transition-colors">
                        <div className="flex justify-between font-bold text-white mb-1 pr-8">
                          <span className="truncate">{apt.services_summary || apt.service_title}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setSentBookings((prev) => prev.filter((item) => item.id !== apt.id));
                              removeAppointment(apt.id);
                            }}
                            className="absolute top-4 right-4 text-rose-300/50 hover:text-white transition-colors p-1"
                            title="Delete booking"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="opacity-70 flex items-center gap-1.5 mt-1">
                          <CalendarIcon className="w-3 h-3" />
                          <span>{apt.date} at {apt.time_slot}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

          </div>
        )}

      </div>
    </section>
  );
};
