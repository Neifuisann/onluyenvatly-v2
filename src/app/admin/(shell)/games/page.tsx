import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireTeacher } from "@/features/auth/guards";
import { RoomList } from "@/features/games/components/admin/room-list";
import { gameCopy } from "@/features/games/messages";
import { getHostRooms } from "@/features/games/queries";

const t = gameCopy.admin;

export const metadata: Metadata = { title: t.title };

/** `/admin/games` (B-05): my latest rooms, and "Tạo phòng mới". Per request. */
export default async function AdminGamesPage() {
  const user = await requireTeacher();
  const rooms = await getHostRooms(user.id);
  const create = (
    <Link href="/admin/games/new" className={buttonVariants()}>
      <Plus aria-hidden />
      {t.create}
    </Link>
  );
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader title={t.title} lead={t.lead} actions={create} />
      {rooms.length === 0 ? (
        <EmptyState
          mascot="podium"
          title={t.emptyTitle}
          description={t.emptyBody}
          action={create}
        />
      ) : (
        <RoomList rooms={rooms} />
      )}
    </div>
  );
}
