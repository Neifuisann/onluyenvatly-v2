/** Theory content (S8-02): labels the MDX components need. */
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
} as const;
