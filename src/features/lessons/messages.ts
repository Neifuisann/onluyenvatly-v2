/**
 * Vietnamese copy for the lessons feature. No imports: parser code that uses
 * it also runs in Node scripts.
 */

/** Text-format parser issues (04 §3.3), shown in the editor's validation panel. */
export const parseIssueMessages = {
  TEXT_BEFORE_FIRST_QUESTION: "Nội dung trước “Câu 1:” sẽ bị bỏ qua.",
  EMPTY_STEM: "Câu hỏi chưa có nội dung.",
  NO_ANSWER_FORMAT:
    "Chưa có phương án (A. B. …), mệnh đề (a) b) …) hoặc dòng “Answer:”.",
  MIXED_TYPES:
    "Không thể trộn phương án A–F, mệnh đề a)–h) và “Answer:” trong cùng một câu.",
  OPTION_ORDER: (expected: string) =>
    `Phương án không đúng thứ tự, cần “${expected}”.`,
  MCQ_NO_ANSWER: "Chưa đánh dấu đáp án đúng bằng dấu *.",
  MCQ_MULTIPLE_ANSWERS: "Chỉ được đánh dấu * cho một phương án.",
  MCQ_TOO_FEW_OPTIONS: "Câu trắc nghiệm cần ít nhất 2 phương án.",
  TF_TOO_FEW_STATEMENTS: "Câu đúng/sai cần ít nhất 2 mệnh đề.",
  SHORT_EMPTY_ANSWER: "Dòng “Answer:” chưa có đáp án.",
  DUPLICATE_ANSWER: "Câu này đã có dòng “Answer:”.",
  INVALID_TOLERANCE: "Sai số sau dấu ± phải là một số không âm.",
  DUPLICATE_POINTS: "Câu này đã có điểm; dùng giá trị sau cùng.",
  INVALID_POINTS: "Điểm phải là một số từ 0 đến 100.",
  DUPLICATE_IMAGE: "Mỗi câu hỏi hoặc phương án chỉ gắn được một hình.",
  IMAGE_NOT_ALLOWED:
    "Mệnh đề đúng/sai không gắn được hình; hãy đặt hình ở đề bài.",
  INVALID: (detail: string) => `Câu hỏi không hợp lệ: ${detail}`,
} as const;

export const overviewCopy = {
  title: "Thông tin bài tập",
  back: "Về lớp học",
  structure: "Cấu trúc đề",
  rules: "Trước khi làm bài",
  duration: "Thời gian",
  questionsLabel: "Số câu",
  noLimitShort: "Tự do",
  mode: "Hình thức",
  modeRated: "Tính hạng",
  modePractice: "Luyện tập",
  attempts: "Số lượt làm tối đa",
  unlimited: "Không giới hạn",
  rating: "Tính điểm xếp hạng",
  practice: "Không tính điểm xếp hạng",
  guard: "Chế độ thi: ghi nhận khi rời khỏi bài làm.",
  unpublished: "Bài tập chưa xuất bản",
  notFoundTitle: "Không tìm thấy bài tập",
  notFoundBody:
    "Bài tập không tồn tại hoặc chưa được xuất bản. Bạn chọn bài khác nhé.",
  errorTitle: "Không tải được thông tin bài tập",
} as const;

/** Duration for cards and the overview: "50 phút", "1 giờ 30 phút". */
export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} phút`;
  return m === 0 ? `${h} giờ` : `${h} giờ ${m} phút`;
}

export const questionTypeLabels = {
  mcq: "Trắc nghiệm",
  tf: "Đúng/Sai",
  short: "Trả lời ngắn",
} as const;

/** `/lessons` catalog (07 §5.5). */
export const catalogCopy = {
  loading: "Đang tải bài tập",
  title: "Bài tập",
  lead: "Chọn một đề để luyện. Tìm theo tên, chương hoặc thẻ.",
  searchLabel: "Tìm bài tập",
  searchPlaceholder: "Tìm bài tập, ví dụ: dao động",
  searchSubmit: "Tìm",
  gradeGroup: "Lọc theo khối",
  gradeAll: "Tất cả",
  grade: (g: number) => `Lớp ${g}`,
  filters: "Bộ lọc",
  chapter: "Chương",
  chapterAll: "Tất cả chương",
  tag: "Thẻ",
  tagAll: "Tất cả thẻ",
  sort: "Sắp xếp",
  sorts: {
    order: "Theo thứ tự của giáo viên",
    newest: "Mới nhất",
    popular: "Nhiều lượt làm",
    title: "Theo tên (A–Z)",
  },
  apply: "Áp dụng",
  clear: "Xóa bộ lọc",
  showing: (shown: number, total: number) =>
    `Đang hiển thị ${shown}/${total} bài`,
  loadMore: "Xem thêm",
  questions: (n: number) => `${n} câu`,
  noTimeLimit: "Không giới hạn thời gian",
  emptyTitle: "Chưa có bài tập nào",
  emptyBody: "Giáo viên sẽ sớm đăng bài tập. Bạn quay lại sau nhé.",
  noMatchTitle: "Không tìm thấy bài tập phù hợp",
  noMatchBody: "Thử từ khóa khác hoặc bỏ bớt bộ lọc.",
  errorTitle: "Không tải được danh sách bài tập",
  errorBody: "Có thể do mất kết nối. Bạn thử tải lại nhé.",
  retry: "Thử lại",
} as const;

/** `/admin/lessons` (S5-01). */
export const adminLessonsCopy = {
  title: "Bài tập",
  lead: "Sắp xếp, nhân bản, lưu trữ hoặc xóa bài tập.",
  searchLabel: "Tìm bài tập",
  searchPlaceholder: "Tìm theo tên, mô tả hoặc thẻ",
  searchSubmit: "Tìm",
  statusGroup: "Lọc theo trạng thái",
  statusAll: "Tất cả",
  statuses: {
    draft: "Nháp",
    published: "Đã xuất bản",
    archived: "Lưu trữ",
  },
  hasDraft: "Có bản nháp",
  count: (n: number) => `${n} bài`,
  countRange: (from: number, to: number, total: number) =>
    `Bài ${from}–${to} trong ${total}`,
  columns: {
    order: "Thứ tự",
    title: "Tên bài",
    status: "Trạng thái",
    grade: "Khối",
    questions: "Số câu",
    attempts: "Lượt làm",
    created: "Ngày tạo",
    updated: "Cập nhật",
    actions: "Thao tác",
  },
  grade: (g: number) => `Lớp ${g}`,
  questions: (n: number) => `${n} câu`,
  attempts: (n: number) => `${n} lượt`,
  dragHandle: (title: string) =>
    `Kéo để sắp xếp “${title}”. Dùng phím mũi tên lên/xuống để di chuyển.`,
  moved: (title: string, position: number, total: number) =>
    `Đã chuyển “${title}” tới vị trí ${position}/${total}.`,
  reorderHint:
    "Bỏ tìm kiếm và bộ lọc trạng thái để kéo thả sắp xếp thứ tự bài.",
  reorderSaved: "Đã lưu thứ tự mới.",
  duplicate: "Nhân bản",
  duplicated: "Đã tạo bản sao (nháp).",
  archive: "Lưu trữ",
  archived: "Đã lưu trữ bài. Học sinh không còn thấy bài này.",
  restore: "Khôi phục",
  restored: "Đã khôi phục bài về trạng thái nháp.",
  delete: "Xóa",
  deleteTitle: "Xóa bài tập?",
  deleteHard: (title: string) =>
    `“${title}” chưa có lượt làm nào và sẽ bị xóa vĩnh viễn cùng mọi phiên bản.`,
  deleteSoft: (title: string, attempts: number) =>
    `“${title}” đã có ${attempts} lượt làm. Bài sẽ được ẩn khỏi danh sách và học sinh, nhưng kết quả cũ vẫn được giữ.`,
  deleteConfirm: "Xóa bài",
  deletedHard: "Đã xóa bài.",
  deletedSoft: "Đã ẩn bài. Kết quả cũ vẫn được giữ.",
  cancel: "Hủy",
  close: "Đóng",
  view: "Xem bài",
  staleList:
    "Danh sách bài đã thay đổi ở nơi khác. Tải lại trang rồi sắp xếp lại.",
  emptyTitle: "Chưa có bài tập nào",
  emptyBody: "Tạo bài mới hoặc chạy công cụ chuyển dữ liệu từ bản cũ.",
  noMatchTitle: "Không có bài phù hợp",
  noMatchBody: "Thử từ khóa khác hoặc bỏ bộ lọc trạng thái.",
  clear: "Xóa bộ lọc",
  errorTitle: "Không tải được danh sách bài tập",
  loading: "Đang tải danh sách bài tập",
  create: "Tạo bài mới",
  newTitle: "Bài tập mới",
  edit: "Sửa",
  hasDraftShort: "Có nháp",
  created: "Tạo",
  sortGroup: "Sắp xếp danh sách",
  sorts: {
    updated: "Mới sửa",
    created: "Mới tạo",
    title: "Tên A–Z",
    manual: "Thứ tự riêng",
  },
  sortBy: (column: string, dir: "asc" | "desc" | null) =>
    dir
      ? `Sắp theo ${column.toLowerCase()}, đang ${dir === "asc" ? "tăng dần" : "giảm dần"}. Bấm để đảo chiều.`
      : `Sắp theo ${column.toLowerCase()}`,
  manualLink: "Sắp theo thứ tự riêng (kéo thả)",
  manualHint: "Kéo biểu tượng ⋮⋮ để đổi thứ tự bài học sinh thấy.",
} as const;

/** `/admin/lessons/create` (S5-07): how a new lesson starts. */
export const createCopy = {
  title: "Tạo bài mới",
  lead: "Chọn cách tạo bài. Bài mới luôn là bản nháp: học sinh chưa thấy cho tới khi bạn xuất bản.",
  back: "Danh sách bài",
  backToChoices: "Chọn cách khác",
  choicesLabel: "Cách tạo bài",
  manual: {
    title: "Tự soạn",
    body: "Mở trình soạn với một bài trống. Gõ hoặc dán đề theo định dạng văn bản, xem trước ngay bên cạnh.",
    action: "Mở trình soạn",
  },
  file: {
    title: "Nhập từ file bằng AI",
    body: "Tải lên đề PDF, Word (.docx) hoặc ảnh chụp. AI chuyển sang định dạng soạn bài để bạn kiểm tra và sửa.",
    action: "Chọn file đề",
    badge: "AI",
  },
  compose: {
    title: "Tạo từ bài có sẵn",
    body: "Chọn một hay nhiều bài, đặt số câu mỗi loại. Hệ thống bốc ngẫu nhiên thành một đề ôn tập để bạn xem lại.",
    action: "Chọn bài nguồn",
  },
  aiOff: "AI đang tắt",
  fileTitle: "Nhập đề từ file bằng AI",
  composeTitle: "Tạo đề từ bài có sẵn",
} as const;

/** "Tạo từ bài có sẵn" (S5-07). */
export const composeCopy = {
  sourcesTitle: "1. Chọn bài nguồn",
  sourcesHint:
    "Chỉ tính câu hợp lệ của bản đã xuất bản (bài chưa xuất bản: bản nháp).",
  search: "Lọc bài nguồn",
  searchPlaceholder: "Lọc theo tên bài",
  gradeGroup: "Lọc theo khối",
  gradeAll: "Mọi khối",
  grade: (g: number) => `Lớp ${g}`,
  selectShown: "Chọn tất cả đang hiện",
  clear: "Bỏ chọn hết",
  selected: (n: number) => `Đã chọn ${n} bài`,
  noSources: "Chưa có bài nào có câu hỏi để lấy.",
  noMatch: "Không có bài nào khớp bộ lọc.",
  sourceCounts: (c: { mcq: number; tf: number; short: number }) =>
    `${c.mcq} TN · ${c.tf} Đ/S · ${c.short} TLN`,
  countsTitle: "2. Số câu mỗi loại",
  countsHint: "Câu trùng nhau giữa các bài chỉ được lấy một lần.",
  available: (n: number) => `có ${n}`,
  max: "Tối đa",
  total: "Tổng số câu",
  titleLabel: "3. Tên bài",
  titleOne: (title: string) => `Ôn tập: ${title}`.slice(0, 200),
  titleMany: (n: number) => `Ôn tập tổng hợp (${n} bài)`,
  submit: "Bốc câu và tạo bài nháp",
  submitting: "Đang tạo bài…",
  pickFirst: "Chọn ít nhất một bài nguồn.",
  noneWanted: "Đặt số câu cần lấy (ít nhất 1 câu).",
  tooMany: (max: number) => `Một bài có tối đa ${max} câu.`,
  notEnough: (type: "mcq" | "tf" | "short", want: number, have: number) =>
    `Cần ${want} câu ${questionTypeLabels[type].toLowerCase()} nhưng các bài đã chọn chỉ có ${have} câu khác nhau.`,
  sourcesGone: "Có bài nguồn vừa bị xóa. Tải lại trang rồi chọn lại.",
} as const;

/** `/admin/lessons/[id]/edit` (S5-02, 07 §5.6). */
export const editorCopy = {
  back: "Danh sách bài",
  stepsLabel: "Các bước soạn bài",
  steps: { content: "Soạn nội dung", settings: "Cài đặt & xuất bản" },
  stepNumber: (n: number) => `Bước ${n}`,
  continue: "Tiếp tục",
  continueHint: "Lưu nháp rồi sang phần cài đặt",
  backToContent: "Quay lại nội dung",
  tryOpen: "Làm thử",
  tryClose: "Quay lại soạn bài",
  tryTitle: "Làm thử như học sinh",
  saved: "Đã lưu",
  cardHint: "Bấm vào tiêu đề câu để tới dòng đó trong trình soạn thảo.",
  metaTitle: "Soạn bài",
  editorLabel: "Nội dung bài (định dạng văn bản)",
  editorLoading: "Đang tải trình soạn thảo…",
  paneLabel: "Chế độ xem",
  paneEdit: "Soạn thảo",
  panePreview: "Xem trước",
  previewTitle: "Xem trước",
  issuesTitle: "Kiểm tra",
  noIssues: "Không có lỗi.",
  issueCount: (errors: number, warnings: number) =>
    [errors && `${errors} lỗi`, warnings && `${warnings} cảnh báo`]
      .filter(Boolean)
      .join(", "),
  issueAt: (line: number, col: number) => `Dòng ${line}, cột ${col}`,
  error: "Lỗi",
  warning: "Cảnh báo",
  goToQuestion: (n: number) => `Tới dòng của câu ${n} trong trình soạn thảo`,
  questionHeading: (n: number, type: string, points: string) =>
    `Câu ${n} · ${type} · ${points}đ`,
  questionLabel: (n: number) => `Câu ${n}`,
  questionHasIssue: "có lỗi",
  correct: "Đáp án đúng",
  true: "Đúng",
  false: "Sai",
  shortAnswer: "Đáp án",
  tolerance: (t: string) => `sai số ± ${t}`,
  explanation: "Giải thích",
  emptyTitle: "Chưa có câu hỏi",
  emptyBody:
    "Dán nội dung bài theo định dạng “Câu 1: …” vào trình soạn thảo, phần xem trước sẽ hiện ở đây.",
  stats: (
    total: number,
    mcq: number,
    tf: number,
    short: number,
    points: string,
  ) => `Tổng: ${total} câu · ${mcq}/${tf}/${short} · ${points}đ`,
  statsTypes: "Trắc nghiệm / Đúng-Sai / Trả lời ngắn",
  perAttempt: (total: number, points: string | null) =>
    `Mỗi lượt làm: ${total} câu${points === null ? "" : ` · ${points}đ`}`,
  unsaved: "Chưa lưu",
  tryLead:
    "Làm thử như học sinh trên nội dung đang soạn (kể cả chưa lưu): bộ câu hỏi, thứ tự và điểm theo cài đặt. Có hiện đáp án; không lưu bài làm.",
  tryAgain: "Tạo lượt mới",
  tryHasErrors: (n: number) =>
    `Nội dung còn ${n} lỗi; các câu lỗi có thể hiển thị hoặc chấm chưa đúng.`,
  draftSource: "Đang sửa bản nháp",
  publishedSource: "Đang sửa từ bản đã xuất bản",
  notFoundTitle: "Không tìm thấy bài tập",
  notFoundBody: "Bài đã bị xóa hoặc đường dẫn không đúng.",
  loading: "Đang tải trình soạn bài",
  errorTitle: "Không mở được trình soạn bài",
  errorBody:
    "Có thể do mất kết nối. Bản nháp đã lưu vẫn còn nguyên, bạn thử tải lại nhé.",
  closeMessage: "Đóng thông báo",
} as const;

/** The editor's "Cài đặt" tab (S5-03). */
export const settingsCopy = {
  info: "Thông tin bài",
  title: "Tên bài",
  description: "Mô tả",
  descriptionHint: "Hiện ở trang giới thiệu bài. Không bắt buộc.",
  grade: "Khối",
  gradeNone: "Không chọn",
  gradeOption: (g: number) => `Lớp ${g}`,
  subject: "Môn học",
  chapter: "Chương",
  chapterHint: "Ví dụ: Dao động cơ.",
  tags: "Thẻ",
  tagsHint: "Cách nhau bằng dấu phẩy, ví dụ: giữa kì, ôn tập.",
  timing: "Thời gian và lượt làm",
  timeLimit: "Thời gian làm bài (phút)",
  timeLimitHint: "Để trống nếu không giới hạn.",
  maxAttempts: "Số lượt làm tối đa",
  maxAttemptsHint: "Để trống nếu không giới hạn.",
  startsAt: "Giờ mở bài",
  startsAtHint: "Giờ Việt Nam. Để trống nếu học sinh làm lúc nào cũng được.",
  questions: "Câu hỏi",
  shuffleQuestions: "Trộn thứ tự câu hỏi",
  shuffleQuestionsHint:
    "Trộn trong từng phần; thứ tự phần vẫn là trắc nghiệm → đúng/sai → trả lời ngắn.",
  shuffleOptions: "Trộn thứ tự phương án A–D",
  pool: "Bộ câu hỏi ngẫu nhiên",
  poolModes: {
    off: "Tắt: làm tất cả các câu",
    size: "Lấy ngẫu nhiên theo tổng số câu",
    byType: "Lấy ngẫu nhiên theo từng loại",
  },
  poolSize: "Số câu mỗi lượt",
  poolAvailable: (n: number) => `Bài hiện có ${n} câu.`,
  poolByTypeAvailable: (n: number) => `có ${n}`,
  scoring: "Tính điểm",
  pointsModes: {
    "per-question": "Theo điểm của từng câu ([x pts], mặc định 1 điểm)",
    "per-type-total": "Chia đều tổng điểm của từng loại",
  },
  pointsTotal: "Tổng điểm",
  pointsTotalHint: "Để trống để loại đó giữ điểm của từng câu.",
  tfScoring: "Chấm câu đúng/sai",
  tfScorings: {
    thpt2025: "Theo thang THPT 2025 (1 ý: 0,1 · 2 ý: 0,25 · 3 ý: 0,5 · 4 ý: 1)",
    proportional: "Theo tỉ lệ số ý đúng",
  },
  after: "Sau khi nộp bài",
  revealAnswers: "Công bố đáp án",
  reveals: {
    after_submit: "Ngay sau khi nộp",
    after_deadline: "Sau giờ làm bài chung (cần giờ mở bài và thời gian)",
    never: "Không công bố",
  },
  countsForRating: "Tính điểm xếp hạng",
  examGuard: "Chế độ thi: chặn sao chép, ghi nhận khi rời bài",
  types: { mcq: "Trắc nghiệm", tf: "Đúng/Sai", short: "Trả lời ngắn" },
  liveNote:
    "Cài đặt có hiệu lực ngay khi lưu, kể cả với bài đã xuất bản. Bài đang làm dở giữ nguyên số câu và điểm đã chia.",
  save: "Lưu cài đặt",
  saving: "Đang lưu…",
  saved: "Đã lưu cài đặt.",
  invalid: "Cài đặt chưa hợp lệ. Sửa các ô được đánh dấu rồi lưu lại.",
  errors: {
    titleRequired: "Nhập tên bài.",
    titleTooLong: "Tên bài tối đa 200 ký tự.",
    descriptionTooLong: "Mô tả tối đa 2.000 ký tự.",
    chapterTooLong: "Tên chương tối đa 100 ký tự.",
    tags: "Tối đa 20 thẻ, mỗi thẻ tối đa 50 ký tự.",
    timeLimit: "Thời gian làm bài từ 1 đến 360 phút.",
    maxAttempts: "Số lượt làm là số nguyên từ 1 đến 100.",
    startsAt: "Giờ mở bài không hợp lệ.",
    poolSize: "Số câu mỗi lượt là số nguyên từ 1 đến 200.",
    poolSizeTooBig: (n: number) =>
      `Bài chỉ có ${n} câu, không lấy được nhiều hơn.`,
    poolCount: "Nhập số nguyên từ 0.",
    poolCountTooBig: (n: number) => `Loại này chỉ có ${n} câu.`,
    poolEmpty: "Nhập số câu cho ít nhất một loại, hoặc tắt bộ câu hỏi.",
    points: "Tổng điểm từ 0 đến 100, tối đa 2 chữ số thập phân.",
    pointsEmpty:
      "Nhập tổng điểm cho ít nhất một loại, hoặc chọn tính theo từng câu.",
    revealNeedsStart: "Công bố đáp án sau giờ làm bài chung cần có giờ mở bài.",
    revealNeedsLimit:
      "Công bố đáp án sau giờ làm bài chung cần có thời gian làm bài.",
    invalid: "Cài đặt không hợp lệ.",
  },
} as const;

/** Saving and publishing lesson content (S5-04). */
export const publishCopy = {
  saveDraft: "Lưu nháp",
  saving: "Đang lưu…",
  saved: "Đã lưu bản nháp.",
  savedWithErrors: (n: number) =>
    `Đã lưu bản nháp. Còn ${n} lỗi cần sửa trước khi xuất bản.`,
  unchanged: "Nội dung giống bản đã xuất bản, không cần lưu nháp.",
  publish: "Xuất bản",
  publishing: "Đang xuất bản…",
  published: "Đã xuất bản. Học sinh thấy nội dung mới ngay.",
  publishTitle: "Xuất bản bài tập?",
  publishBody:
    "Học sinh sẽ thấy nội dung mới ngay. Bài đang làm dở vẫn được chấm theo nội dung cũ.",
  publishFirstBody: "Bài sẽ hiện trong danh sách bài tập của học sinh.",
  publishSettingsDirty:
    "Cài đặt vừa sửa sẽ được lưu trước, rồi bài mới được xuất bản.",
  panelTitle: "Xuất bản",
  panelLead: "Kiểm tra lần cuối trước khi học sinh thấy bài.",
  checklist: "Danh sách kiểm tra",
  checkQuestions: (n: number) => `${n} câu hỏi`,
  checkNoQuestions: "Chưa có câu hỏi nào",
  checkContentOk: "Nội dung không có lỗi",
  checkContentErrors: (n: number) => `Nội dung còn ${n} lỗi`,
  fixContent: "Sửa ở bước 1",
  checkSettingsOk: "Cài đặt hợp lệ",
  checkSettingsInvalid: "Cài đặt còn ô chưa hợp lệ",
  checkSettingsUnsaved: "Cài đặt có thay đổi, sẽ lưu khi xuất bản",
  summary: "Tóm tắt",
  summaryTotal: "Tổng điểm",
  summaryTypes: "TN / Đ-S / TLN",
  summaryPoints: (points: string) => `${points} điểm`,
  summaryTime: (min: number | null) =>
    min === null ? "Không giới hạn thời gian" : `${min} phút`,
  summaryAttempts: (n: number | null) =>
    n === null ? "Không giới hạn lượt làm" : `Tối đa ${n} lượt`,
  statusLive: "Học sinh đang thấy bài này.",
  statusDraftOnTop: "Có bản nháp chưa xuất bản.",
  statusHidden: "Học sinh chưa thấy bài này.",
  statusArchived: "Bài đang lưu trữ.",
  publishConfirm: "Xuất bản",
  unpublish: "Ngừng xuất bản",
  unpublishing: "Đang ngừng xuất bản…",
  unpublished:
    "Đã ngừng xuất bản. Học sinh không còn thấy bài; bài đang làm dở vẫn nộp được.",
  discardDraft: "Bỏ bản nháp",
  discardTitle: "Bỏ bản nháp?",
  discardBody:
    "Nội dung nháp sẽ bị xóa và trình soạn thảo quay về bản đang xuất bản.",
  discardConfirm: "Bỏ bản nháp",
  discarded: "Đã bỏ bản nháp.",
  cancel: "Hủy",
  close: "Đóng",
  shortcut: "Ctrl+S để lưu nháp",
  hasErrors: (n: number) =>
    `Nội dung còn ${n} lỗi. Sửa hết lỗi (xem mục “Kiểm tra”) rồi xuất bản.`,
  empty: "Bài chưa có câu hỏi nào.",
  invalid: "Nội dung bài không hợp lệ.",
  poolSize: (want: number, have: number) =>
    `Bộ câu hỏi ngẫu nhiên lấy ${want} câu nhưng bài chỉ có ${have} câu. Sửa trong “Cài đặt”.`,
  poolByType: (type: "mcq" | "tf" | "short", want: number, have: number) =>
    `Bộ câu hỏi ngẫu nhiên lấy ${want} câu ${questionTypeLabels[type].toLowerCase()} nhưng bài chỉ có ${have}. Sửa trong “Cài đặt”.`,
  archived: "Bài đang lưu trữ. Khôi phục bài trước khi xuất bản.",
  nothingToPublish: "Bài chưa có nội dung để xuất bản.",
  notPublished: "Bài chưa được xuất bản.",
  noDraft: "Bài không có bản nháp.",
} as const;

/** `/admin/lessons/[id]/stats` (S6-05). */
export const statsCopy = {
  link: "Thống kê",
  linkFor: (title: string) => `Thống kê: ${title}`,
  title: (lesson: string) => `Thống kê: ${lesson}`,
  metaTitle: "Thống kê bài tập",
  back: "Sửa bài",
  lead: "Số liệu từ các bài đã nộp của học sinh, cập nhật tối đa 5 phút một lần.",
  capped: (n: number) =>
    `Bài có nhiều lượt làm: chỉ tính ${n.toLocaleString("vi-VN")} lượt nộp gần nhất.`,
  versionLabel: "Phiên bản",
  versionOption: (version: number, attempts: number, current: boolean) =>
    `Phiên bản ${version}${current ? " (đang dùng)" : ""} · ${attempts} lượt`,
  versionSubmit: "Xem",
  versionPicker: "Chọn phiên bản",
  attempts: "Lượt nộp",
  students: "Học sinh",
  average: "Điểm trung bình",
  median: "Trung vị",
  distribution: "Phân bố điểm",
  bucket: (from: number, last: boolean, n: number) =>
    `Điểm từ ${from} đến ${last ? "10" : `dưới ${from + 1}`}: ${n} lượt`,
  questions: "Từng câu",
  sortLabel: "Sắp xếp câu hỏi",
  sorts: { order: "Theo thứ tự", hardest: "Khó nhất trước" },
  questionHeading: (n: number, type: string) => `Câu ${n} · ${type}`,
  fullMarks: (rate: string, n: number, seen: number) =>
    `Đúng hoàn toàn ${rate} (${n}/${seen})`,
  averageShare: (rate: string) => `Điểm TB ${rate}`,
  answered: (n: number, seen: number) => `Đã trả lời ${n}/${seen}`,
  notSeen: "Chưa có lượt nào gặp câu này.",
  optionsLabel: (n: number) => `Các phương án câu ${n}`,
  key: "Đáp án",
  count: (n: number) => `${n} lượt`,
  blank: "Bỏ trống",
  studentsPerOption: "Học sinh theo phương án",
  nobody: "Không có",
  statement: (letter: string) => `${letter})`,
  statementsLabel: (n: number) => `Các mệnh đề câu ${n}`,
  statementColumn: "Mệnh đề",
  keyColumn: "Đáp án",
  correctColumn: "Chọn đúng",
  blankColumn: "Bỏ trống",
  trueLabel: "Đúng",
  falseLabel: "Sai",
  shortKey: (answer: string) => `Đáp án: ${answer}`,
  topAnswers: (n: number) => `Câu trả lời thường gặp của câu ${n}`,
  correct: "Đúng",
  wrong: "Sai",
  moreAnswers: (n: number) => `và ${n} câu trả lời khác`,
  emptyTitle: "Chưa có bài nộp",
  emptyBody:
    "Khi học sinh nộp bài ở phiên bản này, số liệu sẽ hiển thị ở đây (trễ tối đa 5 phút).",
  errorTitle: "Không tải được thống kê",
  loading: "Đang tải thống kê",
  percent: (x: number) => `${Math.round(x * 100)}%`,
} as const;

/** Public share page `/share/lessons/[id]` and its preview image (S8-03). */
export const shareCopy = {
  eyebrow: "Đề luyện tập Vật lý",
  facts: "Thông tin bài",
  questions: "Số câu",
  duration: "Thời gian",
  noLimit: "Không giới hạn",
  previewTitle: (n: number) =>
    n > 1 ? `Xem trước ${n} câu đầu` : "Xem trước đề bài",
  previewLead: "Đáp án và lời giải chỉ hiện sau khi nộp bài.",
  noPreview:
    "Bài này không có câu xem trước: đề thi và bài theo lịch chỉ mở khi bắt đầu làm.",
  question: (n: number) => `Câu ${n}`,
  shortHint: "Học sinh tự điền đáp số.",
  ctaTitle: "Làm trọn bài này",
  ctaBody:
    "Đăng nhập để làm bài, được chấm điểm ngay khi nộp và ôn lại câu sai.",
  ctaStart: "Làm bài",
  ctaRegister: "Tạo tài khoản",
  imageAlt: (title: string) => `Đề Vật lý: ${title}`,
  imageQuestions: (n: number) => `${n} câu`,
  shareButton: "Chia sẻ",
  copied: "Đã sao chép liên kết chia sẻ.",
  copyFailed: "Không sao chép được, bạn tự sao chép liên kết này:",
} as const;

/** Refusals of a correction to a published version (B-10). */
export const correctionCopy = {
  notFound: "Không tìm thấy câu hỏi này trong bài. Tải lại trang rồi thử lại.",
  badAnswer: "Đáp án không hợp lệ cho câu hỏi này.",
  pointsByType:
    "Điểm câu này được chia theo tổng điểm của loại câu hỏi. Đổi trong phần Cài đặt.",
  shapeChanged:
    "Không thể đổi loại câu hỏi hoặc số phương án/mệnh đề ở đây vì bài làm cũ dựa vào chúng. Hãy dùng “Soạn lại toàn bài”.",
  lastQuestion: "Bài cần còn ít nhất một câu hỏi.",
  invalid: "Câu hỏi chưa hợp lệ.",
  hasDraft:
    "Bài đang có bản nháp chưa xuất bản. Xuất bản hoặc bỏ bản nháp trước khi sửa trực tiếp.",
  noPublished: "Bài chưa có phiên bản đã xuất bản.",
  archived: "Bài đã lưu trữ. Khôi phục bài trước khi sửa.",
  oneQuestion: "Nội dung cần đúng một câu hỏi, bắt đầu bằng “Câu 1:”.",
  lineError: (line: number, message: string) => `Dòng ${line}: ${message}`,
} as const;

/** `/admin/lessons/[id]/questions` and the one-question editor (B-10). */
export const questionsCopy = {
  metaTitle: "Câu hỏi của bài",
  title: (lesson: string) => `Câu hỏi: ${lesson}`,
  lead: (version: number, submitted: number) =>
    `Phiên bản ${version} đang dùng · ${submitted} lượt nộp. Bấm chữ cái để đổi đáp án, đổi điểm, tặng điểm hoặc xóa câu, rồi bấm “Lưu”: mọi bài làm trên phiên bản này được chấm lại.`,
  back: "Bài tập",
  results: "Kết quả",
  stats: "Thống kê",
  fullEditor: "Soạn lại toàn bài",
  settings: "Cài đặt",
  loading: "Đang tải câu hỏi",
  errorTitle: "Không tải được câu hỏi",
  draftTitle: "Bài đang có bản nháp",
  draftBody:
    "Bản nháp sẽ thay nội dung này khi xuất bản, nên chưa thể sửa trực tiếp. Mở trình soạn để xuất bản hoặc bỏ bản nháp.",
  openDraft: "Mở bản nháp",
  archivedBody: "Bài đã lưu trữ. Khôi phục bài trước khi sửa câu hỏi.",
  listLabel: "Các câu hỏi",
  changes: (n: number) => (n ? `${n} thay đổi chưa lưu` : "Chưa có thay đổi"),
  cancel: "Hủy",
  save: "Lưu",
  saving: "Đang lưu…",
  confirmTitle: "Lưu và chấm lại?",
  confirmBody: (changes: number, submitted: number) =>
    submitted
      ? `${changes} thay đổi sẽ áp dụng ngay cho bài đang xuất bản, và ${submitted} lượt nộp sẽ được chấm lại theo đáp án mới. Xếp hạng của học sinh được tính lại theo điểm mới.`
      : `${changes} thay đổi sẽ áp dụng ngay cho bài đang xuất bản.`,
  confirm: "Lưu và chấm lại",
  close: "Đóng",
  saved: (regraded: number) =>
    regraded ? `Đã lưu. Đã chấm lại ${regraded} bài làm.` : "Đã lưu.",
  leave: "Bạn có thay đổi chưa lưu. Rời trang?",
  points: (n: number) => `Điểm câu ${n}`,
  pointsShared: "Điểm chia theo loại câu (Cài đặt)",
  free: "Tặng điểm",
  freeLabel: (n: number, on: boolean) =>
    on ? `Bỏ tặng điểm câu ${n}` : `Tặng điểm câu ${n}: ai cũng được trọn điểm`,
  freeBadge: "Mọi học sinh được trọn điểm câu này",
  remove: (n: number) => `Xóa câu ${n}`,
  removed: (n: number) =>
    `Câu ${n} sẽ bị xóa khi lưu. Điểm của câu này không còn tính.`,
  undo: "Hoàn tác",
  editContent: "Sửa nội dung",
  editContentLabel: (n: number) => `Sửa nội dung câu ${n}`,
  saveFirst: "Lưu hoặc hủy thay đổi trước",
  shortAnswer: (n: number) => `Đáp án đúng câu ${n}`,
  // The one-question editor.
  editMeta: "Sửa câu hỏi",
  editTitle: (n: number) => `Sửa nội dung câu ${n}`,
  editLead:
    "Chỉ câu này. Giữ nguyên loại câu và số phương án; “Lưu” áp dụng ngay và chấm lại bài làm.",
  editBack: "Quay lại",
  editText: "Nội dung câu hỏi",
  editPreview: "Xem trước",
  notFoundTitle: "Không tìm thấy câu hỏi",
  notFoundBody: "Câu hỏi đã bị xóa hoặc bài chưa xuất bản.",
} as const;
