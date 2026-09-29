/** AI explanations under each reviewed question (S7-02). */
export const explainCopy = {
  heading: "Giải thích của AI",
  teacherReviewed: "Giáo viên đã xem lại",
  disclaimer: "AI có thể nhầm. Hãy đối chiếu với đáp án ở trên.",
  ask: "Giải thích bằng AI",
  generating: "AI đang soạn lời giải thích…",
  retry: "Thử lại",
  failed: "Chưa tạo được lời giải thích. Bạn thử lại sau nhé.",
  /** ADR-007: Gemini down or switched off. */
  unavailable: "Giải thích đang được chuẩn bị. Bạn quay lại sau nhé.",
  /** 09 §2: the global budget is spent. */
  quota: "Hết lượt giải thích AI hôm nay, hãy thử lại vào ngày mai.",
  userLimit:
    "Bạn đã dùng hết lượt giải thích AI hôm nay, hãy thử lại vào ngày mai.",
  voteLabel: "Lời giải thích này có giúp bạn không?",
  up: "Hữu ích",
  down: "Chưa đúng hoặc khó hiểu",
  voteFailed: "Chưa ghi nhận được. Thử lại sau.",
} as const;
