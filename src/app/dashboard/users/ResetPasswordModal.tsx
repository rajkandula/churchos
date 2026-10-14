"use client";

import { useState } from "react";
import { api } from "@/lib/client-api";
import { generateTempPassword } from "@/lib/temp-password";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { ShareCredentials, TempPasswordField } from "./AddUserModal";
import { MIN_PASSWORD_LENGTH, type UserDto } from "./types";

/** Keyed on the user so every open starts with a fresh password. */
export function ResetPasswordModal({
  user,
  onClose,
  onDone,
}: {
  user: UserDto | null;
  onClose: () => void;
  onDone: () => void;
}) {
  if (!user) return null;
  return <ResetPasswordModalInner key={user._id} user={user} onClose={onClose} onDone={onDone} />;
}

function ResetPasswordModalInner({
  user,
  onClose,
  onDone,
}: {
  user: UserDto;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [password, setPassword] = useState(() => generateTempPassword());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`The temporary password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setSaving(true);
    try {
      await api(`/api/users/${user._id}/password`, { method: "POST", json: { password } });
      setSaved(password);
      toast.success(`Password reset for ${user.name}.`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reset the password.");
    } finally {
      setSaving(false);
    }
  }

  if (saved !== null) {
    return (
      <Modal
        open
        onClose={onClose}
        title="Share the new password"
        subtitle={`${user.name}'s old password no longer works. This one is shown only once.`}
      >
        <ShareCredentials
          username={user.username}
          password={saved}
          note="They'll be asked to choose their own password the next time they sign in."
        />
        <div className="mt-6 flex justify-end">
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Reset password for ${user.name}`}
      subtitle={`@${user.username} · their current password stops working immediately.`}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <TempPasswordField
          value={password}
          onChange={setPassword}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters. Tell ${user.name.split(" ")[0]} in person — it's never emailed, and they'll set their own on next sign-in.`}
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Reset password
          </Button>
        </div>
      </form>
    </Modal>
  );
}
