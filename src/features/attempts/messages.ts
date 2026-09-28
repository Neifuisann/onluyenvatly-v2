/** Vietnamese copy for taking tests (07 §5.2, §6). */

/** The start/continue panel on a lesson overview. */
export const startCopy = {
  heading: "Làm bài",
  start: "Bắt đầu làm bài",
  starting: "Đang chuẩn bị đề…",
  continue: "Tiếp tục làm bài",
  inProgress: "Bạn đang làm dở bài này.",
  used: (used: number, max: number) => `Đã dùng ${used}/${max} lượt làm bài.`,
  noneLeft: "Bạn đã dùng hết lượt làm bài này.",
  history: "Các lần làm của bạn",
  historyEmpty: "Bạn chưa làm bài này lần nào.",
  score: (score: string) => `${score} điểm`,
  viewResult: "Xem kết quả",
  loading: "Đang tải lượt làm bài",
} as const;
