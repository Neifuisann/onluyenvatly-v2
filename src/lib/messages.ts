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
  toStudentView: "Xem trang học sinh",
  toAdmin: "Trang quản trị",
} as const;

/** Walking-skeleton pages (replaced in S4-06 and S6-06). */
export const placeholderCopy = {
  adminEmptyTitle: "Chưa có dữ liệu",
  adminEmptyBody: "Số liệu về học sinh và bài làm sẽ hiển thị ở đây.",
  homeTitle: "Ôn Luyện Vật Lý",
  homeBody:
    "Luyện đề Vật lý THPT theo cấu trúc đề thi mới. Phiên bản mới đang được xây dựng.",
} as const;
