/**
 * Starter announcements every church ends up writing sooner or later.
 *
 * These are drafts to edit, not forms to fill: the `{…}` markers are the bits
 * only the office knows. A church can also save its own — those live in the
 * AnnouncementTemplate collection and are returned alongside these.
 */

export type BuiltInTemplate = {
  /** Stable id — built-ins have a key and no _id. */
  key: string;
  name: string;
  description: string;
  title: string;
  /** Plain text; blank lines separate paragraphs. */
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  category: string;
};

export const TEMPLATE_CATEGORIES = [
  "Service",
  "Events",
  "Care",
  "Giving",
  "Community",
] as const;

export const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
  // ── Service ──────────────────────────────────────────────────────────
  {
    key: "service-time-change",
    name: "Service time change",
    description: "Tell everyone a service is moving to a new time.",
    category: "Service",
    title: "Our Sunday service moves to {time} from {date}",
    body: `Dear church family,

Starting {date}, our Sunday morning service will begin at {time} instead of {old time}. The change gives families a little more room to arrive, settle and greet one another before we open in worship.

Nothing else changes — same building, same welcome, same Lord. Please make a note of it, and do pass the word to anyone who may not see this email.

Grace and peace,
{pastor name}`,
  },
  {
    key: "venue-change",
    name: "Meeting somewhere else",
    description: "A one-off (or lasting) change of venue, with directions.",
    category: "Service",
    title: "This Sunday we are meeting at {venue}",
    body: `Dear friends,

Because of {reason}, our service on {date} will be held at {venue}, {address}, at our usual {time}. Parking is available {parking note}, and volunteers will be at the door to point you in the right direction.

If you need a lift, reply to this email or call the church office on {phone} and we will happily arrange one.

See you there,
{pastor name}`,
    ctaLabel: "Get directions",
  },
  {
    key: "service-cancelled-weather",
    name: "Service cancelled — weather",
    description: "Call off a service safely and say what happens instead.",
    category: "Service",
    title: "Service cancelled this Sunday, {date}",
    body: `Dear church family,

With {weather} forecast for {date}, we have decided not to gather in person this Sunday. Your safety on the roads matters more to us than our attendance, and we would rather you stayed warm and dry at home.

We will still worship together — join us online at {time} on {platform}, and take a few minutes to read {passage} with your household.

Please check on any neighbour who lives alone. We will see you again on {next date}.`,
  },

  // ── Events ───────────────────────────────────────────────────────────
  {
    key: "event-invitation",
    name: "Event invitation",
    description: "Invite the church to something new and say why it matters.",
    category: "Events",
    title: "You are invited: {event name}, {date}",
    body: `Dear church family,

We would love you to join us for {event name} on {date} at {time}, at {venue}. {One sentence on what the evening or day is for — who it is aimed at and what people will come away with.}

Bring a friend, bring your family, and if you are able to help with {need — food, setup, welcome}, let us know when you reply.

We are looking forward to seeing you there.`,
    ctaLabel: "Save my spot",
  },
  {
    key: "event-reminder",
    name: "Event reminder",
    description: "The nudge a few days before — time, place, what to bring.",
    category: "Events",
    title: "{event name} is this {day} — here is what you need",
    body: `Just a quick reminder that {event name} is this {day}, {date}.

We start at {time} at {venue}. Please bring {what to bring}, and arrive a few minutes early so we can begin on time. {Parking / childcare / meal note.}

If your plans have changed and you can no longer come, reply to this email so we can free your place for someone else.`,
  },
  {
    key: "registration-closing",
    name: "Registration closing",
    description: "Last call before a sign-up list closes.",
    category: "Events",
    title: "Last day to register for {event name}",
    body: `Registration for {event name} closes on {date} at {time}, and we have {number} places left.

We need final numbers by then for {reason — catering, transport, accommodation}, so we are not able to take late sign-ups this year. If you have been meaning to put your name down, today is the day.

Any questions at all, call the office on {phone} — we are glad to help.`,
    ctaLabel: "Register now",
  },

  // ── Care ─────────────────────────────────────────────────────────────
  {
    key: "prayer-meeting",
    name: "Prayer meeting",
    description: "Gather the church to pray, with what you will pray for.",
    category: "Care",
    title: "Praying together this {day} at {time}",
    body: `Dear church family,

We meet to pray this {day}, {date}, at {time} in {venue}. We will keep it simple — a short reading, then time to pray together for {focus, e.g. our city, the sick among us, the work of the gospel}.

You do not need to pray aloud, and you do not need the right words. Come as you are and pray as you can; there is room for everyone.

If you have something you would like us to carry to God on your behalf, reply to this email and it will be held in confidence.`,
  },
  {
    key: "bereavement",
    name: "Bereavement notice",
    description: "Share the loss of a church member with care and details.",
    category: "Care",
    title: "With sorrow: the passing of {name}",
    body: `Dear church family,

It is with deep sadness that we share the news that {name} went to be with the Lord on {date}, aged {age}. {A sentence or two of what they meant to this church — where they served, who they loved, what people will remember.}

The funeral service will be held at {venue} on {date} at {time}, and all are welcome. The family have asked for {flowers / donations note}.

Please hold {family names} in prayer in the days ahead, and do reach out to them — a card, a meal, a visit. "Blessed are those who mourn, for they shall be comforted."`,
  },
  {
    key: "hospital-visit",
    name: "Hospital visit request",
    description: "Ask a few people to visit someone who is unwell.",
    category: "Care",
    title: "{name} is in hospital — can you visit?",
    body: `Dear friends,

{name} was admitted to {hospital} on {date} and is expected to be there for {duration}. They are in good spirits but the days are long, and a familiar face makes a great deal of difference.

Visiting hours are {hours}, and the family have asked that we come {one or two at a time / after {time}}. If you are able to go, reply to this email so we can spread the visits across the week rather than all arriving at once.

Please pray for {specific request}, and for {family names} as they keep watch.`,
  },

  // ── Giving ───────────────────────────────────────────────────────────
  {
    key: "giving-statement-ready",
    name: "Giving statement ready",
    description: "Year-end statements are available — how to get one.",
    category: "Giving",
    title: "Your {year} giving statement is ready",
    body: `Dear {church} family,

Your giving statement for {year} is now ready. It lists every gift recorded against your name between {start date} and {end date}, and you may need it for your tax return.

Thank you. Because of your generosity this year we were able to {one concrete thing — support {number} families, finish the roof, send the youth to camp}. None of that is abstract to the people it reached.

If anything on the statement looks wrong, or you would prefer a printed copy, reply to this email or call the office on {phone} and we will sort it out.`,
    ctaLabel: "View my statement",
  },
  {
    key: "special-offering",
    name: "Special offering appeal",
    description: "Ask for a one-off gift towards a specific need.",
    category: "Giving",
    title: "A special offering for {cause} on {date}",
    body: `Dear church family,

On {date} we will take a special offering for {cause}. We are asking the Lord for {amount}, which will cover {exactly what the money does — the boiler, the mission trip, the food bank through winter}.

Please pray about what you are able to give before Sunday, and give cheerfully rather than under pressure — every gift, of any size, is received with thanks. Gifts can be placed in the offering, given online, or handed to {name} at the office.

Thank you for the way this church has always answered a need.`,
    ctaLabel: "Give now",
  },

  // ── Community ────────────────────────────────────────────────────────
  {
    key: "welcome-new-members",
    name: "Welcome to new members",
    description: "A warm first email to people who have just joined.",
    category: "Community",
    title: "Welcome to {church} — we are glad you are here",
    body: `Dear {name},

We are delighted that you have made {church} your church home. Belonging here is not about filling a seat: it is about being known, being prayed for, and finding a place to serve alongside people who will become friends.

Two easy next steps. First, come to our newcomers' morning on {date} at {time} — coffee, a short introduction to who we are, and a chance to ask anything. Second, have a look at our groups; joining one is the quickest way for a big church to feel small.

If you need anything at all, reply to this email or speak to {name} on a Sunday. We are so glad you are with us.`,
    ctaLabel: "See our groups",
  },
  {
    key: "volunteer-call",
    name: "Volunteer call",
    description: "Ask for help in a specific ministry, with the real details.",
    category: "Community",
    title: "We need your hands: {ministry} volunteers",
    body: `Dear church family,

Our {ministry} team is looking for {number} more volunteers. The commitment is {frequency, e.g. one Sunday a month} and involves {what they will actually do}. No experience is needed — {name} will train you and you will never serve alone.

Serving here is not about filling a rota. It is how a church looks after its own, and the people who do it often say they receive more than they give.

If you would like to know more before deciding, reply to this email and {name} will call you for a chat.`,
    ctaLabel: "Count me in",
  },
  {
    key: "baptism-celebration",
    name: "Baptism celebration",
    description: "Invite the church to a baptism and name those being baptised.",
    category: "Community",
    title: "Baptism Sunday — {date}",
    body: `Dear church family,

On {date} at {time} we will celebrate the baptism of {names}. Each of them has come to trust the Lord Jesus, and each has asked to say so publicly before this church family.

Come and be part of it. There are few better days in the life of a church, and your presence is an encouragement to those taking this step. We will share {refreshments / a shared meal} afterwards, so please stay.

If God has been stirring the same question in you, speak to {pastor name} — it would be a joy to talk it through.`,
  },
];
