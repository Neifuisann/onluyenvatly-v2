/** Vietnamese copy for `/admin/settings` (S6-03). */

export const settingsCopy = {
  title: "Cài đặt",
  lead: "Cài đặt chung cho cả trang và tài khoản quản trị.",
  loading: "Đang tải cài đặt",
  errorTitle: "Không tải được cài đặt",

  generalSection: "Cài đặt chung",
  generalLead:
    "Áp dụng ngay cho cả trang. Đăng ký và đăng nhập dùng cài đặt mới từ lần tiếp theo.",
  registrationOpen: "Mở đăng ký tài khoản mới",
  registrationOpenHint:
    "Tắt thì trang đăng ký từ chối mọi đăng ký mới. Học sinh đã có tài khoản vẫn đăng nhập bình thường.",
  singleSession: "Mỗi tài khoản chỉ đăng nhập một nơi",
  singleSessionHint:
    "Bật thì lần đăng nhập mới sẽ đăng xuất các thiết bị khác của tài khoản đó.",
  aiEnabled: "Bật tính năng AI",
  aiEnabledHint: "Tắt thì mọi tính năng AI tạm dừng (giải thích, nhập đề).",
  aiDailyBudget: "Số lượt gọi AI tối đa mỗi ngày",
  aiDailyBudgetHint: "Từ 0 đến 5000 cho cả trang.",
  aiDailyBudgetError: "Nhập số nguyên từ 0 đến 5000.",
  announcement: "Thông báo cho học sinh",
  announcementHint:
    "Hiện ở đầu mọi trang học sinh. Tối đa 300 ký tự, chữ thường (không định dạng). Để trống để tắt.",
  announcementError: "Thông báo tối đa 300 ký tự.",
  announcementCount: (n: number, max: number) => `${n}/${max} ký tự`,
  save: "Lưu cài đặt",
  saving: "Đang lưu…",
  saved: "Đã lưu cài đặt.",
  unchanged: "Không có thay đổi nào để lưu.",
  notInScope:
    "Không có cài đặt thiết bị và công thức xếp hạng: trang không giới hạn thiết bị và chỉ dùng một công thức xếp hạng.",

  adminsSection: "Giáo viên và quản trị viên",
  adminsLead:
    "Mỗi giáo viên quản lý lớp và bài của riêng mình; giáo viên khác không thấy. Quản trị viên còn quản lý cài đặt, tài khoản và nhật ký.",
  adminsLabel: "Danh sách giáo viên và quản trị viên",
  adminsEmpty: "Chưa có tài khoản nào.",
  roleTeacher: "Giáo viên",
  roleAdmin: "Quản trị viên",
  you: "Bạn",
  username: (u: string) => `Tên đăng nhập ${u}`,
  lastLogin: (when: string) => `Đăng nhập gần nhất ${when}`,
  neverLoggedIn: "Chưa đăng nhập",

  createSection: "Thêm giáo viên",
  createLead:
    "Tài khoản mới đăng nhập bằng tên đăng nhập và mật khẩu bạn đặt. Hãy đưa mật khẩu cho người đó qua kênh riêng.",
  fullName: "Họ và tên",
  newUsername: "Tên đăng nhập",
  usernameHint: "3–32 ký tự: chữ thường, số, dấu . _ -, bắt đầu bằng chữ.",
  password: "Mật khẩu",
  passwordHint: "Ít nhất 8 ký tự, không chỉ gồm chữ số.",
  role: "Vai trò",
  roleTeacherHint: "Giáo viên: tạo lớp, thêm học sinh, soạn và giao bài.",
  roleAdminHint: "Quản trị viên: như giáo viên, thêm quản lý toàn trang.",
  create: "Tạo tài khoản",
  creating: "Đang tạo…",
  created: (name: string) => `Đã tạo tài khoản cho ${name}.`,
} as const;
