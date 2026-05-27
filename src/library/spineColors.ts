// A small palette of book-cloth colours with a matching foil ink, chosen
// deterministically from a seed so each uploaded PDF gets a stable spine look.
const PALETTE = [
  { bg: "#7a2230", ink: "#e9c98a" }, // maroon
  { bg: "#243b6b", ink: "#cdd6f0" }, // navy
  { bg: "#5b4a2e", ink: "#e6d2a8" }, // tan
  { bg: "#3d5a3a", ink: "#e3d39a" }, // olive
  { bg: "#4a2f55", ink: "#e0c9ec" }, // plum
  { bg: "#8a4b22", ink: "#f0d9b5" }, // rust
  { bg: "#2f5d5a", ink: "#d8b46a" }, // teal
];

export function spineColors(seed: string): { bg: string; ink: string } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
