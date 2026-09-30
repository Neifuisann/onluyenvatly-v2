/** `/settings` (S8-04): the student's own account. */
export const accountCopy = {
  title: "Cài đặt tài khoản",
  lead: "Thông tin cá nhân, ảnh đại diện, thiết bị đăng nhập và dữ liệu của bạn.",
  back: "Về trang cá nhân",
  loading: "Đang tải cài đặt",
  errorTitle: "Không tải được cài đặt",
  errorBody: "Có lỗi khi tải trang. Bạn thử lại nhé.",
  retry: "Thử lại",
  openSettings: "Cài đặt tài khoản",

  avatarTitle: "Ảnh đại diện",
  avatarLead: "Ảnh được cắt vuông và thu nhỏ trên máy bạn trước khi tải lên.",
  avatarAlt: "Ảnh đại diện của bạn",
  avatarChoose: "Chọn ảnh",
  avatarChange: "Đổi ảnh",
  avatarRemove: "Xóa ảnh",
  avatarUploading: "Đang tải ảnh lên…",
  avatarSaved: "Đã cập nhật ảnh đại diện.",
  avatarRemoved: "Đã xóa ảnh đại diện.",
  avatarNotImage: "Tệp này không phải ảnh. Hãy chọn ảnh PNG, JPG hoặc WebP.",
  avatarFailed: "Không xử lý được ảnh này. Bạn thử ảnh khác nhé.",
  avatarUploadFailed: "Tải ảnh lên không thành công. Bạn thử lại nhé.",
  avatarUnavailable: "Chưa thể tải ảnh lên lúc này.",

  profileTitle: "Thông tin cá nhân",
  profileLead: "Tên và lớp hiện trên bảng xếp hạng.",
  phone: "Số điện thoại đăng nhập",
  phoneHint: "Muốn đổi số điện thoại, bạn nhờ giáo viên.",
  username: "Tên đăng nhập",
  profileSave: "Lưu thông tin",
  profileSaving: "Đang lưu…",
  profileSaved: "Đã lưu thông tin.",
  profileUnchanged: "Không có gì thay đổi.",

  passwordTitle: "Mật khẩu",
  passwordLead:
    "Nên đổi mật khẩu nếu bạn từng đăng nhập trên máy của người khác.",
  passwordCta: "Đổi mật khẩu",

  privacyTitle: "Quyền riêng tư",
  initialsLabel: "Chỉ hiện tên viết tắt trên bảng xếp hạng",
  initialsHint: "Ví dụ “N.V.A” thay cho họ tên đầy đủ. Lớp và điểm vẫn hiện.",
  privacySaved: "Đã lưu lựa chọn.",

  sessionsTitle: "Thiết bị đăng nhập",
  sessionsLead: "Các thiết bị đang đăng nhập tài khoản của bạn.",
  sessionsEmpty: "Không có thiết bị nào khác.",
  thisDevice: "Thiết bị này",
  unknownDevice: "Trình duyệt không rõ",
  lastSeen: (when: string) => `Hoạt động lần cuối ${when}`,
  signedIn: (when: string) => `Đăng nhập ${when}`,
  revoke: "Đăng xuất",
  revokeLabel: (device: string) => `Đăng xuất ${device}`,
  revoked: "Đã đăng xuất thiết bị đó.",

  exportTitle: "Dữ liệu của tôi",
  exportLead:
    "Tải về một tệp JSON gồm thông tin cá nhân, các bài đã làm, lịch sử rating và câu cần ôn.",
  exportCta: "Tải dữ liệu",

  deleteTitle: "Xóa tài khoản",
  deleteLead:
    "Gửi yêu cầu để giáo viên xóa tài khoản và toàn bộ bài làm của bạn. Bạn có thể hủy trước khi giáo viên xử lý.",
  deletePassword: "Nhập mật khẩu để xác nhận",
  deleteSubmit: "Gửi yêu cầu xóa",
  deleteSubmitting: "Đang gửi…",
  deleteConfirm:
    "Gửi yêu cầu xóa tài khoản? Khi giáo viên xử lý, bài làm và rating của bạn sẽ bị xóa vĩnh viễn.",
  deleteRequested: (when: string) =>
    `Bạn đã gửi yêu cầu xóa tài khoản lúc ${when}. Giáo viên sẽ xử lý sớm.`,
  deleteCancel: "Hủy yêu cầu",
  deleteKeep: "Không, giữ tài khoản",
  close: "Đóng",
  deleteCancelled: "Đã hủy yêu cầu xóa tài khoản.",
  deleteAdmin: "Tài khoản giáo viên không gửi yêu cầu xóa ở đây.",
} as const;
