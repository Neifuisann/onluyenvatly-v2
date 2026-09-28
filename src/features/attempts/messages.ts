/** Vietnamese copy for taking tests (07 §5.2, §6). */

import { formatScore } from "@/lib/dates";

export const questionTypeNames = {
  mcq: "Trắc nghiệm",
  tf: "Đúng/Sai",
  short: "Trả lời ngắn",
} as const;

/** The test runner (07 §5.2). */
export const runnerCopy = {
  pageTitle: "Làm bài",
  exit: "Thoát bài làm (bài làm đã được lưu)",
  position: (i: number, n: number) => `Câu ${i}/${n}`,
  openNavigator: "Mở danh sách câu hỏi",
  navigatorTitle: "Danh sách câu hỏi",
  close: "Đóng",
  progress: (answered: number, total: number) =>
    `Đã làm ${answered}/${total} câu`,
  questionLabel: (i: number) => `Câu ${i}`,
  questionHeading: (i: number, type: string, points: number) =>
    `Câu ${i} · ${type} · ${formatScore(points)}đ`,
  flag: "Đánh dấu",
  unflag: "Bỏ đánh dấu",
  flagged: "Đã đánh dấu",
  prev: "Trước",
  next: "Sau",
  showAll: "Xem tất cả",
  showOne: "Xem từng câu",
  submit: "Nộp bài",
  legendAnswered: "Đã làm",
  legendUnanswered: "Chưa làm",
  legendFlagged: "Đánh dấu",
  navItem: (i: number, answered: boolean, flagged: boolean) =>
    [
      `Câu ${i}`,
      answered ? "đã làm" : "chưa làm",
      ...(flagged ? ["đã đánh dấu"] : []),
    ].join(", "),
  optionsLabel: (i: number) => `Các phương án của câu ${i}`,
  statementLabel: (letter: string) => `Mệnh đề ${letter}`,
  true: "Đúng",
  false: "Sai",
  trueShort: "Đ",
  falseShort: "S",
  statementChoice: (letter: string, value: string) => `${letter}) ${value}`,
  shortLabel: "Câu trả lời của bạn",
  shortHint: "Dùng dấu phẩy hoặc dấu chấm cho phần thập phân.",
  shortReadAs: (value: string) => `Hệ thống ghi nhận: ${value}`,
  shortPlaceholder: "Nhập đáp số",
  keyboardHint:
    "Phím tắt: 1–4 chọn đáp án, ←/→ chuyển câu, F đánh dấu, Enter câu sau.",
} as const;

/** `SubmitDialog` (07 §4). */
export const submitCopy = {
  title: "Nộp bài?",
  summary: (answered: number, total: number) =>
    `Bạn đã làm ${answered}/${total} câu.`,
  unanswered: "Câu chưa làm:",
  flagged: "Câu đã đánh dấu:",
  allDone: "Bạn đã trả lời tất cả các câu.",
  goTo: (i: number) => `Đến câu ${i}`,
  keepGoing: "Làm tiếp",
  confirm: "Nộp bài",
  submitting: "Đang nộp bài…",
} as const;

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
