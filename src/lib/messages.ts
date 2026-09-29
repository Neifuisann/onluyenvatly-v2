/**
 * Vietnamese UI copy (07 §6). Code identifiers stay English; every string a
 * student reads lives here or in a feature's `messages.ts`.
 */

export const errorMessages = {
  UNAUTHENTICATED: "Bạn cần đăng nhập để tiếp tục.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  NOT_FOUND: "Không tìm thấy nội dung bạn cần.",
  VALIDATION: "Vui lòng kiểm tra lại thông tin đã nhập.",
  RATE_LIMITED: "Bạn thao tác quá nhanh. Vui lòng đợi một lát rồi thử lại.",
  INVALID_CREDENTIALS: "Sai số điện thoại hoặc mật khẩu.",
  ACCOUNT_PENDING:
    "Tài khoản của bạn đang chờ giáo viên duyệt. Bạn sẽ đăng nhập được sau khi được duyệt.",
  ACCOUNT_REJECTED:
    "Tài khoản của bạn không được phép đăng nhập. Liên hệ giáo viên nếu có nhầm lẫn.",
  REGISTRATION_CLOSED: "Hiện tại chưa mở đăng ký tài khoản mới.",
  CONFLICT: "Dữ liệu đã tồn tại.",
  ATTEMPT_CLOSED: "Bài làm đã được nộp hoặc đã đóng.",
  ATTEMPT_LIMIT: "Bạn đã hết số lần làm bài này.",
  NOT_OPEN_YET: "Bài chưa đến giờ làm. Bạn quay lại sau nhé.",
  LESSON_CLOSED: "Bài đã đóng vì đáp án đã được công bố.",
  DEADLINE_PASSED: "Đã hết thời gian làm bài.",
  AI_UNAVAILABLE: "Tính năng AI đang tạm dừng. Vui lòng thử lại sau.",
  AI_QUOTA: "Hôm nay đã hết lượt dùng AI. Vui lòng thử lại vào ngày mai.",
  STORAGE_UNAVAILABLE:
    "Chưa tải được ảnh lên: kho ảnh chưa được cấu hình hoặc đang lỗi. Thử lại sau.",
  STORAGE_FULL: "Kho ảnh đã gần đầy. Xóa bớt ảnh không dùng rồi thử lại.",
  INTERNAL: "Đã có lỗi xảy ra. Vui lòng thử lại.",
} as const;

export type ErrorCode = keyof typeof errorMessages;

export const passwordIssueMessages = {
  TOO_SHORT: "Mật khẩu cần ít nhất 8 ký tự.",
  TOO_LONG: "Mật khẩu quá dài.",
  ALL_DIGITS: "Mật khẩu không được chỉ gồm chữ số.",
  CONTAINS_PHONE: "Mật khẩu không được chứa số điện thoại.",
} as const;

export const fieldMessages = {
  required: "Vui lòng nhập thông tin này.",
  fullName: "Họ và tên cần từ 2 đến 80 ký tự.",
  phone: "Số điện thoại không hợp lệ (ví dụ 0912 345 678).",
  phoneTaken: "Số điện thoại này đã được đăng ký.",
  dateOfBirth: "Ngày sinh không hợp lệ.",
  grade: "Chọn khối 10, 11 hoặc 12.",
  className: "Tên lớp tối đa 20 ký tự.",
  username:
    "Tên đăng nhập gồm 3–32 ký tự: chữ thường, số, dấu . _ -, bắt đầu bằng chữ.",
  usernameTaken: "Tên đăng nhập này đã được dùng.",
  currentPasswordWrong: "Mật khẩu hiện tại chưa đúng.",
  passwordSame: "Mật khẩu mới cần khác mật khẩu hiện tại.",
  passwordMismatch: "Hai mật khẩu chưa khớp.",
} as const;

export const authCopy = {
  loginTitle: "Đăng nhập",
  loginLead: "Chào mừng bạn quay lại. Đăng nhập để tiếp tục luyện đề.",
  identifier: "Số điện thoại",
  identifierHint: "Giáo viên có thể dùng tên đăng nhập.",
  password: "Mật khẩu",
  showPassword: "Hiện mật khẩu",
  loginSubmit: "Đăng nhập",
  loginPending: "Đang đăng nhập…",
  noAccount: "Chưa có tài khoản?",
  registerLink: "Đăng ký",
  registerTitle: "Đăng ký tài khoản",
  registerLead:
    "Điền thông tin của bạn. Giáo viên sẽ duyệt tài khoản trước khi bạn đăng nhập.",
  fullName: "Họ và tên",
  phone: "Số điện thoại",
  dateOfBirth: "Ngày sinh",
  grade: "Khối",
  gradeNone: "Chọn khối",
  className: "Lớp",
  classNameHint: "Ví dụ 12A1 (không bắt buộc).",
  newPassword: "Mật khẩu",
  newPasswordHint: "Ít nhất 8 ký tự, không chỉ gồm chữ số.",
  registerSubmit: "Đăng ký",
  registerPending: "Đang gửi…",
  haveAccount: "Đã có tài khoản?",
  loginLink: "Đăng nhập",
  pendingTitle: "Đã gửi đăng ký",
  pendingBody:
    "Tài khoản của bạn đang chờ giáo viên duyệt. Khi được duyệt, bạn đăng nhập bằng số điện thoại và mật khẩu vừa tạo.",
  pendingBack: "Về trang đăng nhập",
  logout: "Đăng xuất",
  logoutAll: "Đăng xuất khỏi mọi thiết bị",
  changePasswordTitle: "Đổi mật khẩu",
  changePasswordLead: "Đặt mật khẩu mới cho tài khoản của bạn.",
  changePasswordForced:
    "Giáo viên đã đặt lại mật khẩu cho bạn. Hãy đặt mật khẩu mới của riêng bạn để tiếp tục.",
  currentPassword: "Mật khẩu hiện tại",
  currentPasswordHint: "Là mật khẩu tạm giáo viên đã đưa cho bạn.",
  confirmPassword: "Nhập lại mật khẩu mới",
  changePasswordSubmit: "Đổi mật khẩu",
  changePasswordPending: "Đang lưu…",
} as const;

export const shellCopy = {
  appName: "Ôn Luyện Vật Lý",
  skipToContent: "Bỏ qua điều hướng",
  mainNav: "Điều hướng chính",
  adminNav: "Quản trị",
  theory: "Lý thuyết",
  login: "Đăng nhập",
  register: "Đăng ký",
  themeToggle: "Đổi giao diện sáng/tối",
  themeLight: "Sáng",
  themeDark: "Tối",
  themeSystem: "Theo hệ thống",
  greeting: (name: string) => `Chào ${name}`,
  studentNav: {
    dashboard: "Trang chủ",
    lessons: "Bài tập",
    review: "Ôn tập",
    leaderboard: "Xếp hạng",
    profile: "Tôi",
  },
  adminNavItems: {
    overview: "Tổng quan",
    lessons: "Bài tập",
    import: "Nhập bằng AI",
    students: "Học sinh",
    results: "Kết quả",
    explanations: "Giải thích AI",
    settings: "Cài đặt",
    audit: "Nhật ký",
  },
  navBadge: (n: number) => ` (${n} mục cần xử lý)`,
  toStudentView: "Xem trang học sinh",
  toAdmin: "Trang quản trị",
  adminBadge: "Quản trị",
  roleStudent: "Học sinh",
  roleAdmin: "Giáo viên",
  accountMenu: "Tài khoản",
} as const;

/** Sign-in/sign-up frame and the first-run welcome (07 §2, onboarding). */
export const onboardingCopy = {
  headline: ["Luyện đề Vật lý,", "hiểu tới đâu chắc tới đó."],
  values: {
    format: {
      title: "Đề theo cấu trúc thi mới",
      body: "Trắc nghiệm, Đúng/Sai và trả lời ngắn như đề thật.",
    },
    instant: {
      title: "Chấm điểm ngay khi nộp",
      body: "Xem điểm ngay; đáp án và lời giải theo lịch giáo viên công bố.",
    },
    review: {
      title: "Ôn đúng chỗ còn sai",
      body: "Câu làm sai được gom lại để bạn luyện lại.",
    },
    rank: {
      title: "Tiến bộ thấy rõ",
      body: "Rating và bảng xếp hạng sau mỗi bài kiểm tra.",
    },
  },
  stepsLabel: "Các bước bắt đầu",
  steps: ["Đăng ký", "Giáo viên duyệt", "Luyện đề"],
  welcomeTitle: "Bắt đầu thế nào?",
  welcomeLead: "Ba bước để làm quen với Ôn Luyện Vật Lý:",
  welcomeSteps: [
    {
      title: "Chọn một bài",
      body: "Vào mục Bài tập, chọn đề hợp với lớp của bạn.",
    },
    {
      title: "Làm và nộp bài",
      body: "Bài làm tự lưu. Nộp xong là có điểm; lời giải theo lịch giáo viên công bố.",
    },
    {
      title: "Ôn lại câu sai",
      body: "Mục Ôn tập gom các câu bạn làm sai để luyện lại.",
    },
  ],
  welcomeCta: "Chọn bài đầu tiên",
} as const;

export const notFoundCopy = {
  title: "Không tìm thấy trang",
  body: "Trang này không tồn tại hoặc đã được chuyển đi. Mình quay về trang chủ nhé.",
  home: "Về trang chủ",
} as const;

/** The public landing page (S8-01). Honest: only what the site does today. */
export const landingCopy = {
  eyebrow: "Vật lý THPT · Lớp 10, 11, 12",
  lead: "Đề theo cấu trúc thi mới, chấm điểm ngay khi nộp, lời giải khi giáo viên công bố, và một chỗ riêng để ôn lại những câu bạn còn sai.",
  ctaPrimary: "Tạo tài khoản",
  ctaSecondary: "Đăng nhập",
  featuresTitle: "Mọi thứ bạn cần để luyện đề",
  howTitle: "Bắt đầu trong ba bước",
  howSteps: [
    {
      title: "Đăng ký",
      body: "Điền họ tên, số điện thoại, lớp và đặt mật khẩu.",
    },
    {
      title: "Giáo viên duyệt",
      body: "Giáo viên xác nhận tài khoản để lớp học luôn đúng người.",
    },
    {
      title: "Luyện đề",
      body: "Chọn bài, làm bài, xem điểm và ôn lại khi đáp án được công bố.",
    },
  ],
  topicsTitle: "Theo các chủ đề của chương trình THPT",
  topics: {
    kinematics: "Động học",
    dynamics: "Động lực học",
    energy: "Năng lượng",
    oscillation: "Dao động",
    wave: "Sóng",
    electric: "Điện trường",
    current: "Dòng điện",
    magnetic: "Từ trường",
    optics: "Quang học",
    thermal: "Vật lí nhiệt",
    nuclear: "Vật lí hạt nhân",
  },
  closingTitle: "Sẵn sàng luyện đề chưa?",
  closingBody:
    "Tạo tài khoản, chờ giáo viên duyệt, rồi làm bài đầu tiên của bạn.",
  preview: {
    label: "Xem trước giao diện làm bài",
    question: "Câu 3",
    type: "Trắc nghiệm",
    stem: "Một con lắc lò xo có k = 100 N/m, m = 1 kg. Chu kì dao động là",
    // T = 2π√(m/k) = 0,2π s: option B, the one shown as chosen.
    options: ["0,1π s", "0,2π s", "2π s", "20π s"],
    saved: "Đã lưu",
    timer: "32:15",
  },
  footer: "Ôn Luyện Vật Lý · Luyện đề Vật lý THPT",
} as const;
