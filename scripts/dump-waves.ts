import { CHALLENGES } from "../src/challenges";

const id = process.argv[2] ?? "6-5";
const c = CHALLENGES.find((x) => x.id === id);
if (!c) { console.error("not found:", id); process.exit(1); }

console.log(`${c.id} — ${c.name} (difficulty ${c.difficulty}, ${c.waves.length} waves)`);
console.log("effects:", c.effects ?? {});
console.log();
c.waves.forEach((w, i) => {
  console.log(`${String(i + 1).padStart(3)}. ${w}`);
});
