/**
 * `/privacy` and `/terms` (05 §1): short Vietnamese policies that say only
 * what the site does (06 §5). Update them with the code when behaviour changes.
 */
export type PolicySection = { title: string; body: string[] };
export type Policy = {
  title: string;
  lead: string;
  updated: string;
  sections: PolicySection[];
};

export const privacyPolicy: Policy = {
  title: "Quyền riêng tư",
  lead: "Ôn Luyện Vật Lý là trang luyện đề của một lớp học. Trang này nói rõ chúng tôi giữ dữ liệu gì, dùng vào việc gì và bạn tự quản lý dữ liệu của mình ra sao.",
  updated: "30/09/2026",
  sections: [
    {
      title: "Dữ liệu chúng tôi giữ",
      body: [
        "Khi đăng ký: họ tên, số điện thoại (dùng để đăng nhập), ngày sinh, khối và lớp. Mật khẩu chỉ được lưu dưới dạng mã hóa một chiều, không ai đọc được.",
        "Khi học: các bài bạn làm, câu trả lời, điểm, rating và các câu cần ôn.",
        "Khi đăng nhập: thiết bị, trình duyệt và địa chỉ IP của từng phiên, để bạn và giáo viên thấy tài khoản đang đăng nhập ở đâu.",
      ],
    },
    {
      title: "Chúng tôi dùng dữ liệu để làm gì",
      body: [
        "Chấm điểm, tính rating, gom câu sai để bạn ôn lại, và giúp giáo viên theo dõi tiến bộ của lớp.",
        "Không quảng cáo, không bán hay chia sẻ dữ liệu cho bên khác để tiếp thị.",
      ],
    },
    {
      title: "Ai nhìn thấy gì",
      body: [
        "Giáo viên (quản trị viên) xem được hồ sơ và bài làm của học sinh trong lớp.",
        "Bảng xếp hạng hiện họ tên (hoặc chỉ tên viết tắt nếu bạn chọn trong Cài đặt), lớp, hạng và rating. Số điện thoại và ngày sinh không bao giờ hiện công khai.",
        "Trang chia sẻ bài tập chỉ hiện thông tin bài và vài câu hỏi xem trước, không có dữ liệu của học sinh.",
      ],
    },
    {
      title: "Trí tuệ nhân tạo (AI)",
      body: [
        "Khi bạn bấm “Giải thích bằng AI”, nội dung câu hỏi và đáp án được gửi tới Google Gemini để viết lời giải. Không gửi tên, số điện thoại hay thông tin cá nhân nào của bạn.",
      ],
    },
    {
      title: "Lưu trữ",
      body: [
        "Dữ liệu được lưu trên dịch vụ đám mây (Supabase, Vercel). Địa chỉ IP của phiên đăng nhập bị xóa khi phiên hết hạn, của bài làm sau 180 ngày.",
      ],
    },
    {
      title: "Quyền của bạn",
      body: [
        "Sửa họ tên, ngày sinh, khối, lớp và ảnh đại diện trong Cài đặt tài khoản.",
        "Tải về toàn bộ dữ liệu của bạn dưới dạng tệp JSON (Cài đặt → Dữ liệu của tôi).",
        "Đăng xuất các thiết bị khác, và gửi yêu cầu xóa tài khoản. Khi giáo viên xử lý, tài khoản cùng toàn bộ bài làm và rating bị xóa vĩnh viễn.",
      ],
    },
    {
      title: "Liên hệ",
      body: [
        "Có câu hỏi về dữ liệu của bạn, hãy hỏi trực tiếp giáo viên phụ trách lớp.",
      ],
    },
  ],
};

export const termsPolicy: Policy = {
  title: "Điều khoản sử dụng",
  lead: "Vài quy định ngắn để lớp học luyện đề công bằng và an toàn.",
  updated: "30/09/2026",
  sections: [
    {
      title: "Tài khoản",
      body: [
        "Mỗi học sinh dùng một tài khoản của chính mình, với thông tin thật. Giáo viên duyệt tài khoản trước khi bạn làm bài.",
        "Giữ kín mật khẩu. Nếu nghi ngờ có người khác dùng tài khoản, hãy đổi mật khẩu và đăng xuất các thiết bị khác trong Cài đặt.",
      ],
    },
    {
      title: "Làm bài trung thực",
      body: [
        "Không nhờ người khác làm hộ, không chia sẻ đề thi đang mở. Bài ở chế độ thi ghi nhận khi bạn rời khỏi trang làm bài.",
        "Giáo viên có thể xóa bài làm, khóa hoặc xóa tài khoản vi phạm.",
      ],
    },
    {
      title: "Nội dung",
      body: [
        "Đề bài, lời giải và tài liệu lý thuyết thuộc về giáo viên và nguồn được ghi rõ; chỉ dùng cho việc học, không đăng lại để kinh doanh.",
        "Lời giải bằng AI có thể sai. Khi thấy chưa đúng, hãy đánh giá 👎 để giáo viên xem lại.",
      ],
    },
    {
      title: "Dịch vụ",
      body: [
        "Trang miễn phí và có thể tạm ngừng để bảo trì. Bài làm được tự lưu, nhưng bạn nên nộp bài trước thời hạn.",
        "Điều khoản có thể được cập nhật; ngày cập nhật ghi ở đầu trang.",
      ],
    },
  ],
};
