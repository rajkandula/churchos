"use client";

import { toDateInput } from "@/lib/client-api";
import { SOURCE_OPTIONS } from "@/lib/constants";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import {
  AGE_GROUPS,
  AGE_GROUP_LABELS,
  INTEREST_OPTIONS,
  type ConnectCardDto,
} from "./types";

export type CardFormState = {
  name: string;
  phone: string;
  email: string;
  visitDate: string;
  firstTime: boolean;
  howHeard: string;
  interests: string[];
  prayerRequest: string;
  ageGroup: string;
  address: string;
  city: string;
};

export function newCardForm(): CardFormState {
  return {
    name: "",
    phone: "",
    email: "",
    visitDate: toDateInput(new Date()),
    firstTime: true,
    howHeard: "",
    interests: [],
    prayerRequest: "",
    ageGroup: "",
    address: "",
    city: "",
  };
}

export function cardToForm(card: ConnectCardDto): CardFormState {
  return {
    name: card.name,
    phone: card.phone ?? "",
    email: card.email ?? "",
    visitDate: toDateInput(card.visitDate),
    firstTime: card.firstTime ?? true,
    howHeard: card.howHeard ?? "",
    interests: card.interests ?? [],
    prayerRequest: card.prayerRequest ?? "",
    ageGroup: card.ageGroup ?? "",
    address: card.address ?? "",
    city: card.city ?? "",
  };
}

/** Toggleable interest chips — shared by the admin forms. */
export function InterestChips({
  value,
  onChange,
  options = INTEREST_OPTIONS,
  size = "sm",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  options?: readonly string[];
  size?: "sm" | "md";
}) {
  const toggle = (i: string) =>
    onChange(value.includes(i) ? value.filter((x) => x !== i) : [...value, i]);
  const pad = size === "md" ? "px-4 py-2.5 text-sm" : "px-3 py-1.5 text-xs";
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((i) => {
        const on = value.includes(i);
        return (
          <button
            key={i}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(i)}
            className={`cursor-pointer rounded-full border font-semibold transition-colors duration-150 ${pad} ${
              on
                ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-600"
            }`}
          >
            {i}
          </button>
        );
      })}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="border-b border-slate-100 pb-2 text-xs font-bold tracking-widest text-slate-400 uppercase">
      {children}
    </h3>
  );
}

/** The editable fields of a card — used by "Add card" and "Edit details". */
export function CardFields({
  form,
  onChange,
}: {
  form: CardFormState;
  onChange: (patch: Partial<CardFormState>) => void;
}) {
  const set =
    (key: keyof CardFormState) =>
    (
      e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) =>
      onChange({ [key]: e.target.value });

  return (
    <div className="space-y-7">
      <section className="space-y-4">
        <SectionTitle>Visitor</SectionTitle>
        <TextField
          label="Full name"
          required
          value={form.name}
          onChange={set("name")}
          placeholder="e.g. Anita Joseph"
          maxLength={120}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Phone"
            type="tel"
            value={form.phone}
            onChange={set("phone")}
            placeholder="+91 00000 00000"
          />
          <TextField
            label="Email"
            type="email"
            value={form.email}
            onChange={set("email")}
            placeholder="name@example.com"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Visit date"
            type="date"
            value={form.visitDate}
            onChange={set("visitDate")}
          />
          <SelectField
            label="Age group"
            value={form.ageGroup}
            onChange={set("ageGroup")}
            placeholder="Not specified"
            options={AGE_GROUPS.map((g) => ({ value: g, label: AGE_GROUP_LABELS[g] }))}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="First visit?"
            value={form.firstTime ? "yes" : "no"}
            onChange={(e) => onChange({ firstTime: e.target.value === "yes" })}
            options={[
              { value: "yes", label: "Yes — first time" },
              { value: "no", label: "No — been before" },
            ]}
          />
          <SelectField
            label="How did they hear about us?"
            value={form.howHeard}
            onChange={set("howHeard")}
            placeholder="Not specified"
            options={SOURCE_OPTIONS}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Address"
            value={form.address}
            onChange={set("address")}
            maxLength={300}
          />
          <TextField
            label="City"
            value={form.city}
            onChange={set("city")}
            maxLength={100}
          />
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>Interested in</SectionTitle>
        <InterestChips
          value={form.interests}
          onChange={(interests) => onChange({ interests })}
        />
      </section>

      <section className="space-y-4">
        <SectionTitle>Prayer request</SectionTitle>
        <TextAreaField
          label="Anything we can pray about?"
          value={form.prayerRequest}
          onChange={set("prayerRequest")}
          maxLength={2000}
          placeholder="Optional"
        />
      </section>
    </div>
  );
}
