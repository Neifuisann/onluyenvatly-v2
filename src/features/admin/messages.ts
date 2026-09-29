/** `/admin` dashboard (S6-06). */
export const overviewCopy = {
  title: "Tổng quan",
  lead: "Hoạt động của học sinh, cập nhật tối đa 5 phút một lần.",
  pending: "Chờ duyệt",
  pendingLink: (n: number) => `Chờ duyệt: ${n} học sinh, mở hàng đợi`,
  active: "Học sinh hoạt động (7 ngày)",
  today: "Lượt nộp hôm nay",
  week: "Lượt nộp (7 ngày)",
  ai: "AI hôm nay",
  aiOff: "Chưa bật",
  chartTitle: "Lượt nộp bài 30 ngày qua",
  chartSummary: (total: number, max: number, maxDay: string | null) =>
    maxDay
      ? `Tổng ${total.toLocaleString("vi-VN")} lượt; nhiều nhất ${max} lượt ngày ${maxDay}.`
      : "Chưa có lượt nộp nào trong 30 ngày qua.",
  bar: (day: string, n: number) => `${day}: ${n} lượt`,
  chartStart: (day: string) => day,
  chartEnd: "Hôm nay",
  hardestTitle: "Câu khó nhất tuần này",
  hardestLead:
    "Tỉ lệ đạt điểm tối đa thấp nhất, trong các câu có ít nhất 5 lượt làm (7 ngày).",
  hardestEmpty:
    "Chưa đủ dữ liệu: chưa câu nào có từ 5 lượt làm trong 7 ngày qua.",
  question: (position: number | null) =>
    position === null ? "Câu đã bỏ khỏi bài" : `Câu ${position}`,
  hardestRate: (rate: string, full: number, answers: number) =>
    `Đạt tối đa ${rate} (${full}/${answers})`,
  errorTitle: "Không tải được trang tổng quan",
  loading: "Đang tải trang tổng quan",
} as const;
