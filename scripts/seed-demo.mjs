/**
 * Seed realistic sample data so every app has something to show.
 *   node scripts/seed-demo.mjs                    → creates "Demo Community Church" + admin demo / demo1234
 *   node scripts/seed-demo.mjs --user <username>  → fills that user's OWN church (no new church or user)
 *   add --reset                                   → wipes that church's app data first
 * Idempotent: refuses to double-seed a church that already has people.
 *
 * Every person, address, phone number and amount here is invented sample data.
 * Phone numbers use the unassigned "+91 00000" range and emails the reserved
 * example.com / .example domains, so nothing can reach a real person.
 */
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { existsSync, readFileSync } from "node:fs";

// MONGODB_URI comes from the environment, or else from .env.local
const env = {
  ...(existsSync(".env.local")
    ? Object.fromEntries(
        readFileSync(".env.local", "utf8")
          .split("\n")
          .filter((l) => l.includes("=") && !l.startsWith("#"))
          .map((l) => {
            const i = l.indexOf("=");
            return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^(["'])(.*)\1$/, "$2")];
          })
      )
    : {}),
  ...process.env,
};
if (!env.MONGODB_URI) {
  console.error("MONGODB_URI is not set (export it, or add it to .env.local)");
  process.exit(1);
}
const reset = process.argv.includes("--reset");
const userFlag = process.argv.indexOf("--user");
const targetUser = userFlag > -1 ? String(process.argv[userFlag + 1] ?? "").trim().toLowerCase() : "";
await mongoose.connect(env.MONGODB_URI);
const db = mongoose.connection.db;
const col = (n) => db.collection(n);
const oid = () => new mongoose.Types.ObjectId();
const now = new Date();
const daysAgo = (n) => new Date(Date.now() - n * 864e5);
const utcDate = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
const pick = (arr, i) => arr[i % arr.length];

const APP_COLLECTIONS = ["people","households","funds","donations","pledges","services","attendances","checkins","groups","events","registrations","teams","serviceplans","announcements","certificates","connectcards","staffs","activitylogs","recycleitems","driveitems","settings"];
const DEMO_PROFILE = {
  denomination: "Pentecostal", pastorName: "Rev. Samuel Thomas",
  address: "12 Church Road, Riverside, Example City, Example State 000000",
  phone: "+91 00000 10000", email: "office@demo-church.example", website: "https://demo-church.example",
  currency: "INR",
};

let churchId;
let CHURCH_NAME;
let churchAddress = DEMO_PROFILE.address;

if (targetUser) {
  // ── Seed into an existing user's church ──────────────────────
  const owner = await col("users").findOne({ $or: [{ username: targetUser }, { email: targetUser }] });
  if (!owner?.churchId) {
    console.error(`no account with a church matches "${targetUser}"`);
    process.exit(1);
  }
  churchId = owner.churchId;
  const church = await col("churches").findOne({ _id: churchId });
  CHURCH_NAME = church?.name ?? owner.churchName ?? "Your church";
  const existing = await col("people").countDocuments({ churchId });
  if (existing && !reset) {
    console.log(`"${CHURCH_NAME}" already has ${existing} people — run with --reset to wipe and reseed`);
    process.exit(0);
  }
  if (existing || reset) {
    for (const n of APP_COLLECTIONS) await col(n).deleteMany({ churchId }).catch(() => {});
    console.log(`cleared existing app data for "${CHURCH_NAME}"`);
  }
  // Fill in any blank profile fields so receipts and certificates print complete
  const fill = {};
  for (const [k, v] of Object.entries(DEMO_PROFILE)) if (!church?.[k]) fill[k] = v;
  if (Object.keys(fill).length) await col("churches").updateOne({ _id: churchId }, { $set: { ...fill, updatedAt: now } });
  churchAddress = church?.address || DEMO_PROFILE.address;
  console.log(`seeding into "${CHURCH_NAME}" (church ${churchId}) for ${owner.username}`);
} else {
  // ── Stand-alone demo church + demo login ─────────────────────
  CHURCH_NAME = "Demo Community Church";
  let church = await col("churches").findOne({ name: CHURCH_NAME });
  if (church && reset) {
    const cid = church._id;
    for (const n of APP_COLLECTIONS) await col(n).deleteMany({ churchId: cid }).catch(() => {});
    await col("users").deleteMany({ churchId: cid });
    await col("churches").deleteOne({ _id: cid });
    church = null;
    console.log("reset previous demo church");
  }
  if (church) {
    console.log("demo church already exists — run with --reset to rebuild");
    process.exit(0);
  }
  churchId = oid();
  await col("churches").insertOne({
    _id: churchId, name: CHURCH_NAME, code: "demo-community-church", codeHistory: [], logoUrl: "",
    ...DEMO_PROFILE, createdAt: now, updatedAt: now,
  });
  const isFirstUser = (await col("users").countDocuments()) === 0;
  await col("users").insertOne({
    name: "Demo Admin", username: "demo", email: "demo@churchos.local",
    passwordHash: await bcrypt.hash("demo1234", 10),
    role: isFirstUser ? "superadmin" : "admin", status: "approved",
    churchName: CHURCH_NAME, churchId, resetTokenHash: null, resetTokenExpires: null,
    createdAt: now, updatedAt: now,
  });
}

// ── Households + people ────────────────────────────────────────
const families = [
  ["Thomas", "Samuel", "Mary", ["Joel", "Hannah"]],
  ["Kurian", "Ravi", "Priya", ["Aarav"]],
  ["Reddy", "Kiran", "Sneha", ["Anaya", "Vihaan", "Ishaan"]],
  ["Joseph", "Peter", "Grace", []],
  ["D'Souza", "Anthony", "Rita", ["Nathan"]],
  ["Fernandes", "Michael", "Sarah", ["Leah", "Caleb"]],
  ["Paul", "David", "Esther", ["Abigail"]],
  ["Varghese", "George", "Annie", []],
  ["Rao", "Suresh", "Lakshmi", ["Daniel", "Deborah"]],
  ["Mathew", "John", "Rebecca", ["Samuel"]],
];
const singles = ["Daniel Prakash", "Ruth Sundar", "Benjamin Lal", "Naomi Jacob", "Stephen Raj", "Lydia Abraham", "Timothy Dev", "Priscilla Isaac"];
const visitors = ["Arjun Mehta", "Kavya Nair", "Rohan Pillai", "Meera Iyer", "Vikram Shah"];

const people = [];
const households = [];
let seq = 0;
const memberNo = () => `P-${String(++seq).padStart(4, "0")}`;
const person = (o) => ({
  _id: oid(), churchId, memberNo: memberNo(), gender: "", dob: null, maritalStatus: "", bloodGroup: "", occupation: "",
  photoUrl: "", phone: "", altPhone: "", email: "", address: "", city: "Example City", state: "Example State", pincode: "000000",
  household: null, householdRole: "", status: "member", memberSince: null, firstVisit: null, source: "Invited by a friend",
  baptismDate: null, baptismPlace: "", confirmationDate: null, marriageDate: null, dedicationDate: null,
  tags: [], documents: [], notes: "", createdAt: now, updatedAt: now, ...o,
});
let phoneSeq = 10001;
const phone = () => `+91 00000 ${String(phoneSeq++).padStart(5, "0")}`;
families.forEach(([surname, husband, wife, kids], i) => {
  const hid = oid();
  const address = `${10 + i} ${pick(["Rose Lane", "Lake View Road", "Hill Top Colony", "Station Road"], i)}`;
  const h = person({ name: `${husband} ${surname}`, gender: "Male", maritalStatus: "Married", household: hid, householdRole: "head",
    phone: phone(), email: `${husband.toLowerCase()}.${surname.toLowerCase().replace(/[^a-z]/g, "")}@example.com`, address,
    dob: utcDate(1975 + i, 3 + (i % 9), 5 + i), memberSince: utcDate(2015 + (i % 6), 1, 10), firstVisit: utcDate(2014 + (i % 6), 8, 3),
    baptismDate: utcDate(1995 + i, 6, 12), baptismPlace: CHURCH_NAME, marriageDate: utcDate(2003 + i, 11, 20),
    occupation: pick(["Engineer", "Teacher", "Doctor", "Business", "Accountant"], i), tags: i % 3 === 0 ? ["usher"] : i % 3 === 1 ? ["choir"] : [] });
  const w = person({ name: `${wife} ${surname}`, gender: "Female", maritalStatus: "Married", household: hid, householdRole: "spouse",
    phone: phone(), email: `${wife.toLowerCase()}.${surname.toLowerCase().replace(/[^a-z]/g, "")}@example.com`, address,
    dob: utcDate(1978 + i, 1 + (i % 11), 15), memberSince: utcDate(2015 + (i % 6), 1, 10), firstVisit: utcDate(2014 + (i % 6), 8, 3),
    baptismDate: utcDate(1998 + i, 4, 2), baptismPlace: CHURCH_NAME, marriageDate: utcDate(2003 + i, 11, 20),
    occupation: pick(["Homemaker", "Nurse", "Designer", "Teacher"], i), tags: i % 2 === 0 ? ["choir"] : ["womens-fellowship"] });
  people.push(h, w);
  kids.forEach((k, j) => {
    people.push(person({ name: `${k} ${surname}`, gender: j % 2 === 0 ? "Male" : "Female", household: hid, householdRole: "child",
      status: "regular", dob: utcDate(2010 + j * 3 + (i % 3), 2 + j, 8), dedicationDate: utcDate(2010 + j * 3 + (i % 3), 6, 1),
      address, tags: ["kids"], source: "Born into the church" }));
  });
  households.push({ _id: hid, churchId, name: `The ${surname} family`, head: h._id, phone: h.phone, email: h.email, address,
    city: "Example City", state: "Example State", pincode: "000000", anniversary: h.marriageDate, notes: "", createdAt: now, updatedAt: now });
});
singles.forEach((n, i) => people.push(person({ name: n, gender: i % 2 === 0 ? "Male" : "Female", maritalStatus: "Single",
  phone: phone(), email: `${n.toLowerCase().replace(/\s+/g, ".")}@example.com`, dob: utcDate(1990 + i, 5, 20),
  status: i % 4 === 3 ? "regular" : "member", memberSince: utcDate(2019 + (i % 4), 3, 1), firstVisit: utcDate(2018 + (i % 4), 9, 15),
  baptismDate: i % 4 === 3 ? null : utcDate(2019 + (i % 4), 6, 12), baptismPlace: i % 4 === 3 ? "" : CHURCH_NAME,
  occupation: pick(["Software Engineer", "Student", "Architect", "Chartered Accountant"], i), tags: i % 2 === 0 ? ["youth"] : ["youth", "media"] })));
visitors.forEach((n, i) => people.push(person({ name: n, gender: i % 2 === 0 ? "Male" : "Female", phone: phone(),
  status: "visitor", firstVisit: daysAgo(3 + i * 9), source: pick(["Walk-in", "Website", "Invited by a friend", "Social media"], i), tags: [] })));
people[people.length - 1].status = "inactive";

await col("households").insertMany(households);
await col("people").insertMany(people);
console.log(`church ${churchId}: ${households.length} households, ${people.length} people`);
if (!targetUser) console.log("sign in with  username: demo   password: demo1234");

// ── Everything else — so every app opens with real-looking data ─────
const adults = people.filter((p) => p.householdRole !== "child" && p.status === "member");
const members = people.filter((p) => p.status === "member" || p.status === "regular");
const byName = (n) => people.find((p) => p.name === n);
const pastor = byName("Samuel Thomas");
const ymd = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const lastSunday = (() => { const d = ymd(now); d.setUTCDate(d.getUTCDate() - d.getUTCDay()); return d; })();
const sundays = Array.from({ length: 16 }, (_, i) => { const d = new Date(lastSunday); d.setUTCDate(d.getUTCDate() - 7 * i); return d; }).reverse();

// Staff
const staffRows = [
  ["Samuel Thomas", "Senior Pastor", "Leadership", "full-time", utcDate(2012, 1, 1), utcDate(2008, 6, 15)],
  ["Michael Fernandes", "Associate Pastor", "Leadership", "full-time", utcDate(2018, 3, 1), utcDate(2016, 2, 10)],
  ["Sarah Fernandes", "Worship Leader", "Worship", "part-time", utcDate(2019, 6, 1), null],
  ["Daniel Prakash", "Youth Pastor", "Youth", "bi-vocational", utcDate(2021, 1, 15), null],
  ["Esther Paul", "Church Administrator", "Office", "full-time", utcDate(2017, 9, 1), null],
  ["Lydia Abraham", "Children's Director", "Kids", "volunteer", utcDate(2022, 4, 1), null],
];
await col("staffs").insertMany(staffRows.map(([n, title, ministry, type, join, ord], i) => { const pp = byName(n); return {
  churchId, staffNo: `S-${String(i + 1).padStart(4, "0")}`, name: n, title, ministry, employmentType: type, phone: pp?.phone ?? "", email: pp?.email ?? "",
  photoUrl: "", joinDate: join, leaveDate: null, status: "active", person: pp?._id ?? null, ordinationDate: ord, qualifications: i < 2 ? "M.Div" : "",
  emergencyContact: { name: "", phone: "", relation: "" }, address: pp?.address ?? "", notes: "", documents: [], createdAt: now, updatedAt: now };
}));

// Funds + donations across the year + pledges
const fundNames = [["General Fund", "Tithes and regular offerings"], ["Building Fund", "Construction and facilities"], ["Missions", "Outreach and mission support"], ["Benevolence", "Helping families in need"]];
const funds = fundNames.map(([name, description]) => ({ _id: oid(), churchId, name, description, active: true, createdAt: now, updatedAt: now }));
await col("funds").insertMany(funds);
const donations = []; let rcpt = 0;
const yearStart = utcDate(now.getUTCFullYear(), 1, 1);
for (let day = new Date(yearStart); day <= now; day.setUTCDate(day.getUTCDate() + 1)) {
  if (day.getUTCDay() !== 0) continue; // Sunday offerings
  const d = new Date(day);
  adults.forEach((p, i) => {
    if ((i + d.getUTCDate()) % 3 === 0) return; // not everyone gives every week
    const fund = (i + d.getUTCMonth()) % 7 === 0 ? funds[1] : (i % 11 === 0 ? funds[2] : funds[0]);
    const amount = [500, 1000, 1500, 2000, 2500, 5000][(i * 7 + d.getUTCDate()) % 6];
    donations.push({ churchId, receiptNo: `R-${String(++rcpt).padStart(4, "0")}`, person: p._id, personName: p.name, fund: fund._id, fundName: fund.name,
      amount, mode: ["UPI", "Cash", "Bank transfer", "UPI", "Card"][(i + d.getUTCDate()) % 5], date: d, reference: "", note: "", year: String(d.getUTCFullYear()), createdAt: d, updatedAt: d });
  });
  donations.push({ churchId, receiptNo: `R-${String(++rcpt).padStart(4, "0")}`, person: null, personName: "Anonymous", fund: funds[0]._id, fundName: funds[0].name,
    amount: 3000 + (d.getUTCDate() % 5) * 400, mode: "Cash", date: d, reference: "Offering plate", note: "Loose offering", year: String(d.getUTCFullYear()), createdAt: d, updatedAt: d });
}
await col("donations").insertMany(donations);
await col("pledges").insertMany([
  { churchId, person: byName("Ravi Kurian")._id, personName: "Ravi Kurian", fund: funds[1]._id, fundName: "Building Fund", amount: 120000, frequency: "monthly", startDate: yearStart, endDate: utcDate(now.getUTCFullYear(), 12, 31), note: "New hall", status: "active", createdAt: now, updatedAt: now },
  { churchId, person: byName("Kiran Reddy")._id, personName: "Kiran Reddy", fund: funds[2]._id, fundName: "Missions", amount: 50000, frequency: "yearly", startDate: yearStart, endDate: utcDate(now.getUTCFullYear(), 12, 31), note: "", status: "active", createdAt: now, updatedAt: now },
]);

// Services + attendance (16 Sundays, 8 midweeks) + today's kids check-ins
const services = [
  { _id: oid(), churchId, name: "Sunday Service", dayOfWeek: "Sunday", time: "09:30", location: "Main Hall", active: true, sortOrder: 1, createdAt: now, updatedAt: now },
  { _id: oid(), churchId, name: "Midweek Service", dayOfWeek: "Wednesday", time: "19:00", location: "Main Hall", active: true, sortOrder: 2, createdAt: now, updatedAt: now },
  { _id: oid(), churchId, name: "Sunday School", dayOfWeek: "Sunday", time: "08:30", location: "Kids Wing", active: true, sortOrder: 3, createdAt: now, updatedAt: now },
];
await col("services").insertMany(services);
const attendances = [];
sundays.forEach((d, i) => {
  const entries = members.map((p, j) => ({ person: p._id, personName: p.name, present: (i + j) % 5 !== 0 }));
  const present = entries.filter((e) => e.present).length;
  attendances.push({ churchId, service: services[0]._id, serviceName: "Sunday Service", date: d, headcount: present + 20 + ((i * 7) % 15), adults: present + 12, children: 8 + (i % 6), entries, note: "", markedByName: "Demo Admin", createdAt: d, updatedAt: d });
  if (i % 2 === 0) {
    const wed = new Date(d); wed.setUTCDate(wed.getUTCDate() + 3);
    if (wed <= now) attendances.push({ churchId, service: services[1]._id, serviceName: "Midweek Service", date: wed, headcount: 18 + (i % 9), adults: 18 + (i % 9), children: 0, entries: [], note: "", markedByName: "Demo Admin", createdAt: wed, updatedAt: wed });
  }
});
await col("attendances").insertMany(attendances);
const kids = people.filter((p) => p.householdRole === "child").slice(0, 3);
await col("checkins").insertMany(kids.map((k, i) => { const parent = people.find((p) => p.household && String(p.household) === String(k.household) && p.householdRole === "head"); return {
  churchId, date: ymd(now), service: services[2]._id, serviceName: "Sunday School", person: k._id, personName: k.name, age: now.getUTCFullYear() - k.dob.getUTCFullYear(),
  guardianName: parent?.name ?? "", guardianPhone: parent?.phone ?? "", securityCode: ["K7QX", "M3PL", "Z9AB"][i], room: ["Toddlers", "Kids", "Kids"][i], checkedInAt: new Date(Date.now() - (30 + i * 10) * 60000), checkedOutAt: null, notes: i === 0 ? "Peanut allergy" : "", createdAt: now, updatedAt: now };
}));

// Groups
const groupDefs = [
  ["Riverside Home Group", "small-group", "Kiran Reddy", "Wednesday", "19:30", "Reddy residence", 6],
  ["Young Adults", "small-group", "Daniel Prakash", "Friday", "19:00", "Youth Hall", 8],
  ["Worship Team", "ministry", "Sarah Fernandes", "Saturday", "17:00", "Main Hall", 6],
  ["Ushers", "team", "Ravi Kurian", "Sunday", "08:45", "Foyer", 5],
  ["Women's Fellowship", "ministry", "Mary Thomas", "Saturday", "10:00", "Room 2", 8],
];
const groups = groupDefs.map(([name, type, leaderName, day, time, loc, n], gi) => {
  const leader = byName(leaderName);
  const pool = type === "small-group" && name.includes("Young") ? members.filter((p) => p.tags.includes("youth")) : name.includes("Women") ? members.filter((p) => p.gender === "Female" && p.householdRole !== "child") : adults;
  const chosen = pool.filter((p) => p._id !== leader._id).filter((_, i) => (i + gi) % 2 === 0).slice(0, n);
  const meetings = [0, 1, 2].map((w) => { const d = new Date(sundays[sundays.length - 1 - w]); return { _id: oid(), date: d, present: chosen.filter((_, i) => (i + w) % 4 !== 0).map((p) => p._id), note: "" }; });
  return { _id: oid(), churchId, name, type, description: `${name} — meets ${day}s at ${time}.`, leader: leader._id, leaderName: leader.name, coLeaders: [], meetingDay: day, meetingTime: time,
    frequency: "weekly", location: loc, members: [{ person: leader._id, personName: leader.name, role: "leader", joinedAt: utcDate(2023, 1, 1) }, ...chosen.map((p) => ({ person: p._id, personName: p.name, role: "member", joinedAt: utcDate(2023, 1 + gi, 1) }))],
    capacity: type === "small-group" ? 12 : null, open: true, tags: [], active: true, meetings, createdAt: now, updatedAt: now };
});
await col("groups").insertMany(groups);

// Events + registrations
const slug = (base) => `${base}-${String(churchId).slice(-5)}`;
const inDays = (n, h = 10) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + n, h - 5, 30));
const events = [
  { _id: oid(), churchId, title: "Family Camp 2026", description: "Three days in the hills — worship, workshops and rest for the whole family.", startAt: inDays(24, 8), endAt: inDays(26, 16), venue: "Hilltop Retreat Centre", coverUrl: "", capacity: 80, registrationOpen: true, fee: 2500, publicSlug: slug("famcamp26"), status: "published", organizer: byName("Michael Fernandes")._id, organizerName: "Michael Fernandes", tags: ["camp"], createdAt: now, updatedAt: now },
  { _id: oid(), churchId, title: "Membership Class", description: "What we believe, how we're led, and what it means to belong.", startAt: inDays(10, 10), endAt: inDays(10, 12), venue: "Room 2", coverUrl: "", capacity: 25, registrationOpen: true, fee: 0, publicSlug: slug("members-oct"), status: "published", organizer: pastor._id, organizerName: pastor.name, tags: [], createdAt: now, updatedAt: now },
  { _id: oid(), churchId, title: "Community Health Camp", description: "Free check-ups for the neighbourhood, run by volunteer doctors from the congregation.", startAt: inDays(-12, 9), endAt: inDays(-12, 14), venue: "Church grounds", coverUrl: "", capacity: null, registrationOpen: false, fee: 0, publicSlug: slug("healthcamp"), status: "completed", organizer: null, organizerName: "", tags: ["outreach"], createdAt: now, updatedAt: now },
];
await col("events").insertMany(events);
const regs = [];
adults.slice(0, 14).forEach((p, i) => regs.push({ churchId, event: events[0]._id, person: p._id, name: p.name, phone: p.phone, email: p.email, guests: i % 3, notes: "", status: "registered", source: i % 4 === 0 ? "public" : "admin", registeredAt: daysAgo(20 - i), createdAt: now, updatedAt: now }));
people.filter((p) => p.status === "visitor").slice(0, 3).forEach((p) => regs.push({ churchId, event: events[1]._id, person: p._id, name: p.name, phone: p.phone, email: p.email, guests: 0, notes: "", status: "registered", source: "public", registeredAt: daysAgo(2), createdAt: now, updatedAt: now }));
regs.push({ churchId, event: events[1]._id, person: null, name: "Sunita Rao", phone: "+91 00000 20001", email: "sunita@example.com", guests: 1, notes: "Heard about it on Instagram", status: "registered", source: "public", registeredAt: daysAgo(1), createdAt: now, updatedAt: now });
await col("registrations").insertMany(regs);

// Teams + service plans
const teamDefs = [["Worship", ["Vocals", "Keys", "Guitar", "Drums", "Bass"], "Sarah Fernandes"], ["Ushers", ["Door", "Offering", "Seating"], "Ravi Kurian"], ["Media", ["Sound", "Slides", "Camera"], "Timothy Dev"]];
const teams = teamDefs.map(([name, roles, leaderName], ti) => { const leader = byName(leaderName); const ms = members.filter((p) => p._id !== leader._id && p.householdRole !== "child").filter((_, i) => (i + ti) % 4 === 0).slice(0, 6);
  return { _id: oid(), churchId, name, description: "", roles, leader: leader._id, leaderName: leader.name, members: [{ person: leader._id, personName: leader.name, roles: [roles[0]] }, ...ms.map((p, i) => ({ person: p._id, personName: p.name, roles: [roles[(i + 1) % roles.length]] }))], active: true, createdAt: now, updatedAt: now }; });
await col("teams").insertMany(teams);
const nextSunday = new Date(lastSunday); nextSunday.setUTCDate(nextSunday.getUTCDate() + 7);
const planFor = (date, theme, scripture, status) => ({ churchId, date, title: "Sunday Service", theme, scripture, preacher: pastor._id, preacherName: pastor.name, notes: "",
  items: [["song", "Great Are You Lord", "Key of A", 5], ["song", "Way Maker", "Key of E", 6], ["prayer", "Opening prayer", "", 3], ["announcement", "Family Camp registrations open", "", 4], ["offering", "Tithes & offerings", "Ushers", 5], ["song", "Goodness of God", "Key of C", 5], ["scripture", scripture, "", 3], ["sermon", theme, "", 35], ["song", "Build My Life", "Key of G", 5], ["prayer", "Benediction", "", 2]].map(([type, title, detail, dur], i) => ({ _id: oid(), order: i + 1, type, title, detail, owner: null, ownerName: "", durationMin: dur })),
  volunteers: teams.flatMap((t) => t.members.slice(0, 3).map((m, i) => ({ _id: oid(), team: t._id, teamName: t.name, role: m.roles[0] ?? t.roles[i % t.roles.length], person: m.person, personName: m.personName, status: i === 2 ? "scheduled" : "confirmed" }))),
  status, createdAt: now, updatedAt: now });
await col("serviceplans").insertMany([
  planFor(nextSunday, "Rooted: Colossians 2", "Colossians 2:6-7", "draft"),
  planFor(lastSunday, "The Generous Heart", "2 Corinthians 9:6-8", "final"),
  planFor(sundays[sundays.length - 2], "Rest for the Weary", "Matthew 11:28-30", "final"),
]);

// Connect cards, announcements, certificates
const cardDefs = [["Arjun Mehta", "new", 3, ["Join a small group"], "Please pray for my job interview next week."], ["Kavya Nair", "contacted", 12, ["Kids ministry", "Talk to a pastor"], ""], ["Rohan Pillai", "visited-again", 21, ["Volunteer"], ""], ["Meera Iyer", "new", 5, ["Baptism"], "Thank you for the warm welcome."], ["Nikhil Bose", "joined", 60, ["Membership class"], ""], ["Farah Khan", "closed", 90, [], ""]];
await col("connectcards").insertMany(cardDefs.map(([name, status, ago, interests, prayer], i) => { const linked = byName(name); return {
  churchId, name, phone: linked?.phone ?? `+91 00000 3${String(6780 + i)}`, email: "", visitDate: daysAgo(ago), firstTime: true, howHeard: ["Invited by a friend", "Website", "Walk-in", "Social media"][i % 4], interests, prayerRequest: prayer, ageGroup: "adult", address: "", city: "Example City",
  status, assignedTo: null, assignedToName: "", followUps: status === "new" ? [] : [{ _id: oid(), at: daysAgo(ago - 2), by: "Demo Admin", method: "call", note: "Called to say hello, invited to Sunday service." }], linkedPerson: linked?._id ?? null, source: i % 2 === 0 ? "public" : "admin", createdAt: daysAgo(ago), updatedAt: daysAgo(ago) };
}));
await col("announcements").insertMany([
  { churchId, title: "Family Camp registrations are open", body: "Dear church family,\n\nRegistrations for Family Camp 2026 at the Hilltop Retreat Centre are now open. Early-bird pricing until the 15th.\n\nSee you there!", audienceType: "all", status: "", tag: "", group: null, groupName: "", channel: "email", recipients: adults.length + 8, sentTo: adults.length, skipped: 8, failed: 0, sentAt: daysAgo(6), sentByName: "Demo Admin", createdAt: daysAgo(6), updatedAt: daysAgo(6) },
  { churchId, title: "Worship team practice moved to 5 PM", body: "Practice this Saturday starts at 5 PM instead of 4 PM.", audienceType: "tag", status: "", tag: "choir", group: null, groupName: "", channel: "email", recipients: 9, sentTo: 9, skipped: 0, failed: 0, sentAt: daysAgo(2), sentByName: "Demo Admin", createdAt: daysAgo(2), updatedAt: daysAgo(2) },
]);
const certFor = (n, type, person, extra) => ({ churchId, serialNo: `C-${String(n).padStart(4, "0")}`, type, person: person._id, spouse: null, data: { personName: person.name, memberNo: person.memberNo, dob: person.dob, gender: person.gender, fatherName: "", motherName: "", spouseName: "", eventDate: person.baptismDate ?? person.memberSince ?? now, place: CHURCH_NAME, officiant: pastor.name, witnesses: "", verse: "", remark: "", churchName: CHURCH_NAME, churchAddress, logoUrl: "", pastorName: pastor.name, ...extra }, issuedAt: daysAgo(30 - n * 5), issuedBy: "Demo Admin", createdAt: now, updatedAt: now });
await col("certificates").insertMany([
  certFor(1, "baptism", byName("Benjamin Lal"), { verse: "Therefore we were buried with him through baptism into death, that just as Christ was raised from the dead through the glory of the Father, so we also might walk in newness of life. — Romans 6:4" }),
  certFor(2, "membership", byName("Ruth Sundar"), { verse: "So then you are no longer strangers and foreigners, but you are fellow citizens with the saints and of the household of God. — Ephesians 2:19" }),
  certFor(3, "dedication", byName("Aarav Kurian"), { fatherName: "Ravi Kurian", motherName: "Priya Kurian", eventDate: byName("Aarav Kurian").dedicationDate, verse: "For this child I prayed, and the Lord has given me my petition which I asked of him. — 1 Samuel 1:27" }),
]);
console.log(`seeded: ${donations.length} donations, ${attendances.length} attendance days, ${groups.length} groups, ${events.length} events, ${regs.length} registrations, ${teams.length} teams, 3 service plans, ${cardDefs.length} connect cards, 2 announcements, 3 certificates, ${staffRows.length} staff`);
await mongoose.disconnect();
