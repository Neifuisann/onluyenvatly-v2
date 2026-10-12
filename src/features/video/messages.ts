/** "Học qua video": the student's player and the teacher's video panel. */
export const videoCopy = {
  back: "Về trang bài học",
  answered: (done: number, total: number) => `Đã trả lời ${done}/${total} câu`,
  play: "Phát",
  pause: "Tạm dừng",
  mute: "Tắt tiếng",
  unmute: "Bật tiếng",
  fullscreen: "Toàn màn hình",
  exitFullscreen: "Thoát toàn màn hình",
  progress: "Tiến độ video",
  progressText: (now: string, total: string) => `${now} trên ${total}`,
  noSkip: "Chưa tua tới được: hãy xem hết video một lần.",
  noSkipShort: "Không tua tới",
  cueMarker: (time: string, done: boolean) =>
    `Câu hỏi ở ${time}${done ? " (đã trả lời)" : ""}`,
  endMarker: "Câu hỏi cuối video",
  loading: "Đang tải video…",
  startHint: "Bấm nút phát để bắt đầu xem.",
  resumeHint: (time: string) => `Bấm nút phát để xem tiếp từ ${time}.`,
  pausedAway: "Video đã tạm dừng vì bạn rời khỏi trang.",
  error: "Không phát được video. Kiểm tra mạng rồi tải lại trang.",
  errorEmbed:
    "Video này không phát được ở đây (đã bị xóa, để riêng tư hoặc chủ video không cho nhúng). Báo giáo viên nhé.",
  reload: "Tải lại trang",
  cueTitle: (time: string | null) =>
    time ? `Câu hỏi tại ${time}` : "Câu hỏi cuối video",
  cueLead: (n: number) =>
    n === 1
      ? "Trả lời câu hỏi để xem tiếp."
      : `Trả lời cả ${n} câu để xem tiếp.`,
  answerAll: "Trả lời hết các câu ở trên để tiếp tục.",
  continue: "Tiếp tục xem",
  finishCue: "Nộp bài",
  sending: "Đang lưu câu trả lời…",
  sendFailed: "Chưa lưu được câu trả lời. Kiểm tra mạng rồi thử lại.",
  finishing: "Đang chấm bài…",
  finishFailed: "Chưa nộp được bài. Thử lại nhé.",
  retry: "Thử lại",
  ended: "Bạn đã xem hết video.",
  replayTitle: "Xem lại video",
  replayLead:
    "Bạn đã xem xong nên được tua tự do. Chấm vàng trên thanh thời gian là chỗ có câu hỏi.",
} as const;

/** The teacher's video panel in the editor's content step. */
export const videoEditorCopy = {
  title: "Video bài học",
  noVideo:
    "Bài này chưa có video. Dán link YouTube ở bước Cài đặt (Hình thức: Học qua video).",
  lead: "Phát video, dừng ở chỗ muốn hỏi rồi bấm “Gắn vào” trên thẻ câu hỏi. Nhiều câu cùng một mốc sẽ hỏi liền nhau. Câu chưa gắn mốc được hỏi khi video kết thúc.",
  current: (time: string) => `Đang ở ${time}`,
  length: (time: string) => `Video dài ${time}`,
  cues: (n: number) => `${n} mốc câu hỏi`,
  atEnd: (n: number) => `${n} câu hỏi cuối video`,
  pastEnd: (n: number) =>
    `${n} câu có mốc sau khi video kết thúc; các câu này sẽ được hỏi cuối video.`,
  attach: (time: string) => `Gắn vào ${time}`,
  attachQuestion: (n: number, time: string) => `Gắn câu ${n} vào ${time}`,
  stopTitle: (time: string, questions: readonly number[]) =>
    `${time}: câu ${questions.join(", ")}`,
  error: "Không phát được video này. Kiểm tra lại link ở bước Cài đặt.",
  detach: "Bỏ mốc",
  at: (time: string) => `Hỏi ở ${time}`,
  atEndChip: "Hỏi cuối video",
  seekTo: (time: string) => `Tua video tới ${time}`,
  attached: (n: number, time: string) => `Đã gắn câu ${n} vào ${time}.`,
  detached: (n: number) => `Câu ${n} sẽ được hỏi cuối video.`,
} as const;
