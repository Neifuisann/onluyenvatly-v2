/** Vietnamese copy for ratings and tiers (07 §4). */
import type { Tier } from "./domain/rating";

/** Tier names stay as students know them from v1. */
export const tierNames: Record<Tier, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
  diamond: "Diamond",
  master: "Master",
};

export const ratingCopy = {
  label: "Rating",
  change: (before: string, after: string) => `${before} → ${after}`,
  up: (n: number) => `tăng ${n}`,
  down: (n: number) => `giảm ${n}`,
  same: "không đổi",
  tierPrefix: "Hạng ",
  notRated: "Bài này không tính rating.",
} as const;

export const leaderboardCopy = {
  title: "Xếp hạng",
  leadAll: "Xếp theo rating hiện tại, cập nhật mỗi phút.",
  leadWeek: "Ai tăng rating nhiều nhất trong 7 ngày qua.",
  periodGroup: "Khoảng thời gian",
  periods: { all: "Tổng", week: "7 ngày qua" },
  gradeGroup: "Khối lớp",
  allGrades: "Tất cả",
  grade: (g: number) => `Lớp ${g}`,
  listLabel: "Bảng xếp hạng",
  rank: (n: number) => `Hạng ${n}`,
  me: "Bạn",
  weekChange: "7 ngày",
  gap: "Các hạng ở giữa được ẩn",
  emptyAllTitle: "Chưa có ai trên bảng xếp hạng",
  emptyAllBody: "Làm một bài kiểm tra tính rating để có tên đầu tiên.",
  emptyWeekTitle: "Tuần này chưa có ai làm bài",
  emptyWeekBody: "Bảng này chỉ tính các bài có rating trong 7 ngày qua.",
  notRankedAll:
    "Bạn chưa có rating. Làm một bài kiểm tra tính rating để có tên trên bảng.",
  notRankedWeek: "Bạn chưa làm bài tính rating nào trong 7 ngày qua.",
  findLesson: "Chọn bài",
  loading: "Đang tải bảng xếp hạng",
  errorTitle: "Không tải được bảng xếp hạng",
  errorBody: "Vui lòng thử lại sau ít phút.",
  retry: "Thử lại",
} as const;

/** `+32`, `−12` (true minus) or `0`, for rating changes. */
export const formatDelta = (n: number) =>
  n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0";

/** `1 684`: thin grouping like 07's wireframes, no locale surprises. */
export const formatRating = (n: number) =>
  String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
