import type { GuideSection } from '@/components/common';

/**
 * Copy for the in-page FeatureGuide panels.
 *
 * Kept as data rather than JSX so the wording can be reviewed without reading
 * markup. Every number here is taken from the backend implementation — if the
 * behaviour changes, update these too or the guide becomes a lie.
 */

export const invoiceGuide: GuideSection[] = [
  {
    heading: 'What this page holds',
    body:
      'A GST tax invoice is generated automatically for each completed ride. This page is the record — you do not create invoices by hand. Wallet recharges are deliberately excluded: GST was removed from recharges, so only rides are taxed.',
  },
  {
    heading: 'How the tax is worked out',
    body:
      'Fares are GST-inclusive, so the tax is extracted from the fare rather than added on top. A ₹525 fare is treated as ₹500 of service plus ₹25 of GST — the customer is never charged more than the fare they were quoted.',
    bullets: [
      'Taxable value = fare ÷ 1.05, then tax = fare − taxable value.',
      'Same state as the company: split into CGST 2.5% + SGST 2.5%.',
      'Different state: a single IGST line at 5% instead.',
      'Rates come from the server environment (INVOICE_GST_RATE and friends), not from this screen.',
    ],
  },
  {
    heading: 'B2C vs B2B',
    body:
      'If the customer has supplied their own GSTIN, it is printed as the receiver GSTIN and the invoice serves as their input-credit document. With no GSTIN it is an ordinary consumer invoice. The company GSTIN shown on every invoice comes from INVOICE_ISSUER_GSTIN.',
  },
  {
    heading: 'What the customer sees',
    body:
      'The invoice is attached to the completed ride in their app and can be downloaded as a PDF from the ride detail screen. Nothing is emailed unless transactional email has been configured on the server.',
  },
];

export const notificationTemplateGuide: GuideSection[] = [
  {
    heading: 'What a template is',
    body:
      'The app fires notifications by key, not by text. When a ride is assigned, the backend looks up the template with that key and fills in the blanks. Editing the wording here changes what users receive with no app release.',
  },
  {
    heading: 'Field reference',
    table: {
      head: ['Field', 'What it does', 'Example'],
      rows: [
        [
          'key',
          'The slug the backend fires. This is the only field the code looks at — renaming it after go-live silently stops that notification.',
          'ride_assigned',
        ],
        ['name', 'Human label, shown in this admin list only. Safe to change.', 'Driver assigned'],
        ['description', 'Internal note for other admins. Never shown to users.', 'Sent once a driver accepts'],
        [
          'type',
          'Grouping only — ride, payment, promo, safety or system. Used for filtering, not routing.',
          'ride',
        ],
        [
          'channel',
          'Where it goes. push = banner on the phone. inapp = the bell list inside the app. both = both.',
          'both',
        ],
        [
          'locale',
          'Language variant. The same key can exist once per language; the app picks by the user’s setting and falls back to en.',
          'en / hi',
        ],
        [
          'titleTemplate',
          'Notification headline. Supports {{variable}} placeholders.',
          '{{driverName}} is on the way',
        ],
        [
          'bodyTemplate',
          'Notification body. Keep the first line meaningful — phones show it collapsed until tapped.',
          'Arriving in about {{eta}} minutes.',
        ],
        [
          'variables',
          'Names this template expects to be given. Documentation for the next admin — it does not create the values.',
          'driverName, eta',
        ],
        [
          'defaultData',
          'Fallbacks merged underneath the runtime values, so a missing variable renders a sensible word instead of a blank.',
          '{ "eta": "a few" }',
        ],
        ['isActive', 'Switched off, the template never fires. Use this instead of deleting.', 'On'],
      ],
    },
  },
  {
    heading: 'Worked example',
    body:
      'A template with key ride_assigned, channel both, and body "Arriving in about {{eta}} minutes." fires when the backend assigns a driver and passes eta = 6. The customer gets a phone banner reading "Arriving in about 6 minutes." and the same message appears in their in-app notification list.',
  },
  {
    heading: 'Before you save',
    bullets: [
      'Every {{placeholder}} in the title and body should also be listed under variables.',
      'A placeholder with no value and no default renders as empty text in a live notification.',
      'Write the important part first — the phone collapses long messages until the user expands them.',
    ],
  },
];

export const adminAlertsGuide: GuideSection[] = [
  {
    heading: 'Two different things',
    body:
      'Alerts come to you; this page sends notifications out to riders and drivers. They are unrelated systems that both use the word "notification".',
  },
  {
    heading: 'Where your alerts appear',
    bullets: [
      'The bell in the top bar carries an unread count and opens a panel listing what needs attention.',
      'Alerts stay in that panel until dealt with — they are not pop-ups and cannot be missed by looking away.',
      'The brief green and red toasts are only confirmations that a button you pressed worked. They are not alerts and nothing is lost when they fade.',
    ],
  },
  {
    heading: 'Sending to users',
    body:
      'Choose the audience and the channel. Push arrives as a banner on the phone even when the app is closed; in-app only appears in the user’s notification list when they next open the app. Picking both is the usual choice for anything time-sensitive.',
  },
];

export const loyaltyGuide: GuideSection[] = [
  {
    heading: 'How points are earned',
    body:
      'Points are awarded automatically when a ride completes — never on booking, and never for a cancelled ride. The base rate is 0.1 points per rupee of the final fare, so a ₹250 ride earns 25 points before any tier bonus. That rate is a server setting (LOYALTY_POINTS_PER_RUPEE), not a field on this page.',
  },
  {
    heading: 'The two balances',
    bullets: [
      'Points balance — what the customer can actually spend. Falls when they redeem a reward.',
      'Lifetime points — the running total that never decreases. This alone decides their tier, so redeeming a reward can never demote anyone.',
    ],
  },
  {
    heading: 'How a tier is chosen',
    body:
      'A customer sits in the highest active tier whose "minimum lifetime points" they have reached. Set Silver at 0, Gold at 500 and Platinum at 2000, and someone on 640 lifetime points is Gold until they cross 2000. The order field only controls display order in lists — the threshold is what actually decides the tier.',
    table: {
      head: ['Tier field', 'Effect'],
      rows: [
        ['minLifetimePoints', 'Entry threshold. The only field that determines who is in this tier.'],
        [
          'earnMultiplier',
          'Multiplies points earned per ride. 1.5 turns a 25-point ride into 38 for this tier.',
        ],
        ['rideDiscountPct', 'Percentage discount applied for members of this tier.'],
        ['active', 'An inactive tier is ignored entirely when tiers are recalculated.'],
      ],
    },
  },
  {
    heading: 'Rewards',
    body:
      'Each reward has a points cost and, optionally, a minimum tier. A reward gated to Gold cannot be redeemed by a Silver customer even if they have saved enough points — the tier gate is checked first.',
  },
  {
    heading: 'What the customer sees',
    body:
      'Their current tier, their spendable balance, and how many more lifetime points they need to reach the next tier. Rewards they cannot yet afford or do not qualify for are shown but locked, which is what makes the ladder motivating.',
  },
];
