import fs from "fs";

let content = fs.readFileSync("prisma/seed.ts", "utf-8");
content = content.replace(/'NALWENG'/g, "'KIMAISE'");
content = content.replace(/Nalweng Roastery/g, "kimaise");
content = content.replace(/system@ros.internal/g, "evm.dama26@gmail.com");

fs.writeFileSync("scripts/simulate-e2e.mts", content);
console.log("Successfully generated simulate-e2e.mts");
