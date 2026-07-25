const fs = require('fs');

const path = "F:/Roastery Operating System/ros-app/src/app/(dashboard)/laporan/actions.ts";
let content = fs.readFileSync(path, 'utf8');

const importRegex = /import \{ roastedBeanCostWAC, getRbCostPrioritizingCache, fgHppFromRecipe \} from "@\/lib\/costing";/;
const newImport = `import { roastedBeanCostWAC, getRbCostPrioritizingCache, fgHppFromRecipe, getFgHppPrioritizingCache } from "@/lib/costing";\nimport { weightedAverageCost } from "@/lib/financial-reporting";`;

content = content.replace(importRegex, newImport);

fs.writeFileSync(path, content, 'utf8');
console.log("Successfully patched laporan/actions.ts imports");
