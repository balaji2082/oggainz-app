"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { removeAvatar, updateAvatar } from "@/app/actions/support";
import { Avatar } from "./Bits";
import { useToast } from "./ui/Toast";

/**
 * The one thing about themselves a customer may change (docs/05 §4.1).
 *
 * Resized client-side before it ever leaves the phone — at ~30 customers this
 * is a few dozen small images, and shrinking here is what keeps a photo
 * straight off a phone camera (often 4-8MB) from ever reaching the server.
 * The 200KB check in lib/profiles.ts is the backstop, not the first line.
 */
export default function AvatarUploader({ name, src }: { name: string; src: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(src);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function resize(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = () => {
        img.onload = () => {
          const size = 512;
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("canvas unavailable"));
          // Cover-crop to a square from the centre, so a portrait or landscape
          // photo both become a clean circle rather than a squashed oval.
          const scale = Math.max(size / img.width, size / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = () => reject(new Error("that file doesn't look like an image"));
        img.src = String(reader.result);
      };
      reader.onerror = () => reject(new Error("couldn't read that file"));
      reader.readAsDataURL(file);
    });
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await resize(file);
      setPreview(dataUrl);
      startTransition(async () => {
        const result = await updateAvatar(dataUrl);
        toast(result.message, result.ok ? "good" : "bad");
        if (!result.ok) setPreview(src);
        else router.refresh();
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't use that photo", "bad");
    }
  }

  function onRemove() {
    startTransition(async () => {
      const result = await removeAvatar();
      toast(result.message, result.ok ? "good" : "bad");
      if (result.ok) {
        setPreview(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        className="og-press relative rounded-full disabled:opacity-60"
        aria-label="Change photo"
      >
        <Avatar name={name} src={preview} size={64} />
        <span
          aria-hidden="true"
          className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--og-forest)] text-white shadow-[var(--og-e1)]"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7.5h3l1.5-2.5h7L17 7.5h3v11H4z" />
            <circle cx="12" cy="13" r="3.2" />
          </svg>
        </span>
      </button>
      <div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="og-press block text-[13.5px] font-semibold text-[var(--og-heading)]"
        >
          {preview ? "Change photo" : "Add a photo"}
        </button>
        {preview && (
          <button
            type="button"
            onClick={onRemove}
            className="og-press mt-0.5 block text-[12.5px] text-[var(--og-text-muted)]"
          >
            Remove
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onPick}
        className="hidden"
      />
    </div>
  );
}
