export const MAX_STICKERS = 8;
export const NULL_STICKER_ID = "s000";

// bits are 1-based positions matching rounds 1..5.
// keep ids zero-padded so lexical sort == numeric sort.
export const STICKERS = [
  { id: "s000", src: "assets/stickers/s000.png", bits: [] }, // null fallback
  { id: "s001", src: "assets/stickers/s001.png", bits: [1] },
  { id: "s002", src: "assets/stickers/s002.png", bits: [2] },
  { id: "s003", src: "assets/stickers/s003.png", bits: [3] },
  { id: "s004", src: "assets/stickers/s004.png", bits: [4] },
  { id: "s005", src: "assets/stickers/s005.png", bits: [5] },
  { id: "s006", src: "assets/stickers/s006.png", bits: [1, 3] },
  { id: "s007", src: "assets/stickers/s007.png", bits: [2, 4] },
  { id: "s008", src: "assets/stickers/s008.png", bits: [3, 5] },
  { id: "s009", src: "assets/stickers/s009.png", bits: [1, 2, 3] },
  { id: "s010", src: "assets/stickers/s010.png", bits: [4, 5] }
];

