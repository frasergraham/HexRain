import { CHALLENGES, computeStarThresholds } from "../src/challenges";

function pad(s: string, n: number): string {
  return (s + " ".repeat(n)).slice(0, n);
}
function padL(s: string, n: number): string {
  return (" ".repeat(n) + s).slice(-n);
}

console.log(
  pad("id", 5),
  pad("name", 22),
  padL("diff", 5),
  padL("waves", 6),
  padL("1★", 14),
  padL("2★", 14),
  padL("3★+", 8),
);
console.log("-".repeat(76));
for (const c of CHALLENGES) {
  const t = computeStarThresholds(c);
  const oneRange = `${t.one}–${t.two - 1}`;
  const twoRange = `${t.two}–${t.three - 1}`;
  const threeRange = `${t.three}+`;
  const diff = "★".repeat(c.difficulty);
  console.log(
    pad(c.id, 5),
    pad(c.name, 22),
    padL(diff, 5),
    padL(String(c.waves.length), 6),
    padL(oneRange, 14),
    padL(twoRange, 14),
    padL(threeRange, 8),
  );
}
