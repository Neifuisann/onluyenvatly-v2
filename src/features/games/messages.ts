/** Vietnamese copy for game rooms (B-05). */

import type { Pace, Racer } from "./domain/rules";
import type { MarkKind } from "./domain/scoring";

const vi = (n: number) => n.toLocaleString("vi-VN");

export const racerNames: Record<Racer, string> = {
  rabbit: "Thỏ",
  rocket: "Tên lửa",
  car: "Xe đua",
  bike: "Xe đạp",
  plane: "Máy bay",
  sailboat: "Thuyền buồm",
  turtle: "Rùa",
  cat: "Mèo",
};

export const colorNames = [
  "San hô",
  "Cam",
  "Vàng",
  "Lá",
  "Ngọc",
  "Biển",
  "Tím",
  "Hồng",
] as const;

export const paceCopy: Record<
  Pace,
  { name: string; hint: (mcq: number) => string }
> = {
  fast: { name: "Nhanh", hint: (s) => `${s} giây mỗi câu trắc nghiệm` },
  normal: { name: "Vừa", hint: (s) => `${s} giây mỗi câu trắc nghiệm` },
  relaxed: { name: "Thong thả", hint: (s) => `${s} giây mỗi câu trắc nghiệm` },
};

export const markCopy: Record<MarkKind, string> = {
  correct: "Chính xác!",
  partial: "Đúng một phần",
  wrong: "Chưa đúng",
  blank: "Bỏ qua",
  timeout: "Hết giờ!",
};

export const gameCopy = {
  admin: {
    title: "Thi đấu trực tiếp",
    lead: "Tạo phòng đua từ bài tập, chiếu mã phòng lên bảng và để cả lớp cùng tranh tài.",
    create: "Tạo phòng mới",
    listLabel: "Các phòng gần đây",
    emptyTitle: "Chưa có phòng nào",
    emptyBody:
      "Chọn bài và số câu, hệ thống trộn ngẫu nhiên thành một bộ đề cho cuộc đua.",
    pin: (pin: string) => `Mã ${pin}`,
    players: (n: number) => `${vi(n)} người chơi`,
    questions: (n: number) => `${vi(n)} câu`,
    open: "Mở màn hình chiếu",
    status: {
      lobby: "Đang chờ",
      running: "Đang đua",
      finished: "Đã kết thúc",
    } as const,
    loading: "Đang tải danh sách phòng",
    errorTitle: "Không tải được danh sách phòng",
  },
  create: {
    title: "Tạo phòng thi đấu",
    lead: "Bộ đề được rút ngẫu nhiên từ các bài bạn chọn. Mỗi học sinh nhận thứ tự câu và phương án riêng.",
    back: "Thi đấu",
    nameLabel: "Tên phòng",
    nameHint: "Không bắt buộc. Mặc định là tên bài đầu tiên.",
    namePlaceholder: "Ví dụ: Đua tốc độ chương Dao động",
    lessonsLabel: "Chọn bài",
    lessonsHint: (max: number) => `Tối đa ${max} bài.`,
    lessonSearch: "Tìm bài",
    lessonSearchPlaceholder: "Gõ tên bài, không cần dấu",
    lessonNone: "Không có bài nào khớp.",
    lessonHidden: "Đáp án đang ẩn",
    lessonHiddenHint:
      "Bài đang ẩn đáp án hoặc chưa đến giờ thi nên không dùng được: trò chơi hiện đáp án sau mỗi câu.",
    lessonCounts: (mcq: number, tf: number, short: number) =>
      [
        mcq && `${vi(mcq)} TN`,
        tf && `${vi(tf)} Đ/S`,
        short && `${vi(short)} TLN`,
      ]
        .filter(Boolean)
        .join(" · ") || "Chưa có câu hỏi",
    selected: (n: number) => `Đã chọn ${vi(n)} bài`,
    clear: "Bỏ chọn",
    typesLabel: "Loại câu hỏi",
    typeNames: {
      mcq: "Trắc nghiệm",
      tf: "Đúng/Sai",
      short: "Trả lời ngắn",
    } as const,
    countLabel: "Số câu trong bộ đề",
    paceLabel: "Nhịp độ",
    available: (n: number) => `${vi(n)} câu phù hợp trong các bài đã chọn`,
    summary: (count: number, pool: number) =>
      pool >= count
        ? `Rút ngẫu nhiên ${vi(count)} câu từ ${vi(pool)} câu.`
        : `Chỉ có ${vi(pool)} câu phù hợp: bộ đề sẽ có ${vi(pool)} câu.`,
    submit: "Tạo phòng",
    submitting: "Đang tạo phòng…",
    lessonUnavailable:
      "Có bài không còn dùng được. Tải lại trang rồi chọn lại.",
    notEnough: (n: number) =>
      `Cần ít nhất 5 câu phù hợp, các bài đã chọn chỉ có ${vi(n)} câu.`,
    defaultTitle: (first: string, more: number) =>
      more > 0 ? `${first} (+${more} bài)` : first,
    errorTitle: "Không mở được trang tạo phòng",
  },
  host: {
    pageTitle: "Màn hình chiếu",
    joinAt: "Vào trang",
    pinLabel: "Mã phòng",
    copyLink: "Sao chép liên kết",
    copied: "Đã sao chép",
    qrLabel: (url: string) => `Mã QR dẫn tới ${url}`,
    waiting: "Đang chờ học sinh vào phòng…",
    playerCount: (n: number) => `${vi(n)} người chơi`,
    start: "Bắt đầu đua",
    starting: "Đang bắt đầu…",
    noPlayers: "Cần ít nhất một người chơi để bắt đầu.",
    remove: (name: string) => `Mời ${name} rời phòng`,
    removeConfirm: (name: string) =>
      `Mời ${name} rời phòng? Bạn ấy sẽ không vào lại được.`,
    end: "Kết thúc",
    endConfirm: "Kết thúc cuộc đua cho cả lớp?",
    ending: "Đang kết thúc…",
    cancel: "Hủy",
    finishedCount: (done: number, total: number) =>
      `${vi(done)}/${vi(total)} đã về đích`,
    leaderboard: "Bảng xếp hạng",
    track: "Đường đua",
    podium: "Bục vinh quang",
    results: "Kết quả",
    hardest: "Câu cả lớp hay sai",
    accuracy: (pct: number) => `${vi(pct)}% đúng`,
    noAnswers: "Chưa ai trả lời",
    answeredOf: (n: number, total: number) =>
      `${vi(n)}/${vi(total)} người đã trả lời`,
    key: "Đáp án",
    replay: "Chơi lại",
    replaying: "Đang tạo phòng…",
    backToList: "Danh sách phòng",
    settings: (count: number, pace: string) =>
      `${vi(count)} câu · Nhịp ${pace}`,
    elapsed: "Thời gian",
    nobody: "Không có ai về đích.",
    connection: "Mất kết nối, đang thử lại…",
  },
  play: {
    pageTitle: "Thi đấu",
    enterTitle: "Vào phòng thi đấu",
    enterLead: "Nhập mã 6 chữ số giáo viên chiếu trên bảng.",
    pinLabel: "Mã phòng",
    pinPlaceholder: "123456",
    enter: "Vào phòng",
    badPin: "Mã phòng gồm 6 chữ số.",
    notFound: "Không tìm thấy phòng với mã này. Kiểm tra lại mã trên bảng nhé.",
    tooManyMisses: "Bạn nhập sai mã quá nhiều lần. Đợi vài phút rồi thử lại.",
    removed: "Giáo viên đã mời bạn rời phòng này.",
    finishedTitle: "Cuộc đua đã kết thúc",
    finishedBody: "Phòng này không nhận thêm người chơi.",
    back: "Về trang chủ",
    joinTitle: "Chọn tay đua của bạn",
    joinLead: (title: string) => `Phòng “${title}”`,
    racerLabel: "Tay đua",
    colorLabel: "Màu",
    join: "Vào phòng",
    joining: "Đang vào…",
    running: "Cuộc đua đang diễn ra. Vào là đua ngay!",
    lobbyTitle: "Bạn đã vào phòng!",
    lobbyWait: "Chờ giáo viên bắt đầu cuộc đua…",
    lobbyPlayers: (n: number) => `${vi(n)} người chơi trong phòng`,
    change: "Đổi tay đua",
    save: "Lưu",
    you: "Bạn",
    countdownGo: "Chạy!",
    getReady: "Chuẩn bị…",
    position: (i: number, n: number) => `Câu ${i}/${n}`,
    points: (n: number) => `${vi(n)} điểm`,
    pointsShort: (n: number) => vi(n),
    plusPoints: (n: number) => `+${vi(n)}`,
    streak: (n: number) => `Chuỗi ${vi(n)}`,
    timeLeft: (s: number) => `Còn ${vi(s)} giây`,
    answerLabel: (i: number) => `Các phương án của câu ${i}`,
    submit: "Chốt đáp án",
    shortPlaceholder: "Nhập đáp số",
    shortHint: "Dùng dấu phẩy hoặc dấu chấm cho phần thập phân.",
    tfTrue: "Đúng",
    tfFalse: "Sai",
    statement: (letter: string) => `Mệnh đề ${letter}`,
    keyWas: "Đáp án đúng",
    keyTf: (pairs: string) => `Đáp án: ${pairs}`,
    rank: (r: number) => `Hạng ${vi(r)}`,
    rankOf: (r: number, n: number) => `Hạng ${vi(r)}/${vi(n)}`,
    behind: (name: string, gap: number) => `Kém ${name} ${vi(gap)} điểm`,
    leading: "Bạn đang dẫn đầu!",
    finishTitle: "Về đích!",
    finishWait: "Chờ các bạn khác về đích…",
    finalTitle: "Kết quả chung cuộc",
    finalRank: (r: number) => `Hạng ${vi(r)}`,
    correctOf: (c: number, n: number) => `${vi(c)}/${vi(n)} câu đúng`,
    bestStreak: (n: number) => `Chuỗi dài nhất ${vi(n)}`,
    toDashboard: "Về trang chủ",
    another: "Vào phòng khác",
    retry: "Gửi lại",
    sending: "Đang gửi…",
    offline: "Mất kết nối. Đang gửi lại đáp án…",
    conflict: "Đang đồng bộ lại cuộc đua…",
    standingsLabel: "Bảng xếp hạng trực tiếp",
    dashboardTitle: "Thi đấu cùng lớp",
    dashboardBody: "Có mã phòng từ giáo viên? Vào đua ngay.",
    dashboardCta: "Nhập mã phòng",
  },
} as const;
