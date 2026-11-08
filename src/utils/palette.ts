// Bold accent palette. One colour is picked per page view as `--pop`
// (hero, active nav, favicon); the rest are shuffled into `--dot-1..8`
// for section dots, hover fills and other small moments of play.
// All of these carry dark ink (`--text`) at AA contrast or better.
export const ACCENTS = [
  '#ffd43b', // sun (our yellow)
  '#ff6a3d', // tomato
  '#f7a1c4', // bubblegum
  '#b99af5', // lilac
  '#3aa3f5', // sky
  '#3fcf8e', // mint
];

export function pickAccent(exclude?: string) {
  const choices = exclude ? ACCENTS.filter(c => c !== exclude) : ACCENTS;
  return choices[Math.floor(Math.random() * choices.length)];
}
