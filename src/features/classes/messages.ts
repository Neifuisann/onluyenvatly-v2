/** Vietnamese copy for classes (B-03): the teacher's pages and the student's. */

export const classesCopy = {
  errors: {
    nameRequired: "Nhập tên lớp.",
    nameLong: "Tên lớp tối đa 80 ký tự.",
    descriptionLong: "Mô tả tối đa 300 ký tự.",
    tooMany: (n: number) => `Mỗi lần thêm tối đa ${n} số điện thoại.`,
    noPhones: "Nhập ít nhất một số điện thoại.",
    archived: "Lớp đã lưu trữ. Khôi phục lớp để thay đổi.",
  },

  // Teacher: list
  title: "Lớp học",
  lead: "Tạo lớp, thêm học sinh bằng số điện thoại và giao bài cho từng lớp. Giáo viên khác không thấy lớp và bài của bạn.",
  loading: "Đang tải lớp học",
  errorTitle: "Không tải được lớp học",
  emptyTitle: "Chưa có lớp nào",
  emptyBody:
    "Tạo lớp đầu tiên, rồi thêm học sinh và giao bài. Học sinh chỉ thấy bài của lớp mình.",
  listLabel: "Danh sách lớp",
  newClass: "Tạo lớp",
  newClassTitle: "Tạo lớp mới",
  members: (n: number) => `${n} học sinh`,
  requests: (n: number) => `${n} xin vào lớp`,
  lessons: (n: number) => `${n} bài`,
  archivedBadge: "Đã lưu trữ",
  showArchived: (n: number) => `Lớp đã lưu trữ (${n})`,

  // Teacher: form
  name: "Tên lớp",
  namePlaceholder: "Ví dụ: Vật lý 12A1",
  subject: "Môn học",
  grade: "Khối",
  gradeNone: "Không chọn",
  gradeOption: (g: number) => `Lớp ${g}`,
  description: "Mô tả",
  descriptionHint: "Học sinh thấy dòng này trên thẻ lớp. Không bắt buộc.",
  create: "Tạo lớp",
  creating: "Đang tạo…",
  save: "Lưu",
  saving: "Đang lưu…",
  saved: "Đã lưu.",
  cancel: "Hủy",
  close: "Đóng",
  confirm: "Xác nhận",

  // Teacher: detail
  back: "Tất cả lớp",
  notFoundTitle: "Không tìm thấy lớp",
  notFoundBody: "Lớp này không tồn tại, đã bị xóa hoặc không phải lớp của bạn.",
  settingsSection: "Thông tin lớp",
  membersSection: "Học sinh",
  membersLead:
    "Học sinh mở liên kết mời ở trên để xin vào lớp, bạn duyệt hoặc từ chối từng em. Bạn cũng có thể thêm em bằng số điện thoại em đã đăng ký. Một học sinh có thể ở nhiều lớp.",
  addMembers: "Thêm học sinh",
  addMembersLabel: "Số điện thoại học sinh",
  addMembersHint:
    "Mỗi dòng một số, hoặc cách nhau bằng dấu phẩy. Ví dụ: 0912 345 678.",
  adding: "Đang thêm…",
  added: (n: number) => `Đã thêm ${n} học sinh.`,
  already: (n: number) => `${n} em đã ở trong lớp.`,
  notFound: (phones: string) =>
    `Chưa có tài khoản học sinh: ${phones}. Nhờ các em đăng ký trước rồi thêm lại.`,
  invalid: (entries: string) => `Không đọc được số điện thoại: ${entries}.`,
  membersEmpty: "Lớp chưa có học sinh nào.",
  membersLabel: "Học sinh trong lớp",
  requestsLabel: "Học sinh xin vào lớp",
  requestBadge: "Chờ duyệt",
  requestedAt: (when: string) => `Xin vào lớp ${when}`,
  approve: "Duyệt",
  approveName: (name: string) => `Duyệt ${name} vào lớp`,
  approved: "Đã duyệt vào lớp.",
  reject: "Từ chối",
  rejectName: (name: string) => `Từ chối ${name}`,
  rejectConfirm: (name: string) =>
    `Từ chối ${name}? Em sẽ không vào lớp. Em vẫn có thể xin lại bằng liên kết mời, trừ khi bạn đổi liên kết.`,
  rejected: "Đã từ chối.",
  phone: "Số điện thoại",
  addedAt: (when: string) => `Vào lớp ${when}`,
  remove: "Xóa khỏi lớp",
  removeName: (name: string) => `Xóa ${name} khỏi lớp`,
  removeConfirm: (name: string) =>
    `Xóa ${name} khỏi lớp? Em sẽ không thấy bài của lớp nữa; bài đã làm vẫn giữ nguyên.`,
  removed: "Đã xóa khỏi lớp.",
  viewStudent: (name: string) => `Xem hồ sơ ${name}`,

  lessonsSection: "Bài của lớp",
  lessonsLead:
    "Chọn các bài đã xuất bản để giao cho lớp. Học sinh của lớp thấy ngay; bỏ chọn là thu bài về (kết quả đã làm vẫn giữ).",
  lessonsEmpty:
    "Bạn chưa có bài nào đã xuất bản. Soạn và xuất bản bài ở mục Bài tập trước.",
  lessonsLabel: "Bài có thể giao",
  lessonQuestions: (n: number) => `${n} câu`,
  lessonsSave: "Lưu bài của lớp",
  lessonsSaved: (add: number, remove: number) =>
    add || remove
      ? `Đã giao ${add} bài, thu về ${remove} bài.`
      : "Không có thay đổi.",
  selectedLessons: (n: number) => `Đã chọn ${n} bài`,
  filterLessons: "Tìm bài",

  inviteSection: "Liên kết mời vào lớp",
  inviteLead:
    "Gửi liên kết này qua Zalo hoặc Messenger. Học sinh đăng nhập (hoặc đăng ký) rồi bấm “Xin vào lớp”; em hiện trong danh sách học sinh bên dưới để bạn duyệt, không cần nhập số điện thoại.",
  inviteCode: "Mã lớp",
  inviteLink: "Liên kết mời",
  copyInvite: "Sao chép liên kết",
  inviteCopied: "Đã sao chép liên kết mời.",
  inviteCopyFailed: "Không sao chép được, bạn tự sao chép liên kết ở trên.",
  resetInvite: "Đổi liên kết",
  resetInviteConfirm:
    "Đổi liên kết mời? Liên kết và mã cũ sẽ không dùng được nữa; học sinh đã vào lớp vẫn ở trong lớp.",
  resetInviteDone: "Đã đổi liên kết mời. Liên kết cũ không còn dùng được.",

  join: {
    title: "Vào lớp học",
    lead: (teacher: string) => `${teacher} mời bạn vào lớp:`,
    lessonNote:
      "Khi giáo viên duyệt, mở lại liên kết này để vào thẳng bài giáo viên đã gửi.",
    join: "Xin vào lớp",
    joining: "Đang gửi…",
    pendingTitle: "Đã gửi yêu cầu vào lớp",
    pendingBody:
      "Giáo viên cần duyệt trước khi bạn vào lớp. Khi được duyệt, lớp sẽ hiện ở mục Lớp học của bạn.",
    toClasses: "Xem lớp của tôi",
    notFoundTitle: "Liên kết mời không còn dùng được",
    notFoundBody:
      "Lớp này không tồn tại, đã lưu trữ hoặc giáo viên đã đổi liên kết. Bạn xin giáo viên liên kết mới nhé.",
    staff:
      "Tài khoản giáo viên không vào lớp bằng liên kết mời. Đăng nhập bằng tài khoản học sinh để vào lớp.",
    staffTitle: "Đây là liên kết dành cho học sinh",
    toHome: "Về trang của tôi",
  },

  dangerSection: "Lưu trữ hoặc xóa lớp",
  archive: "Lưu trữ lớp",
  archiveLead:
    "Lớp lưu trữ ẩn với học sinh nhưng giữ nguyên học sinh và bài, khôi phục được bất cứ lúc nào.",
  restore: "Khôi phục lớp",
  deleteClass: "Xóa lớp",
  deleteConfirm: (name: string) =>
    `Xóa hẳn lớp "${name}"? Danh sách học sinh và bài giao của lớp mất; tài khoản và bài đã làm của học sinh vẫn giữ.`,

  // Student
  studentTitle: "Lớp học của tôi",
  studentLead: "Chọn một lớp để xem các bài giáo viên đã giao.",
  studentEmptyTitle: "Bạn chưa ở lớp nào",
  studentEmptyBody: (phone: string | null) =>
    phone
      ? `Mở liên kết mời giáo viên gửi để xin vào lớp, hoặc gửi số điện thoại ${phone} cho giáo viên. Bài của lớp sẽ hiện ra khi giáo viên duyệt.`
      : "Mở liên kết mời giáo viên gửi để xin vào lớp, hoặc gửi số điện thoại bạn dùng để đăng nhập cho giáo viên.",
  teacher: (name: string) => `Giáo viên: ${name}`,
  openClass: (name: string) => `Vào lớp ${name}`,
  classLessonsLead: "Các bài giáo viên đã giao cho lớp.",
  classEmptyTitle: "Lớp chưa có bài nào",
  classEmptyBody: "Giáo viên chưa giao bài cho lớp này. Bạn quay lại sau nhé.",
  allClasses: "Tất cả lớp",
} as const;
