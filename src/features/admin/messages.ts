/** `/admin` dashboard (S6-06). */
export const overviewCopy = {
  title: "Tổng quan",
  lead: "Hoạt động trên các bài của bạn, cập nhật tối đa 5 phút một lần.",
  greetingLead: (name: string) =>
    `Chào ${name}. Hoạt động trên các bài của bạn, cập nhật tối đa 5 phút một lần.`,
  heroSetupLabel: "Bắt đầu",
  heroSetup: "Tạo lớp đầu tiên của bạn",
  heroSetupBody:
    "Tạo lớp, thêm học sinh bằng số điện thoại, rồi giao bài cho lớp.",
  heroSetupCta: "Tạo lớp",
  heroTodayLabel: "Hôm nay",
  heroToday: (n: number) =>
    n
      ? `${n.toLocaleString("vi-VN")} lượt nộp bài hôm nay`
      : "Chưa có lượt nộp hôm nay",
  heroTodayBody: "Bài nộp trên các bài của bạn, ở mọi lớp.",
  heroTodayCta: "Xem kết quả",
  classes: "Lớp học",
  classesLink: (n: number, students: number) =>
    `${n} lớp, ${students} học sinh: mở danh sách lớp`,
  classesStudents: (n: number) => `${n} học sinh`,
  active: "Học sinh hoạt động (7 ngày)",
  today: "Lượt nộp hôm nay",
  week: "Lượt nộp (7 ngày)",
  ai: "AI hôm nay",
  aiOff: "Đang tắt",
  /** Generations counted today against the global budget (S7-01). */
  aiUsage: (used: number, budget: number) => `${used}/${budget}`,
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
