/**
 * Luồng chuỗi 3 Đêm (thuần, không phụ thuộc DOM nên test được):
 * Menu chính -> giới thiệu Đêm -> chơi -> kết quả -> Đêm kế.
 * Thắng Đêm 3 thì hiện màn Bình Minh với tổng điểm. Thua thì được chơi lại đúng Đêm đó.
 */
export type Screen = "menu" | "intro" | "playing" | "result" | "dawn";
export type NightNo = 1 | 2 | 3;

export interface Flow {
  screen: Screen;
  night: NightNo;
  /** Tổng điểm các Đêm đã thắng. */
  total: number;
  /** Điểm của Đêm vừa chơi xong (hiện ở màn kết quả). */
  lastScore: number;
  lastWon: boolean;
  /** Số Đêm đã thắng trong lượt chơi này (cho bảng xếp hạng). */
  nightsWon: number;
}

export const initialFlow = (): Flow => ({ screen: "menu", night: 1, total: 0, lastScore: 0, lastWon: false, nightsWon: 0 });

/** Menu chính -> giới thiệu Đêm 1, xóa tổng điểm. */
export function newGame(): Flow {
  return { screen: "intro", night: 1, total: 0, lastScore: 0, lastWon: false, nightsWon: 0 };
}

/** Chọn Đêm từ menu: vào thẳng phần giới thiệu của Đêm đó, tổng điểm bắt đầu từ 0. */
export function startAt(night: NightNo): Flow {
  return { screen: "intro", night, total: 0, lastScore: 0, lastWon: false, nightsWon: 0 };
}

/** Giới thiệu Đêm -> chơi. */
export function beginNight(f: Flow): Flow {
  return f.screen === "intro" ? { ...f, screen: "playing" } : f;
}

/** Kết thúc một Đêm: thắng thì cộng điểm vào tổng; thắng Đêm 3 thì sang màn Bình Minh. */
export function finishNight(f: Flow, won: boolean, score: number): Flow {
  if (f.screen !== "playing") return f;
  if (won) {
    const total = f.total + score;
    const nightsWon = f.nightsWon + 1;
    return f.night === 3
      ? { ...f, screen: "dawn", total, lastScore: score, lastWon: true, nightsWon }
      : { ...f, screen: "result", total, lastScore: score, lastWon: true, nightsWon };
  }
  return { ...f, screen: "result", lastScore: score, lastWon: false };
}

/** Từ màn kết quả: thắng thì tới giới thiệu Đêm kế; thua thì chơi lại đúng Đêm đó. */
export function nextAfterResult(f: Flow): Flow {
  if (f.screen !== "result") return f;
  if (f.lastWon && f.night < 3) return { ...f, screen: "intro", night: (f.night + 1) as NightNo };
  return { ...f, screen: "intro" };
}

/** Chơi lại Đêm đang chơi (từ menu tạm dừng): không đổi tổng điểm. */
export function retryNight(f: Flow): Flow {
  return { ...f, screen: "intro" };
}

export const backToMenu = (): Flow => initialFlow();

export const NIGHT_INFO: Record<NightNo, { name: string; lines: string[] }> = {
  1: {
    name: "Đảo Bến",
    lines: [
      "Cháu của ông ơi, sương đen đã nuốt hết ánh sáng của Đảo Bến.",
      "Nhặt đom đóm nạp cho năm Đèn Lồng Lớn. Nhưng đèn cạn dầu thì tắt, nên phải châm thêm đom đóm cho đèn.",
      "Giữ ít nhất 3 ngọn sáng tới bình minh (4 phút) là cháu thắng.",
    ],
  },
  2: {
    name: "Đảo Cau",
    lines: [
      "Hai hòn đảo nằm cách nhau một chiếc cầu tre không lan can, cháu bước cho vững.",
      "Gió Lạc hay lượn quanh người mang nhiều đom đóm để cướp. Nhớ tỏa sáng đuổi chúng đi.",
      "Lá bùa đỏ giữa cầu sẽ giúp cháu chạy nhanh hơn. Cần giữ ít nhất 4 trong 6 ngọn đèn sáng tới bình minh.",
    ],
  },
  3: {
    name: "Đảo Chuông",
    lines: [
      "Đêm cuối rồi cháu. Đảo Chuông có ba tầng, dốc ở hai bên, bục nhảy sẽ đưa cháu lên đỉnh.",
      "Có gió mạnh thổi từng cơn. Thấy lá bay thì vịn cho chắc.",
      "Bóng Mực thích hút dầu của đèn yếu. Giữ ít nhất 5 trong 7 ngọn đèn sáng tới bình minh nhé.",
    ],
  },
};
