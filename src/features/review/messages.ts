import type { QuestionType } from "@/features/lessons/schema";

/** `/review`: the mistakes bank and personalized practice (S7-06). */
export const reviewCopy = {
  title: "Ôn tập",
  lead: "Những câu bạn làm chưa đúng. Làm đúng 2 lần liên tiếp thì câu đó được tính là đã ôn xong.",
  total: (n: number) => `${n} câu cần ôn`,
  empty: "Chưa có câu nào cần ôn.",
  emptyHint:
    "Câu bạn làm sai, đúng một phần hoặc bỏ trống trong bài kiểm tra sẽ hiện ở đây.",
  browse: "Xem danh sách bài",
  emptyFiltered: "Không có câu nào khớp bộ lọc.",
  clearFilters: "Xóa bộ lọc",
  filtersLabel: "Lọc câu cần ôn",
  chapter: "Chương",
  allChapters: "Tất cả các chương",
  type: "Loại câu",
  allTypes: "Tất cả",
  types: {
    mcq: "Trắc nghiệm",
    tf: "Đúng/Sai",
    short: "Trả lời ngắn",
  } satisfies Record<QuestionType, string>,
  withCount: (label: string, n: number) => `${label} (${n})`,
  apply: "Lọc",
  // Start panel
  startTitle: "Tạo bài ôn tập",
  startLead:
    "Lấy những câu bạn sai nhiều nhất theo bộ lọc đang chọn. Mỗi câu có nút “Kiểm tra” để xem ngay đáp án; bài ôn tập không tính vào xếp hạng.",
  size: "Số câu",
  sizeOption: (n: number) => `${n} câu`,
  available: (n: number) =>
    n > 0
      ? `Có ${n} câu có thể ôn theo bộ lọc này.`
      : "Chưa có câu nào có thể ôn theo bộ lọc này.",
  hiddenNote: (n: number) =>
    `${n} câu thuộc bài chưa công bố đáp án nên chưa có trong bài ôn tập.`,
  start: "Bắt đầu ôn tập",
  starting: "Đang tạo bài…",
  failed: "Chưa tạo được bài ôn tập. Kiểm tra mạng rồi thử lại.",
  nothing: "Không có câu nào để ôn theo bộ lọc này.",
  // Open practice
  continueTitle: "Bạn đang có một bài ôn tập chưa nộp",
  continueLead: (n: number) => `${n} câu. Nộp bài này để tạo bài ôn tập mới.`,
  continue: "Làm tiếp",
  // List
  listTitle: "Câu cần ôn",
  fromLesson: (title: string) => `Bài: ${title}`,
  wrongCount: (n: number) => `Sai ${n} lần`,
  lastSeen: (when: string) => `Lần gần nhất: ${when}`,
  hidden: "Chưa công bố đáp án",
  openAttempt: "Xem bài làm",
  missing: "Câu hỏi này không còn trong bài.",
  more: "Xem thêm",
  errorTitle: "Không tải được trang ôn tập",
  retry: "Thử lại",
  loading: "Đang tải câu cần ôn",
  // Practice runner and result
  practiceTitle: "Ôn tập cá nhân",
} as const;
