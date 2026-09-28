import { BookOpen } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell/app-shell";
import { EmptyState } from "@/components/empty-state";
import { MathText } from "@/components/math-text/math-text";
import { PublicHeader } from "@/components/public-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { env } from "@/lib/env.server";

/**
 * Hidden component gallery (07 §8): Storybook-less, free. 404 in production.
 * Dev-only page, so its sample copy is inline rather than in messages.ts.
 */
export const metadata: Metadata = {
  title: "UI",
  robots: { index: false, follow: false },
};

const swatches = [
  ["background", "bg-background"],
  ["surface", "bg-surface"],
  ["muted", "bg-muted"],
  ["border", "bg-border"],
  ["primary", "bg-primary"],
  ["primary-soft", "bg-primary-soft"],
  ["accent", "bg-accent"],
  ["success", "bg-success"],
  ["danger", "bg-danger"],
  ["warning", "bg-warning"],
] as const;

const tiers = [
  ["Đồng", "bg-tier-bronze"],
  ["Bạc", "bg-tier-silver"],
  ["Vàng", "bg-tier-gold"],
  ["Bạch kim", "bg-tier-platinum"],
  ["Kim cương", "bg-tier-diamond"],
  ["Cao thủ", "bg-tier-master"],
] as const;

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold text-lg">{title}</h2>
      {children}
    </section>
  );
}

export default function DevUiPage() {
  if (env.VERCEL_ENV === "production") notFound();
  return (
    <div className="flex flex-col">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-10 px-4 py-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-semibold text-3xl">/dev/ui</h1>
          <ThemeToggle />
        </div>

        <Section title="Màu (tokens)">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {swatches.map(([name, cls]) => (
              <div key={name} className="flex flex-col gap-1">
                <div className={`h-12 rounded-md border ${cls}`} />
                <code className="text-muted-foreground text-xs">{name}</code>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {tiers.map(([name, cls]) => (
              <span
                key={name}
                className={`rounded-full px-3 py-1 font-medium text-sm text-white ${cls}`}
              >
                {name}
              </span>
            ))}
          </div>
        </Section>

        <Section title="Chữ">
          <p className="text-4xl font-bold">Tiêu đề 2,75 rem · Ễ Ỗ Ữ</p>
          <p className="text-3xl font-semibold">H1 — Dao động điều hòa</p>
          <p className="text-2xl font-semibold">H2 — Con lắc lò xo</p>
          <p className="text-xl font-semibold">H3 — Chu kì và tần số</p>
          <p className="text-stem">
            Câu hỏi (1,125 rem, line-height 1,7): Một vật dao động điều hòa với
            biên độ 5 cm, chu kì 2 s. Tốc độ cực đại của vật là bao nhiêu?
          </p>
          <p>Nội dung 1 rem. Học sinh luyện đề mỗi ngày.</p>
          <p className="text-sm text-muted-foreground">
            Nhỏ 0,875 rem, màu phụ.
          </p>
          <p className="text-caption text-muted-foreground">
            Chú thích 0,8125 rem.
          </p>
          <p className="font-mono text-2xl tabular-nums">32:15 · 7,75/10</p>
        </Section>

        <Section title="MathText (Markdown-lite + KaTeX)">
          <MathText
            className="text-stem"
            text={
              "Một vật dao động điều hòa với phương trình $x = 5\\cos(2\\pi t + \\frac{\\pi}{3})$ cm.\n**Tốc độ cực đại** của vật là *bao nhiêu*?\n\n$$v_{max} = \\omega A = 2\\pi \\cdot 5 = 10\\pi \\approx 31{,}4\\ \\text{cm/s}$$\n\nLỗi cú pháp vẫn hiển thị: $\\frac{1}{$"
            }
          />
        </Section>

        <Section title="Nút">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Bắt đầu làm bài</Button>
            <Button variant="secondary">Xem lại</Button>
            <Button variant="ghost">Bỏ qua</Button>
            <Button variant="danger">Xóa</Button>
            <Button variant="link">Liên kết</Button>
            <Button size="sm">Nhỏ</Button>
            <Button size="lg">Lớn</Button>
            <Button disabled>Đang lưu…</Button>
            <Button size="icon" aria-label="Bài tập">
              <BookOpen aria-hidden />
            </Button>
          </div>
        </Section>

        <Section title="Biểu mẫu">
          <div className="grid max-w-md gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="dev-phone">Số điện thoại</Label>
              <Input
                id="dev-phone"
                inputMode="tel"
                placeholder="0912 345 678"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="dev-invalid">Có lỗi</Label>
              <Input
                id="dev-invalid"
                aria-invalid
                aria-describedby="dev-invalid-err"
                defaultValue="12345"
              />
              <p id="dev-invalid-err" className="text-danger-text text-sm">
                Số điện thoại không hợp lệ.
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="dev-grade">Khối</Label>
              <Select id="dev-grade" defaultValue="12">
                <option value="10">10</option>
                <option value="11">11</option>
                <option value="12">12</option>
              </Select>
            </div>
          </div>
        </Section>

        <Section title="Thông báo">
          <div className="grid max-w-xl gap-3">
            <Alert>Tài khoản đang chờ giáo viên duyệt.</Alert>
            <Alert variant="success">Đã lưu.</Alert>
            <Alert variant="danger">Sai số điện thoại hoặc mật khẩu.</Alert>
          </div>
        </Section>

        <Section title="Thẻ, trống, đang tải">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Đề ôn GK1</CardTitle>
                <CardDescription>28 câu · 50 phút</CardDescription>
              </CardHeader>
              <CardContent className="text-sm">
                Dao động cơ · Khối 12
              </CardContent>
              <CardFooter>
                <Button size="sm">Làm bài</Button>
              </CardFooter>
            </Card>
            <EmptyState
              icon={BookOpen}
              title="Chưa có bài tập"
              description="Quay lại sau nhé."
            />
            <div className="flex flex-col gap-3 rounded-lg border p-5">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        </Section>

        <Section title="AppShell (học sinh)">
          <div className="relative h-[520px] overflow-hidden rounded-lg border [transform:translateZ(0)]">
            <AppShell
              user={{ fullName: "Nguyễn Văn An", role: "student" }}
              variant="student"
            >
              <p>Nội dung trang.</p>
            </AppShell>
          </div>
        </Section>
      </main>
    </div>
  );
}
