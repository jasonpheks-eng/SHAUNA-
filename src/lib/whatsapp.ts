export interface WhatsAppTreatmentItem {
  title: string;
  category?: 'nails' | 'lashes' | 'hair' | string;
  price?: number;
}

export interface WhatsAppBookingDetails {
  boutiqueName?: string;
  clientName: string;
  serviceTitle: string;
  servicesSummary?: string;
  treatments?: WhatsAppTreatmentItem[];
  category?: 'nails' | 'lashes' | 'hair' | string;
  price?: number;
  currencySymbol?: string;
  date: string;
  timeSlot: string;
  bookingRef: string;
  notes?: string;
}

const getCategoryMeta = (catRaw?: string) => {
  const cat = catRaw?.toLowerCase();
  if (cat === 'nails') return { label: 'Nails & Manicure', emoji: '💅' };
  if (cat === 'lashes') return { label: 'Lashes & Brows', emoji: '👁️' };
  if (cat === 'hair') return { label: 'Hair & Wig Installation', emoji: '💇‍♀️' };
  return { label: 'Bespoke Beauty', emoji: '✨' };
};

/**
 * Formats a clean, highly organized, luxury boutique WhatsApp message
 * with emojis, structured sections, bold headers, itemized treatments, and summed total.
 */
export function formatAppointmentWhatsAppMessage(details: WhatsAppBookingDetails): string {
  const brand = (details.boutiqueName || 'MT Maison').toUpperCase();
  const sym = details.currencySymbol || 'MWK';

  const treatments = Array.isArray(details.treatments) && details.treatments.length > 0
    ? details.treatments
    : null;

  const totalAmount = treatments
    ? treatments.reduce((sum, t) => sum + (Number(t.price) || 0), 0)
    : details.price;

  const priceFormatted = totalAmount !== undefined
    ? `${sym} ${totalAmount.toLocaleString()}`
    : 'Price on consultation';

  const { label: categoryLabel, emoji: categoryEmoji } = getCategoryMeta(details.category);

  // Safe date parsing without UTC offset shifts
  let formattedDate = details.date;
  try {
    const parts = details.date.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        const d = new Date(year, month - 1, day);
        formattedDate = d.toLocaleDateString('en-US', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
      }
    }
  } catch {
    formattedDate = details.date;
  }

  const lines = [
    `✨ *APPOINTMENT BOOKING REQUEST* ✨`,
    `*${brand} LUXURY BOUTIQUE*`,
    `----------------------`,
    ``,
    `👤 *CLIENT DETAILS*`,
    `• *Name:* ${details.clientName}`,
    `• *Booking Reference:* #${details.bookingRef}`,
    ``,
  ];

  if (treatments && treatments.length > 1) {
    lines.push(`✨ *TREATMENTS RESERVED (${treatments.length})*`);
    treatments.forEach((t, idx) => {
      const meta = getCategoryMeta(t.category);
      const itemPrice = t.price !== undefined ? `${sym} ${Number(t.price).toLocaleString()}` : 'Consultation';
      lines.push(`${idx + 1}. ${meta.emoji} *${t.title}* — ${itemPrice}`);
    });
    lines.push(`• *Total Estimated Fee:* ${priceFormatted}`);
  } else if (treatments && treatments.length === 1) {
    const single = treatments[0];
    const singleMeta = getCategoryMeta(single.category || details.category);
    const singlePrice = single.price !== undefined
      ? `${sym} ${Number(single.price).toLocaleString()}`
      : priceFormatted;
    lines.push(
      `${singleMeta.emoji} *TREATMENT RESERVED*`,
      `• *Service:* ${single.title}`,
      `• *Category:* ${singleMeta.label}`,
      `• *Estimated Fee:* ${singlePrice}`
    );
  } else {
    lines.push(
      `${categoryEmoji} *TREATMENT RESERVED*`,
      `• *Service:* ${details.servicesSummary || details.serviceTitle}`,
      `• *Category:* ${categoryLabel}`,
      `• *Estimated Fee:* ${priceFormatted}`
    );
  }

  lines.push(
    ``,
    `🗓️ *SCHEDULED APPOINTMENT*`,
    `• *Date:* ${formattedDate}`,
    `• *Time Slot:* ${details.timeSlot}`
  );

  if (details.notes && details.notes.trim()) {
    lines.push(
      ``,
      `📝 *CLIENT STYLING NOTES*`,
      `"${details.notes.trim()}"`
    );
  }

  lines.push(
    ``,
    `----------------------`,
    `_Hello ${details.boutiqueName || 'MT Maison'} team! I have submitted this appointment request on your website. Kindly confirm availability for this slot._`,
    ``,
    `Thank you! 💕`
  );

  return lines.join('\n');
}

/**
 * Formats a pre-filled WhatsApp message for sharing a client experience look
 */
export function formatExperienceShareWhatsAppMessage(options: {
  boutiqueName?: string;
  lookNumber: number;
  imageUrl?: string;
  pageUrl?: string;
}): string {
  const brand = options.boutiqueName || 'MT Mansion';
  const lines = [
    `✨ *LOOK INQUIRY — ${brand.toUpperCase()}* ✨`,
    ``,
    `Hello ${brand}! I saw *Look #${options.lookNumber}* in the *Your Experiences* gallery and would love to inquire about / book this style.`,
  ];

  if (options.imageUrl && !options.imageUrl.startsWith('data:')) {
    lines.push(``, `📸 *Look Preview:* ${options.imageUrl}`);
  } else if (options.pageUrl) {
    lines.push(``, `🌐 *Gallery Link:* ${options.pageUrl}`);
  }

  lines.push(``, `Please let me know pricing and available slots! 💕`);
  return lines.join('\n');
}

export const DEFAULT_BOUTIQUE_WHATSAPP = '+265 888 38 29 38';
export const DEFAULT_BOUTIQUE_WHATSAPP_DIGITS = '265888382938';

/**
 * Normalizes a phone number into strict E.164 digits-only format for WhatsApp deep links.
 * Handles spaces, dashes, leading '+', '00' international prefixes, accidental trunk '0'
 * after country code 265, and local Malawi 088x/099x numbers.
 */
export function normalizeWhatsAppNumber(phoneNumber?: string): string {
  let digits = (phoneNumber || DEFAULT_BOUTIQUE_WHATSAPP).replace(/[^0-9]/g, '');

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  // Handle Malawi country code with accidental local trunk zero (e.g. +265 0888...)
  if (digits.startsWith('2650')) {
    digits = '265' + digits.slice(4);
  }

  // Handle local Malawi format (e.g. 0888382938 -> 265888382938)
  if (digits.startsWith('0') && digits.length === 10) {
    digits = '265' + digits.slice(1);
  } else if (/^(88|99|98)\d{7}$/.test(digits)) {
    digits = '265' + digits;
  }

  if (digits.length < 7 || digits.length > 15) {
    return DEFAULT_BOUTIQUE_WHATSAPP_DIGITS;
  }

  return digits;
}

/**
 * Formats a displayable tel: href (+265888382938) from any raw phone string.
 */
export function buildTelUrl(phoneNumber?: string): string {
  return `tel:+${normalizeWhatsAppNumber(phoneNumber)}`;
}

/**
 * Builds a canonical WhatsApp click-to-chat deep link URL using explicit query parameters
 * (avoids wa.me 302 path redirect issues in mobile WebViews and native app intent handlers).
 */
export function buildWhatsAppUrl(phoneNumber: string, message?: string): string {
  const targetNumber = normalizeWhatsAppNumber(phoneNumber);
  const cleanMessage = (message || '').trim();
  if (!cleanMessage) {
    return `https://api.whatsapp.com/send?phone=${targetNumber}`;
  }
  return `https://api.whatsapp.com/send?phone=${targetNumber}&text=${encodeURIComponent(cleanMessage)}`;
}

/**
 * Formats WhatsApp-styled booking text into clean plain text and builds a cross-platform
 * sms: deep link (iOS & Android Messages app) pre-addressed to +265888382938.
 */
export function buildSmsUrl(phoneNumber?: string, message?: string): string {
  const targetNumber = normalizeWhatsAppNumber(phoneNumber);
  const plainMessage = (message || '')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/(^|\s)_([^_]+)_/g, '$1$2')
    .trim();

  if (!plainMessage) {
    return `sms:+${targetNumber}`;
  }

  const isIos =
    typeof navigator !== 'undefined' && /iPad|iPhone|iPod/i.test(navigator.userAgent);
  const separator = isIos ? '&' : '?';
  return `sms:+${targetNumber}${separator}body=${encodeURIComponent(plainMessage)}`;
}
