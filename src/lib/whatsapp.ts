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
    `━━━━━━━━━━━━━━━━━━━━━━`,
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
    `━━━━━━━━━━━━━━━━━━━━━━`,
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

/**
 * Builds a valid WhatsApp click-to-chat deep link URL
 */
export function buildWhatsAppUrl(phoneNumber: string, message: string): string {
  const cleanNumber = (phoneNumber || '+265 888 38 29 38').replace(/[^0-9]/g, '');
  const targetNumber = cleanNumber || '265888382938';
  return `https://wa.me/${targetNumber}?text=${encodeURIComponent(message)}`;
}
