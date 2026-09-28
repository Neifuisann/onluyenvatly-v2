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
  back: "Về danh sách bài tập",
  structure: "Cấu trúc đề",
  rules: "Trước khi làm bài",
  duration: "Thời gian",
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
  columns: {
    order: "Thứ tự",
    title: "Tên bài",
    status: "Trạng thái",
    grade: "Khối",
    questions: "Số câu",
    attempts: "Lượt làm",
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
} as const;
