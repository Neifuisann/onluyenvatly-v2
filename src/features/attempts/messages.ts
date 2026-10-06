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
  /** The heading's parts, styled separately; together they read as `questionHeading`. */
  points: (points: number) => `${formatScore(points)}đ`,
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
  errorTitle: "Không tải được bài làm",
  errorBody:
    "Hệ thống đang gặp sự cố. Bài làm vẫn được lưu trên máy, hãy thử lại sau giây lát.",
  retry: "Thử lại",
} as const;

/** Asked before leaving the runner: Back, the X, reload (07 §5.2). */
export const leaveCopy = {
  title: "Thoát bài làm?",
  practiceTitle: "Thoát bài ôn tập?",
  timed:
    "Bài làm đã được lưu, nhưng thời gian vẫn chạy khi bạn rời đi. Hết giờ, hệ thống tự nộp bài với các câu đã lưu. Bạn có thể vào lại bài để làm tiếp trước khi hết giờ.",
  untimed:
    "Bài làm đã được lưu. Bạn có thể vào lại bài để làm tiếp bất cứ lúc nào.",
  stay: "Ở lại làm bài",
  leave: "Thoát",
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
  loading: "Đang tải kết quả bài làm",
  errorTitle: "Không tải được kết quả bài làm",
  outOf: "/ 10",
  scoreLabel: "Điểm",
  correct: (n: number, total: number) => `${n}/${total} câu đúng`,
  points: (score: string, max: string) => `${score}/${max} điểm`,
  time: (clock: string) => `Thời gian làm bài ${clock}`,
  submittedAt: (when: string) => `Nộp lúc ${when}`,
  backToLesson: "Về trang bài tập",
  retake: "Làm lại",
  backToReview: "Về trang ôn tập",
  review: "Xem lại bài",
  toCatalog: "Danh sách bài tập",
  good: "Làm tốt lắm!",
  okay: "Khá lắm! Ôn thêm một chút là giỏi rồi.",
  keepGoing: "Cố lên, ôn lại rồi làm tiếp nhé!",
  revealLater: (when: string) => `Đáp án sẽ hiển thị sau ${when}.`,
  revealNever: "Giáo viên không công bố đáp án của bài này.",
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
  timeRunning: (when: string) =>
    `Thời gian vẫn đang chạy, hết giờ lúc ${when}. Hết giờ, bài sẽ tự nộp với các câu đã lưu.`,
  timeUp: "Đã hết giờ làm bài. Bài được nộp với các câu đã lưu.",
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

/** The editor's "Xem trước" tab: the runner in preview mode (S5-06). */
export const previewCopy = {
  badge: "Xem trước · không lưu bài làm",
  key: "Đáp án",
  keyTf: (parts: string) => `Đáp án: ${parts}`,
  tolerance: (t: string) => `sai số ± ${t}`,
  explanation: "Giải thích",
  outcome: {
    correct: "Trả lời đúng",
    partial: (earned: string, max: string) =>
      `Đúng một phần (${earned}/${max}đ)`,
    wrong: "Trả lời sai",
    blank: "Chưa trả lời",
  },
  resultTitle: "Kết quả xem trước",
  resultScore: (score: string, max: string) => `${score}/${max} điểm`,
  resultScore10: (s: string) => `Thang 10: ${s}`,
  resultCounts: (correct: number, total: number) =>
    `${correct}/${total} câu đúng`,
  resultNote: "Bài xem trước không được lưu và không tính điểm xếp hạng.",
  restart: "Làm lại",
  close: "Đóng",
  timeLimit: (min: number) => `Thời gian làm bài: ${min} phút`,
} as const;

/** Exam-guard timeline on the result page, admins only (S6-04). */
export const guardCopy = {
  heading: (n: number) => `Sự kiện giám sát (${n})`,
  lead: "Thời điểm tính từ lúc bắt đầu làm bài. Chỉ để giáo viên tham khảo, không tự trừ điểm.",
  empty: "Không có sự kiện nào trong lúc làm bài.",
  listLabel: "Dòng thời gian giám sát",
  kinds: {
    blur: "Rời cửa sổ làm bài",
    hidden: "Ẩn tab hoặc chuyển ứng dụng",
    "fs-exit": "Thoát toàn màn hình",
    copy: "Thử sao chép đề",
    other: "Sự kiện khác",
  },
} as const;

/** "Xóa bài làm" on the result page, admins only (S6-04). */
export const deleteAttemptCopy = {
  section: "Quản trị bài làm",
  button: "Xóa bài làm",
  title: "Xóa bài làm này?",
  body: "Bài làm bị xóa vĩnh viễn. Nếu bài tính điểm xếp hạng, điểm của học sinh được tính lại như chưa từng làm bài này. Lỗi sai đã ghi trong mục Ôn tập được giữ nguyên.",
  confirm: "Xóa vĩnh viễn",
  cancel: "Hủy",
  close: "Đóng",
  deleting: "Đang xóa…",
} as const;

/** `/admin/results` (S6-04). */
export const resultsCopy = {
  title: "Kết quả",
  lead: "Mọi bài đã nộp của học sinh, mới nhất trước.",
  loading: "Đang tải kết quả",
  errorTitle: "Không tải được kết quả",
  filtersLabel: "Lọc kết quả",
  lesson: "Bài tập",
  allLessons: "Tất cả bài",
  deletedLesson: (title: string) => `${title} (đã xóa)`,
  student: "Tên học sinh",
  studentPlaceholder: "Tìm theo tên",
  from: "Từ ngày",
  to: "Đến ngày",
  apply: "Lọc",
  clear: "Xóa bộ lọc",
  export: "Xuất CSV",
  exportHint: "Tệp CSV theo bộ lọc hiện tại, tối đa 10.000 bài.",
  listLabel: "Danh sách bài làm",
  shown: (n: number, more: boolean) =>
    more ? `Đang hiển thị ${n} bài mới nhất` : `${n} bài`,
  loadMore: "Xem thêm",
  limitReached: "Đã hiển thị tối đa. Hãy lọc thêm hoặc xuất CSV để xem hết.",
  emptyTitle: "Chưa có bài nộp nào",
  emptyBody: "Bài học sinh nộp sẽ xuất hiện ở đây.",
  noMatchTitle: "Không có bài làm phù hợp",
  noMatchBody: "Thử bài khác, tên khác hoặc khoảng ngày rộng hơn.",
  review: "Ôn tập cá nhân",
  class: (className: string | null, grade: number | null) =>
    [className, grade ? `Khối ${grade}` : null].filter(Boolean).join(" · "),
  score: "Điểm",
  time: (clock: string) => `Làm trong ${clock}`,
  submitted: (when: string) => `Nộp ${when}`,
  guardBadge: (n: number) => `${n} cảnh báo`,
  view: "Xem bài",
  viewLabel: (name: string, when: string) =>
    `Xem bài làm của ${name}, nộp ${when}`,
} as const;

/** Practice mode in the runner (S7-06): "Kiểm tra" under each question. */
export const practiceCopy = {
  badge: "Ôn tập · không tính xếp hạng",
  check: "Kiểm tra",
  checking: "Đang kiểm tra…",
  answerFirst: "Trả lời rồi bấm Kiểm tra để xem đáp án.",
  failed: "Chưa kiểm tra được. Thử lại.",
  key: (k: string) => `Đáp án: ${k}`,
  keyTf: (parts: string) => `Đáp án: ${parts}`,
  true: "Đúng",
  false: "Sai",
  outcome: {
    correct: "Chính xác!",
    partial: (earned: string, max: string) =>
      `Đúng một phần (${earned}/${max}đ)`,
    wrong: "Chưa đúng",
    blank: "Chưa trả lời",
  },
  later: "Lời giải chi tiết có ở trang kết quả sau khi nộp bài.",
  exit: "Thoát bài ôn tập (bài làm đã được lưu)",
} as const;
