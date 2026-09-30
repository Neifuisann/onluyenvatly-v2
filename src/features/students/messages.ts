/** Vietnamese copy for `/admin/students` and its detail page (S6-01/02). */

export const studentsCopy = {
  deletionTitle: (n: number) => `Yêu cầu xóa tài khoản (${n})`,
  deletionLead:
    "Học sinh tự gửi yêu cầu trong Cài đặt. Mở từng em để xóa, hoặc bỏ qua nếu em đã hủy.",
  deletionAt: (when: string) => `Gửi lúc ${when}`,
  deletionBadge: "Đã yêu cầu xóa tài khoản",
  title: "Học sinh",
  lead: "Duyệt tài khoản mới và quản lý học sinh.",
  loading: "Đang tải danh sách học sinh",
  errorTitle: "Không tải được danh sách học sinh",
  tabsLabel: "Chế độ xem",
  tabPending: "Chờ duyệt",
  tabAll: "Tất cả",

  // Pending queue
  pendingCount: (n: number) => `${n} học sinh đang chờ duyệt`,
  pendingMore: (n: number) =>
    `Đang hiển thị ${n} học sinh đăng ký sớm nhất. Duyệt xong sẽ thấy tiếp.`,
  pendingEmptyTitle: "Không có ai đang chờ duyệt",
  pendingEmptyBody: "Học sinh đăng ký mới sẽ xuất hiện ở đây.",
  pendingListLabel: "Học sinh chờ duyệt",
  selectAll: "Chọn tất cả",
  selectedCount: (n: number) => `Đã chọn ${n}`,
  selectStudent: (name: string) => `Chọn ${name}`,
  approve: "Duyệt",
  reject: "Từ chối",
  registeredAt: "Đăng ký",
  dateOfBirth: "Ngày sinh",
  approved: (done: number, skipped: number) =>
    skipped > 0
      ? `Đã duyệt ${done} học sinh. Bỏ qua ${skipped} (đã được xử lý).`
      : `Đã duyệt ${done} học sinh.`,
  rejected: (done: number, skipped: number) =>
    skipped > 0
      ? `Đã từ chối ${done} học sinh. Bỏ qua ${skipped} (đã được xử lý).`
      : `Đã từ chối ${done} học sinh.`,
  rejectTitle: "Từ chối đăng ký?",
  rejectBody: (n: number) =>
    `${n} học sinh sẽ không đăng nhập được. Bạn vẫn có thể mở lại tài khoản sau ở trang chi tiết.`,
  rejectConfirm: "Từ chối",
  cancel: "Hủy",
  close: "Đóng",

  // All students
  searchLabel: "Tìm học sinh",
  searchPlaceholder: "Tìm theo tên hoặc số điện thoại",
  searchSubmit: "Tìm",
  statusGroup: "Lọc theo trạng thái",
  gradeGroup: "Lọc theo khối",
  filterAll: "Tất cả",
  statuses: {
    pending: "Chờ duyệt",
    active: "Đang hoạt động",
    rejected: "Từ chối",
    disabled: "Đã khóa",
  },
  grade: (g: number) => `Khối ${g}`,
  gradeShort: (g: number) => `Lớp ${g}`,
  count: (shown: number, total: number) =>
    shown < total ? `${shown} / ${total} học sinh` : `${total} học sinh`,
  listLabel: "Danh sách học sinh",
  noMatchTitle: "Không có học sinh phù hợp",
  noMatchBody: "Thử từ khóa khác hoặc bỏ bộ lọc.",
  emptyTitle: "Chưa có học sinh nào",
  emptyBody: "Học sinh tự đăng ký tại trang đăng ký và chờ bạn duyệt.",
  clear: "Xóa bộ lọc",
  loadMore: "Xem thêm",
  rating: (r: number) => `${r} điểm`,
  unrated: "Chưa xếp hạng",
  lastLogin: (when: string) => `Đăng nhập gần nhất ${when}`,
  neverLoggedIn: "Chưa đăng nhập",

  // Detail
  back: "Danh sách học sinh",
  detailLoading: "Đang tải thông tin học sinh",
  detailErrorTitle: "Không tải được thông tin học sinh",
  notFoundTitle: "Không tìm thấy học sinh",
  notFoundBody: "Học sinh không tồn tại hoặc đã bị xóa.",
  profile: "Thông tin",
  fullName: "Họ và tên",
  phone: "Số điện thoại",
  class: "Lớp",
  status: "Trạng thái",
  registered: "Đăng ký lúc",
  approvedAt: "Duyệt lúc",
  lastLoginAt: "Đăng nhập gần nhất",
  mustChange: "Đang chờ đổi mật khẩu tạm",
  ratingSection: "Xếp hạng",
  ratingNow: "Hiện tại",
  ratingPeak: "Cao nhất",
  ratedAttempts: "Bài tính điểm",
  attemptTotal: "Bài đã nộp",
  attemptsSection: "Bài làm gần đây",
  attemptsLimit: (shown: number, total: number) =>
    `Hiển thị ${shown} bài gần nhất trong ${total} bài.`,
  attemptsEmpty: "Học sinh chưa nộp bài nào.",
  reviewMode: "Ôn tập cá nhân",
  practiceMode: "Luyện tập",
  score: "Điểm",
  sessionsSection: "Phiên đăng nhập",
  sessionsEmpty: "Không có phiên đăng nhập nào đang hoạt động.",
  sessionCreated: (when: string) => `Đăng nhập ${when}`,
  sessionSeen: (when: string) => `Hoạt động ${when}`,
  sessionIp: (ip: string) => `IP ${ip}`,
  unknownDevice: "Thiết bị không rõ",

  // Actions
  actionsSection: "Thao tác",
  resetPassword: "Đặt lại mật khẩu",
  resetTitle: "Đặt lại mật khẩu?",
  resetBody:
    "Hệ thống tạo một mật khẩu tạm và đăng xuất học sinh khỏi mọi thiết bị. Học sinh phải đổi mật khẩu ở lần đăng nhập tiếp theo.",
  resetConfirm: "Đặt lại",
  resetDoneTitle: "Mật khẩu tạm",
  resetDoneBody:
    "Chỉ hiển thị một lần. Hãy đưa mật khẩu này cho học sinh; sau khi đóng hộp thoại bạn sẽ không xem lại được.",
  tempPasswordLabel: "Mật khẩu tạm của học sinh",
  copy: "Sao chép",
  copied: "Đã sao chép",
  copyFailed: "Không sao chép được, hãy chép thủ công.",
  revokeSessions: "Đăng xuất mọi thiết bị",
  revokeTitle: "Đăng xuất học sinh khỏi mọi thiết bị?",
  revokeBody: "Học sinh phải đăng nhập lại. Bài đang làm dở vẫn được giữ.",
  revokeConfirm: "Đăng xuất",
  revoked: (n: number) =>
    n > 0
      ? `Đã đăng xuất ${n} phiên đăng nhập.`
      : "Học sinh không có phiên đăng nhập nào.",
  disable: "Khóa tài khoản",
  disableTitle: "Khóa tài khoản này?",
  disableBody:
    "Học sinh bị đăng xuất và không đăng nhập được cho đến khi bạn mở lại.",
  disableConfirm: "Khóa",
  disabled: "Đã khóa tài khoản.",
  enable: "Mở lại tài khoản",
  enabled: "Đã mở lại tài khoản.",
  statusUnchanged: "Trạng thái của tài khoản đã thay đổi. Tải lại trang.",
  delete: "Xóa học sinh",
  deleteTitle: "Xóa học sinh?",
  deleteBody: (attempts: number) =>
    `Toàn bộ dữ liệu của học sinh sẽ bị xóa vĩnh viễn: ${attempts} bài đã nộp, điểm xếp hạng, lỗi sai và phiên đăng nhập. Không thể khôi phục.`,
  deleteConfirmLabel: (name: string) => `Gõ “${name}” để xác nhận`,
  deleteConfirm: "Xóa vĩnh viễn",
  confirmNameMismatch: "Tên chưa khớp với tên học sinh.",
  deleted: "Đã xóa học sinh.",
  ownAccount: "Bạn không thể thao tác trên tài khoản của chính mình.",

  // Extra attempts
  grantSection: "Thêm lượt làm bài",
  grantLead:
    "Cho học sinh làm thêm bài đã hết lượt hoặc đã đóng đáp án. Lượt thêm thay cho lần cấp trước.",
  grantLesson: "Bài tập",
  grantLessonPlaceholder: "Chọn bài",
  grantAttempted: "Bài học sinh đã làm",
  grantOthers: "Bài khác",
  grantExtra: "Số lượt thêm",
  grantExtraHint: "1–100.",
  grantSubmit: "Cấp lượt",
  granted: (extra: number) => `Đã cấp thêm ${extra} lượt.`,
  grantRemoved: "Đã bỏ lượt thêm.",
  grantNeedLesson: "Chọn một bài tập.",
  grantNeedExtra: "Nhập số lượt từ 1 đến 100.",
  grantsCurrent: "Lượt thêm đang có",
  grantsNone: "Chưa cấp lượt thêm nào.",
  grantExtraCount: (n: number) => `+${n} lượt`,
  grantRemove: (title: string) => `Bỏ lượt thêm: ${title}`,
} as const;
