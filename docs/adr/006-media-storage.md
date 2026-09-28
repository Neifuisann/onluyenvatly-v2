# ADR-006: Images in Supabase Storage (public bucket), resized in the browser before upload

- **Status:** Proposed
- **Date:** 2026-09-28

## Context
Lessons use images for question figures, options and covers. v1 uploads through the Express function (multer + sharp, max 480 px) into the `lesson-images` bucket. Vercel Hobby includes only 5K image-optimization transformations per month and 10 GB Fast Origin Transfer. Supabase Free includes 1 GB storage and 5 GB egress (+5 GB cached egress).

## Decision
- The admin picks, pastes or drops an image. The browser resizes it (canvas → **WebP**, longest side 1280 px, quality 0.8; figures are usually 30–120 KB).
- The server action `createUploadUrl()` (admin only) returns a **signed upload URL** for `media/{yyyy}/{mm}/{uuid}.webp`, and the browser uploads directly to Supabase. No image bytes pass through Vercel functions.
- Images are served from the public bucket URL with `Cache-Control: public, max-age=31536000, immutable` (paths are content-unique).
- Use `<img loading="lazy" decoding="async" width height>`. **Don't** use `next/image` optimization for lesson media, to save the 5K/month quota. Use `next/image` only for a handful of static marketing assets (bundled, optimized at build).
- The 22 handout JPGs and other static marketing images go in the repo's `public/`, converted to WebP (the ~11 MB of JPGs should come down to about 3 MB).

## Consequences
- Upload doesn't cost function time or bandwidth.
- Egress estimate: 300 students × 30 test pages/month × ~300 KB of images ≈ 2.7 GB/month worst case with no browser cache. With immutable caching the realistic figure is < 1 GB. It's watched by the quota check (see 12).
- Fallback if egress becomes a problem: Cloudflare R2 (10 GB free storage, free egress), with the same signed-URL flow.
