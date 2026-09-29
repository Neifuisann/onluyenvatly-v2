/** AI explanations under each reviewed question (S7-02). */
export const explainCopy = {
  heading: "Giải thích của AI",
  teacherReviewed: "Giáo viên đã xem lại",
  disclaimer: "AI có thể nhầm. Hãy đối chiếu với đáp án ở trên.",
  ask: "Giải thích bằng AI",
  generating: "AI đang soạn lời giải thích…",
  retry: "Thử lại",
  failed: "Chưa tạo được lời giải thích. Bạn thử lại sau nhé.",
  /** ADR-007: Gemini down or switched off. */
  unavailable: "Giải thích đang được chuẩn bị. Bạn quay lại sau nhé.",
  /** 09 §2: the global budget is spent. */
  quota: "Hết lượt giải thích AI hôm nay, hãy thử lại vào ngày mai.",
  userLimit:
    "Bạn đã dùng hết lượt giải thích AI hôm nay, hãy thử lại vào ngày mai.",
  voteLabel: "Lời giải thích này có giúp bạn không?",
  up: "Hữu ích",
  down: "Chưa đúng hoặc khó hiểu",
  voteFailed: "Chưa ghi nhận được. Thử lại sau.",
} as const;

/** `/admin/explanations` (S7-03). */
export const adminExplanationsCopy = {
  title: "Giải thích AI",
  lead: "Tạo sẵn lời giải thích cho cả bài, xem lại và sửa những lời giải thích bị học sinh đánh giá chưa tốt.",
  tabFlagged: (n: number) => `Cần xem lại (${n})`,
  tabLesson: "Theo bài",
  tabsLabel: "Chế độ xem",
  lesson: "Bài",
  pickLesson: "Chọn bài",
  show: "Xem",
  pickerLabel: "Chọn bài để xem giải thích",
  noLessons: "Chưa có bài nào đã xuất bản.",
  counts: (c: {
    total: number;
    teacher: number;
    stored: number;
    missing: number;
  }) =>
    `${c.total} câu · ${c.teacher} câu có lời giải của giáo viên · ${c.stored} câu có giải thích AI · ${c.missing} câu còn thiếu`,
  question: (position: number, type: string) => `Câu ${position} · ${type}`,
  key: "Đáp án",
  teacherInLesson: "Lời giải của giáo viên (trong bài)",
  teacherInLessonHint: "Sửa trong trình soạn bài.",
  none: "Chưa có giải thích. Học sinh sẽ được tạo khi bấm “Giải thích bằng AI”, hoặc tạo sẵn ở trên.",
  flaggedEmpty: "Không có lời giải thích nào cần xem lại.",
  flaggedEmptyHint:
    "Lời giải thích có từ 3 lượt “chưa đúng hoặc khó hiểu” trở lên sẽ hiện ở đây.",
  flaggedFrom: (title: string | null, questionId: string) =>
    title ? `${title} · ${questionId}` : `Bài đã xóa · ${questionId}`,
  openLesson: "Mở bài",
  lessonNotFound: "Không tìm thấy bài, hoặc bài chưa được xuất bản.",
  // Card
  sourceAi: (model: string | null) => (model ? `AI (${model})` : "AI"),
  sourceTeacher: "Giáo viên đã sửa",
  reviewed: "Đã duyệt",
  flagged: "Nhiều đánh giá chưa tốt",
  votes: (up: number, down: number) => `${up} hữu ích · ${down} chưa tốt`,
  edit: "Sửa",
  editLabel: "Nội dung giải thích",
  editHint: "Markdown đơn giản: **in đậm**, công thức trong $...$.",
  save: "Lưu",
  saving: "Đang lưu…",
  cancel: "Hủy",
  approve: "Duyệt",
  regenerate: "Tạo lại",
  regenerateTitle: "Tạo lại lời giải thích?",
  regenerateBody:
    "AI sẽ viết lại lời giải thích này. Nội dung hiện tại và các lượt đánh giá sẽ bị xóa.",
  working: "Đang xử lý…",
  close: "Đóng",
  // Pre-generation
  pregenTitle: "Tạo sẵn cho cả bài",
  pregenLead: (missing: number) =>
    missing > 0
      ? `Còn ${missing} câu chưa có giải thích. AI tạo lần lượt từng câu (khoảng 10 câu mỗi phút), tính vào lượt AI trong ngày.`
      : "Mọi câu đã có giải thích.",
  pregenStart: (missing: number) => `Tạo giải thích cho ${missing} câu`,
  pregenStop: "Dừng",
  pregenProgress: (done: number, left: number) =>
    `Đã tạo ${done} câu, còn ${left} câu…`,
  pregenDone: (done: number) => `Xong: đã tạo ${done} câu.`,
  pregenSkipped: (n: number) =>
    `${n} câu AI trả lời chưa trọn vẹn, đã bỏ qua. Bấm tạo lại để thử lần nữa.`,
  pregenStopped: (done: number) => `Đã dừng sau ${done} câu.`,
  aiOff: "AI đang tắt trong Cài đặt.",
  // Errors
  quota:
    "Hôm nay đã hết lượt AI (theo giới hạn trong Cài đặt). Thử lại vào ngày mai.",
  unavailable: "AI đang bận hoặc chưa được cấu hình. Thử lại sau.",
  incomplete: "AI trả lời chưa trọn vẹn. Thử lại.",
  questionChanged:
    "Câu hỏi này đã được sửa hoặc bài chưa xuất bản, nên không tạo lại được.",
  errorTitle: "Không tải được trang giải thích AI",
  loading: "Đang tải giải thích AI",
} as const;

/** Editor helpers (S7-05): "Viết mô tả bằng AI", "Gợi ý thẻ". */
export const lessonHelpersCopy = {
  describe: "Viết mô tả bằng AI",
  suggestTags: "Gợi ý thẻ",
  working: "AI đang viết…",
  described: "AI đã viết mô tả. Xem lại rồi bấm Lưu cài đặt.",
  tagsAdded: (n: number) =>
    n > 0
      ? `Đã thêm ${n} thẻ gợi ý. Xem lại rồi bấm Lưu cài đặt.`
      : "AI không gợi ý thêm thẻ nào mới.",
  noQuestions: "Bài chưa có câu hỏi nào để AI đọc. Soạn nội dung trước.",
  noTitle: "Nhập tên bài trước.",
  quota:
    "Hôm nay đã hết lượt AI (theo giới hạn trong Cài đặt). Thử lại vào ngày mai.",
  unavailable: "AI đang bận hoặc chưa được cấu hình. Thử lại sau.",
  incomplete: "AI trả lời chưa trọn vẹn. Thử lại.",
} as const;

/** `/admin/import` (S7-04): exam file → lesson text → a new draft. */
export const importCopy = {
  title: "Nhập đề bằng AI",
  lead: "Tải lên đề kiểm tra (PDF, Word .docx hoặc ảnh chụp, tối đa 10 MB). AI chuyển đề sang định dạng soạn bài; bạn kiểm tra rồi tạo bài nháp để sửa trong trình soạn.",
  file: "File đề",
  fileHint: "PDF, DOCX, PNG, JPG hoặc WEBP; tối đa 10 MB.",
  lessonTitle: "Tên bài",
  lessonTitleHint:
    "Mặc định lấy theo tên file; đổi sau trong Cài đặt cũng được.",
  start: "Nhập bằng AI",
  uploading: "Đang tải file lên…",
  reading: "AI đang đọc đề… Đề dài có thể mất 1–3 phút.",
  received: (n: number) => `Đã nhận ${n} câu`,
  doneTitle: "AI đã chuyển xong",
  summary: (c: { total: number; mcq: number; tf: number; short: number }) =>
    `${c.total} câu: ${c.mcq} trắc nghiệm, ${c.tf} đúng/sai, ${c.short} trả lời ngắn.`,
  issues: (n: number) =>
    n > 0
      ? `${n} lỗi cần sửa (ví dụ thiếu đáp án). Trình soạn sẽ chỉ ra từng dòng.`
      : "Không có lỗi định dạng. Hãy đối chiếu nội dung với đề gốc trước khi xuất bản.",
  figures: (n: number) =>
    `${n} chỗ có hình AI không chép được, đánh dấu [Hình]: hãy chèn ảnh trong trình soạn.`,
  output: "Văn bản AI trả về",
  create: "Tạo bài nháp và mở trình soạn",
  creating: "Đang tạo bài…",
  again: "Nhập file khác",
  // Errors
  pickFile: "Chọn file đề trước.",
  tooBig: "File lớn hơn 10 MB. Hãy chia nhỏ hoặc nén lại.",
  badType: "Chỉ nhận PDF, DOCX, PNG, JPG hoặc WEBP.",
  badFile:
    "Không đọc được file này. Hãy lưu lại thành PDF hoặc DOCX rồi thử lại.",
  emptyFile: "File không có nội dung chữ nào để chuyển.",
  fileMissing: "Không tìm thấy file vừa tải lên. Hãy tải lại.",
  uploadFailed: "Chưa tải được file lên. Kiểm tra mạng rồi thử lại.",
  noStorage: "Kho lưu trữ chưa được cấu hình, chưa nhập đề được.",
  quota:
    "Hôm nay đã hết lượt AI (theo giới hạn trong Cài đặt). Thử lại vào ngày mai.",
  unavailable: "AI đang bận hoặc chưa được cấu hình. Thử lại sau.",
  stopped:
    "AI dừng giữa chừng. Phần đã nhận vẫn được giữ: bạn có thể tạo bài nháp rồi soạn tiếp, hoặc thử lại.",
  nothing: "AI chưa trả về câu hỏi nào. Thử lại, hoặc dùng file rõ nét hơn.",
  aiOff: "AI đang tắt trong Cài đặt.",
} as const;
