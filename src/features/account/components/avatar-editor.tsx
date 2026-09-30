"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { mediaUrl } from "@/lib/media";
import {
  createAvatarUploadUrl,
  removeMyAvatar,
  saveMyAvatar,
} from "../actions";
import { AVATAR_SIDE, MAX_AVATAR_BYTES } from "../domain/account";
import { accountCopy as t } from "../messages";

type Status = { tone: "ok" | "error"; text: string } | null;

/** Center-crops to a square and encodes a small WebP in the browser. */
async function squareWebp(
  file: File,
): Promise<{ blob: Blob; side: number } | null> {
  if (!/^image\/(png|jpeg|webp|gif|bmp|avif)$/.test(file.type)) return null;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const out = Math.min(AVATAR_SIDE, side);
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    out,
    out,
  );
  bitmap.close();
  for (const quality of [0.85, 0.7, 0.5]) {
    const blob = await new Promise<Blob | null>((r) =>
      canvas.toBlob(r, "image/webp", quality),
    );
    if (blob?.type !== "image/webp") return null;
    if (blob.size <= MAX_AVATAR_BYTES) return { blob, side: out };
  }
  return null;
}

/**
 * Avatar (S8-04): pick → crop/resize here → signed upload → save. The old
 * picture is deleted by the server. Initials stand in when there is none.
 */
export function AvatarEditor({
  path,
  initials,
}: {
  path: string | null;
  initials: string;
}) {
  const [status, setStatus] = useState<Status>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const src = path ? mediaUrl(path) : null;

  function upload(file: File) {
    start(async () => {
      setStatus({ tone: "ok", text: t.avatarUploading });
      const square = await squareWebp(file);
      if (!square) {
        setStatus({ tone: "error", text: t.avatarFailed });
        return;
      }
      const ticket = await createAvatarUploadUrl({
        contentType: "image/webp",
        bytes: square.blob.size,
        width: square.side,
        height: square.side,
      }).catch(() => null);
      if (!ticket) {
        setStatus({ tone: "error", text: t.avatarUploadFailed });
        return;
      }
      if (!ticket.ok) {
        setStatus({ tone: "error", text: ticket.message });
        return;
      }
      const res = await fetch(ticket.data.uploadUrl, {
        method: "PUT",
        headers: {
          "content-type": "image/webp",
          "cache-control": "max-age=31536000",
          "x-upsert": "false",
        },
        body: square.blob,
      }).catch(() => null);
      if (!res?.ok) {
        setStatus({ tone: "error", text: t.avatarUploadFailed });
        return;
      }
      const saved = await saveMyAvatar(ticket.data.path);
      setStatus(
        saved.ok
          ? { tone: "ok", text: t.avatarSaved }
          : { tone: "error", text: saved.message },
      );
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-5">
      {src ? (
        // biome-ignore lint/performance/noImgElement: ADR-006, pre-sized upload
        <img
          src={src}
          alt={t.avatarAlt}
          width={96}
          height={96}
          className="size-24 rounded-full bg-muted object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="flex size-24 items-center justify-center rounded-full bg-primary font-bold font-display text-3xl text-primary-foreground"
        >
          {initials}
        </span>
      )}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) upload(file);
            }}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => input.current?.click()}
          >
            <ImagePlus aria-hidden />
            {src ? t.avatarChange : t.avatarChoose}
          </Button>
          {path && (
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await removeMyAvatar();
                  setStatus(
                    r.ok
                      ? { tone: "ok", text: t.avatarRemoved }
                      : { tone: "error", text: r.message },
                  );
                })
              }
            >
              <Trash2 aria-hidden />
              {t.avatarRemove}
            </Button>
          )}
        </div>
        <p
          aria-live="polite"
          className={
            status?.tone === "error"
              ? "text-danger-text text-sm"
              : "text-muted-foreground text-sm"
          }
        >
          {status?.text}
        </p>
      </div>
    </div>
  );
}
