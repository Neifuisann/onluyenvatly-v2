/** Vietnamese copy for `/admin/students` and its detail page (S6-01). */

export const studentsCopy = {
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
} as const;
