/** Theory pages (S8-02): `/ly-thuyet`, its topic pages and the MDX labels. */
export const materialsCopy = {
  grade: (g: number) => `Lớp ${g}`,
  externalHint: "(trang ngoài)",
  table: "Bảng",
  callout: {
    definition: "Định nghĩa",
    example: "Ví dụ",
    note: "Ghi chú",
    warning: "Lưu ý",
    practice: "Bài tập",
    solution: "Lời giải",
    related: "Bài liên quan",
    formula: "Công thức",
  },
  indexTitle: "Lý thuyết Vật lý",
  indexLead:
    "Tóm tắt lý thuyết, công thức và ví dụ có lời giải cho chương trình Vật lý 10, 11 và 12. Đọc tự do, không cần tài khoản.",
  gradeNav: "Chọn lớp",
  topicCount: (n: number) => `${n} bài`,
  chapterLinks: "Tài liệu tham khảo",
  searchLabel: "Tìm bài lý thuyết",
  searchPlaceholder: "Ví dụ: con lắc đơn, dao dong…",
  searchResults: (n: number, q: string) =>
    n ? `${n} bài khớp với “${q}”` : `Không có bài nào khớp với “${q}”`,
  searchEmptyHint: "Thử từ khóa ngắn hơn, có thể gõ không dấu.",
  breadcrumb: "Vị trí trang",
  subtopics: "Trong bài này",
  previous: "Bài trước",
  next: "Bài tiếp theo",
  pager: "Bài trong chương",
  backToIndex: "Tất cả bài lý thuyết",
  practiceTitle: "Luyện đề sau khi đọc",
  practiceBody:
    "Làm bài tập theo chương để nhớ lâu hơn và biết mình còn sai ở đâu.",
  practiceCta: "Luyện đề",
} as const;
