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
