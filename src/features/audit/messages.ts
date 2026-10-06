import type { AuditArea } from "./domain/audit-log";

/** What each `audit_log.action` did, in the teacher's words. */
const actions: Record<string, string> = {
  "lesson.create": "Tạo bài mới",
  "lesson.import": "Nhập bài bằng AI",
  "lesson.duplicate": "Nhân bản bài",
  "lesson.reorder": "Sắp xếp lại bài",
  "lesson.archive": "Lưu trữ bài",
  "lesson.restore": "Khôi phục bài",
  "lesson.delete": "Xóa bài",
  "lesson.settings": "Sửa cài đặt bài",
  "lesson.cover": "Đổi ảnh bìa",
  "lesson.save_draft": "Lưu nháp",
  "lesson.publish": "Xuất bản bài",
  "lesson.unpublish": "Ngừng xuất bản",
  "lesson.discard_draft": "Bỏ bản nháp",
  "student.approve": "Duyệt học sinh",
  "student.reject": "Từ chối học sinh",
  "student.reset_password": "Đặt lại mật khẩu",
  "student.revoke_sessions": "Đăng xuất mọi thiết bị",
  "student.disable": "Khóa tài khoản",
  "student.enable": "Mở khóa tài khoản",
  "student.delete": "Xóa học sinh",
  "student.grant_attempts": "Cho thêm lượt làm",
  "student.revoke_attempts": "Thu hồi lượt làm thêm",
  "attempt.delete": "Xóa bài làm",
  "explanation.pregenerate": "Tạo sẵn giải thích",
  "explanation.update": "Sửa giải thích",
  "explanation.approve": "Duyệt giải thích",
  "explanation.regenerate": "Tạo lại giải thích",
  "game.create": "Tạo phòng thi đấu",
  "game.remove_player": "Mời học sinh rời phòng thi đấu",
  "account.update_profile": "Sửa hồ sơ",
  "account.request_deletion": "Yêu cầu xóa tài khoản",
  "account.cancel_deletion": "Hủy yêu cầu xóa tài khoản",
  "settings.update": "Sửa cài đặt chung",
  "admin.create": "Thêm quản trị viên",
};

const areas: Record<AuditArea, string> = {
  lessons: "Bài tập",
  students: "Học sinh",
  results: "Kết quả",
  explanations: "Giải thích AI",
  games: "Thi đấu",
  accounts: "Tài khoản",
  settings: "Cài đặt",
};

const targets: Record<string, string> = {
  lesson: "Bài",
  user: "Tài khoản",
  attempt: "Bài làm",
  explanation: "Giải thích",
  game: "Phòng thi đấu",
  settings: "Cài đặt chung",
};

/** `/admin/audit` (M11). */
export const auditCopy = {
  title: "Nhật ký",
  lead: "Mọi thay đổi của quản trị viên và học sinh, mới nhất trước. Lưu 180 ngày.",
  loading: "Đang tải nhật ký",
  errorTitle: "Không tải được nhật ký",
  areasLabel: "Lọc theo mục",
  allAreas: "Tất cả",
  area: (area: AuditArea) => areas[area],
  listLabel: "Các mục nhật ký",
  count: (n: number) => `${n.toLocaleString("vi-VN")} mục`,
  countRange: (from: number, to: number, total: number, capped: boolean) =>
    `${from.toLocaleString("vi-VN")}–${to.toLocaleString("vi-VN")} / ${total.toLocaleString("vi-VN")}${capped ? "+" : ""} mục`,
  capped: (n: number) =>
    `Chỉ hiện ${n.toLocaleString("vi-VN")} mục mới nhất. Lọc theo mục để xem xa hơn.`,
  emptyTitle: "Nhật ký còn trống",
  emptyBody:
    "Các thay đổi như duyệt học sinh hay xuất bản bài sẽ ghi lại ở đây.",
  noMatchTitle: "Chưa có mục nào ở đây",
  noMatchBody: "Mục này chưa có thay đổi nào. Chọn mục khác để xem.",
  clear: "Xem tất cả",
  action: (action: string) =>
    Object.hasOwn(actions, action) ? (actions[action] ?? action) : action,
  target: (type: string | null) =>
    type && Object.hasOwn(targets, type) ? (targets[type] ?? type) : type,
  openTarget: (label: string) => `Mở: ${label}`,
  deletedActor: "Tài khoản đã xóa",
  roleAdmin: "Quản trị",
  roleStudent: "Học sinh",
  yes: "có",
  no: "không",
} as const;
