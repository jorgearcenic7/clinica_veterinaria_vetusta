import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import ts from "typescript";

// Los scripts clásicos de la home comparten un único ámbito global: un `const`
// o `function` en el nivel superior de uno choca con el mismo nombre en otro
// y rompe la página entera. Por eso cada uno debe quedarse en expresiones
// (una función autoejecutada o `window.Vetusta... = ...`).
const classicScripts = [
  "frontend/i18n/es.js",
  "frontend/i18n/en.js",
  "frontend/i18n/fr.js",
  "frontend/i18n/pt.js",
  "frontend/i18n.js",
  "frontend/image-sources.js",
  "frontend/reviews.js",
  "frontend/booking.js",
];

function topLevelDeclarations(path) {
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
  return source.statements
    .filter((statement) => !ts.isExpressionStatement(statement))
    .map((statement) => `${ts.SyntaxKind[statement.kind]}: ${statement.getText(source).split("\n")[0]}`);
}

describe("scripts clásicos de la home", () => {
  it.each(classicScripts)("%s no declara nada en el ámbito global", (path) => {
    expect(topLevelDeclarations(path)).toEqual([]);
  });

  it("los cuatro idiomas tienen exactamente las mismas claves", () => {
    const keysByLanguage = Object.fromEntries(
      ["es", "en", "fr", "pt"].map((language) => {
        const window = {};
        new Function("window", readFileSync(`frontend/i18n/${language}.js`, "utf8"))(window);
        return [language, Object.keys(window.VetustaTranslations[language]).sort()];
      }),
    );

    expect(keysByLanguage.en).toEqual(keysByLanguage.es);
    expect(keysByLanguage.fr).toEqual(keysByLanguage.es);
    expect(keysByLanguage.pt).toEqual(keysByLanguage.es);
  });
});
