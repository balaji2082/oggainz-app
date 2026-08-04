/**
 * Let plain `node` import the app's TypeScript the way Next.js does.
 *
 * Next resolves `./commandcenter` to `./commandcenter.ts` and `@/lib/x` to
 * `<root>/lib/x.ts`. Node does neither — it wants the exact filename. Rather
 * than write imports in the source that suit the test runner instead of the
 * framework, this teaches the test runner the two rules.
 *
 * Import it first, before importing anything from lib/:
 *
 *     import "./_resolve-ts.mjs";
 *     const { getProfile } = await import("../lib/profiles.ts");
 */

import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

registerHooks({
  resolve(specifier, context, nextResolve) {
    // "@/lib/profiles" -> "<root>/lib/profiles.ts"  (the tsconfig paths alias)
    if (specifier.startsWith("@/")) {
      const base = join(ROOT, specifier.slice(2));
      for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
        if (existsSync(candidate)) {
          return { url: pathToFileURL(candidate).href, shortCircuit: true };
        }
      }
    }
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      // "./commandcenter" -> "./commandcenter.ts"
      if (specifier.startsWith(".")) {
        for (const ext of [".ts", ".tsx"]) {
          try {
            return nextResolve(specifier + ext, context);
          } catch {
            /* try the next extension */
          }
        }
      }
      throw error;
    }
  },
});
