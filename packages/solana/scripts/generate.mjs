// Regenerate the typed program client from the Anchor IDL.
// Run after `anchor build` (which writes target/idl/gridflex.json).
import { copyFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createFromRoot } from "codama";
import { rootNodeFromAnchor } from "@codama/nodes-from-anchor";
import { renderVisitor } from "@codama/renderers-js";

const pkg = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const idlPath = path.join(pkg, "idl/gridflex.json");
copyFileSync(path.resolve(pkg, "../../target/idl/gridflex.json"), idlPath);

const codama = createFromRoot(rootNodeFromAnchor(JSON.parse(readFileSync(idlPath, "utf8"))));
await codama.accept(
  renderVisitor(pkg, {
    generatedFolder: "src/generated",
    kitImportStrategy: "rootOnly",
    syncPackageJson: false,
  }),
);
console.log("Generated src/generated from idl/gridflex.json");
