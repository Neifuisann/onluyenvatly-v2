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
  guardNotice:
    "Bài có giám sát: hệ thống ghi lại khi bạn rời khỏi trang làm bài, và không cho sao chép đề.",
  keyboardHint:
    "Phím tắt: 1–4 chọn đáp án, ←/→ chuyển câu, F đánh dấu, Enter câu sau.",
} as const;

/** `SaveIndicator` and the offline banner (07 §4, §5.2). */
export const saveCopy = {
  saved: "Đã lưu",
  local: "Đã lưu trên máy",
  saving: "Đang lưu…",
  offline: "Mất kết nối – đã lưu trên máy",
  closed: "Bài làm đã đóng",
  signedOut: "Phiên đăng nhập đã hết hạn",
  offlineBanner:
    "Mất kết nối – bài làm vẫn được lưu trên máy. Hệ thống sẽ tự gửi lại khi có mạng.",
  signedOutBanner:
    "Phiên đăng nhập đã hết hạn. Bài làm vẫn được lưu trên máy; hãy đăng nhập lại để gửi.",
  signIn: "Đăng nhập lại",
} as const;

/** `/attempts/[id]/result` (07 §5.4). */
export const resultCopy = {
  title: "Kết quả bài làm",
  outOf: "/ 10",
  scoreLabel: "Điểm",
  correct: (n: number, total: number) => `${n}/${total} câu đúng`,
  points: (score: string, max: string) => `${score}/${max} điểm`,
  time: (clock: string) => `Thời gian làm bài ${clock}`,
  submittedAt: (when: string) => `Nộp lúc ${when}`,
  backToLesson: "Về trang bài tập",
  retake: "Làm lại",
  review: "Xem lại bài",
  toCatalog: "Danh sách bài tập",
  good: "Làm tốt lắm!",
  keepGoing: "Cố lên, ôn lại rồi làm tiếp nhé!",
  revealLater: (when: string) => `Đáp án sẽ hiển thị sau ${when}.`,
  revealNever: "Giáo viên không công bố đáp án của bài này.",
  guardEvents: (n: number) => `Sự kiện giám sát (${n})`,
  guardHelp:
    "t = số giây từ lúc bắt đầu; blur: rời cửa sổ, hidden: ẩn tab/chuyển ứng dụng, fs-exit: thoát toàn màn hình, copy: thử sao chép.",
} as const;

/** Per-question review on the result page (07 §4 `ReviewItem`). */
export const reviewCopy = {
  heading: "Xem lại từng câu",
  filterLabel: "Lọc câu hỏi",
  all: (n: number) => `Tất cả ${n}`,
  wrong: (n: number) => `Sai ${n}`,
  right: (n: number) => `Đúng ${n}`,
  emptyWrong: "Không có câu sai nào. Làm tốt lắm!",
  emptyRight: "Chưa có câu nào đúng hoàn toàn. Xem lại các câu bên dưới nhé.",
  outcome: {
    correct: "Đúng",
    partial: "Đúng một phần",
    wrong: "Sai",
    blank: "Chưa làm",
  },
  itemHeading: (i: number, type: string) => `Câu ${i} · ${type}`,
  marks: (earned: string, max: string) => `${earned}/${max}đ`,
  yourChoice: "Bạn chọn",
  correctAnswer: "Đáp án",
  noAnswer: "Bạn chưa trả lời",
  youAnswered: "Bạn trả lời",
  statement: "Mệnh đề",
  you: "Bạn chọn",
  key: "Đáp án",
  none: "–",
  explanation: "Giải thích của giáo viên",
} as const;

/** `TestTimer` (07 §4) and auto-submit. */
export const timerCopy = {
  label: "Thời gian còn lại",
  left: (minutes: number) => `Còn ${minutes} phút làm bài.`,
  timeUp: "Hết giờ. Hệ thống đang nộp bài của bạn…",
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
  retrying: "Mất kết nối. Bài làm đã được lưu trên máy, đang thử nộp lại…",
  failed: "Chưa nộp được bài. Bạn thử lại nhé.",
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
  startsAt: (when: string) => `Giờ bắt đầu: ${when}`,
  answersAt: (when: string) => `Công bố đáp án và đóng bài: ${when}`,
  notOpen: (when: string) => `Bài chưa mở. Bạn có thể bắt đầu từ ${when}.`,
  closed: "Bài đã đóng vì đáp án đã được công bố.",
  extra: (n: number) => `Giáo viên cho bạn thêm ${n} lượt làm bài.`,
  history: "Các lần làm của bạn",
  historyEmpty: "Bạn chưa làm bài này lần nào.",
  score: (score: string) => `${score} điểm`,
  viewResult: "Xem kết quả",
  loading: "Đang tải lượt làm bài",
} as const;
