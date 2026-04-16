import type { PatternCategory, PatternOccurrence, LanguageId } from '../types.js';

export interface DetectedPattern {
  fingerprint: string;
  category: PatternCategory;
  subcategory: string;
  summary: string;
  ruleText: string;
  before: string;
  after: string;
}

interface DetectorContext {
  removedLines: string[];
  addedLines: string[];
  language: LanguageId;
  filePath: string;
}

type Detector = (ctx: DetectorContext) => DetectedPattern[];

const detectors: Detector[] = [
  detectSemicolonPreference,
  detectQuotePreference,
  detectTrailingComma,
  detectArrowFunctionPreference,
  detectGuardClause,
  detectDestructuring,
  detectOptionalChaining,
  detectTemplateStrings,
  detectImportType,
  detectImportOrdering,
  detectTypeAnnotations,
  detectUnknownOverAny,
  detectInterfaceVsType,
  detectAsyncAwait,
  detectNamingConventions,
  detectCommentChanges,
  detectErrorHandling,
  detectEarlyReturn,
  detectObjectShorthand,
  detectNullishCoalescing,
  detectExplicitReturnType,
  detectNamedExports,
  detectConstAssertions,
];

export function extractPatterns(
  removedLines: string[],
  addedLines: string[],
  language: LanguageId,
  filePath: string
): DetectedPattern[] {
  const ctx: DetectorContext = { removedLines, addedLines, language, filePath };
  const results: DetectedPattern[] = [];

  for (const detector of detectors) {
    try {
      results.push(...detector(ctx));
    } catch {
      // individual detector failure shouldn't block others
    }
  }

  return results;
}

// --- Individual detectors ---

function detectSemicolonPreference(ctx: DetectorContext): DetectedPattern[] {
  if (ctx.language !== 'typescript' && ctx.language !== 'javascript') return [];

  const removedWithSemi = ctx.removedLines.filter(l => l.trimEnd().endsWith(';'));
  const addedWithoutSemi = ctx.addedLines.filter(l => {
    const t = l.trimEnd();
    return t.length > 0 && !t.endsWith(';') && !t.endsWith('{') && !t.endsWith('}') && !t.endsWith(',');
  });

  if (removedWithSemi.length >= 2 && addedWithoutSemi.length >= 2) {
    return [{
      fingerprint: 'formatting:no-semicolons',
      category: 'formatting',
      subcategory: 'semicolons',
      summary: 'Removes semicolons',
      ruleText: 'Omit semicolons at the end of statements.',
      before: removedWithSemi[0].trim(),
      after: addedWithoutSemi[0].trim(),
    }];
  }

  const removedNoSemi = ctx.removedLines.filter(l => {
    const t = l.trimEnd();
    return t.length > 0 && !t.endsWith(';') && !t.endsWith('{') && !t.endsWith('}');
  });
  const addedWithSemi = ctx.addedLines.filter(l => l.trimEnd().endsWith(';'));

  if (removedNoSemi.length >= 2 && addedWithSemi.length >= 2) {
    return [{
      fingerprint: 'formatting:use-semicolons',
      category: 'formatting',
      subcategory: 'semicolons',
      summary: 'Adds semicolons',
      ruleText: 'Use semicolons at the end of statements.',
      before: removedNoSemi[0].trim(),
      after: addedWithSemi[0].trim(),
    }];
  }

  return [];
}

function detectQuotePreference(ctx: DetectorContext): DetectedPattern[] {
  if (ctx.language !== 'typescript' && ctx.language !== 'javascript') return [];

  const doubleToSingle = ctx.removedLines.filter(l => l.includes('"')).length > 0
    && ctx.addedLines.filter(l => l.includes("'") && !l.includes('"')).length > 0;
  const singleToDouble = ctx.removedLines.filter(l => l.includes("'")).length > 0
    && ctx.addedLines.filter(l => l.includes('"') && !l.includes("'")).length > 0;

  const results: DetectedPattern[] = [];

  if (doubleToSingle && !singleToDouble) {
    const before = ctx.removedLines.find(l => l.includes('"')) ?? '';
    const after = ctx.addedLines.find(l => l.includes("'")) ?? '';
    results.push({
      fingerprint: 'formatting:single-quotes',
      category: 'formatting',
      subcategory: 'quotes',
      summary: 'Prefers single quotes',
      ruleText: 'Use single quotes for strings instead of double quotes.',
      before: before.trim(),
      after: after.trim(),
    });
  } else if (singleToDouble && !doubleToSingle) {
    const before = ctx.removedLines.find(l => l.includes("'")) ?? '';
    const after = ctx.addedLines.find(l => l.includes('"')) ?? '';
    results.push({
      fingerprint: 'formatting:double-quotes',
      category: 'formatting',
      subcategory: 'quotes',
      summary: 'Prefers double quotes',
      ruleText: 'Use double quotes for strings instead of single quotes.',
      before: before.trim(),
      after: after.trim(),
    });
  }

  return results;
}

function detectTrailingComma(ctx: DetectorContext): DetectedPattern[] {
  const removedNoTrailing = ctx.removedLines.filter(l => {
    const t = l.trimEnd();
    return (t.endsWith('}') || t.endsWith(']') || t.endsWith(')'))
      && !t.endsWith(',}') && !t.endsWith(',]') && !t.endsWith(',)');
  });

  // Simplified: look for trailing comma additions on preceding lines
  const addedTrailing = ctx.addedLines.filter(l => {
    const t = l.trimEnd();
    return t.endsWith(',');
  });

  if (addedTrailing.length > removedNoTrailing.length && addedTrailing.length >= 2) {
    return [{
      fingerprint: 'formatting:trailing-commas',
      category: 'formatting',
      subcategory: 'trailing-commas',
      summary: 'Adds trailing commas',
      ruleText: 'Use trailing commas in multi-line objects, arrays, and function parameters.',
      before: ctx.removedLines[0]?.trim() ?? '',
      after: ctx.addedLines[0]?.trim() ?? '',
    }];
  }

  return [];
}

function detectArrowFunctionPreference(ctx: DetectorContext): DetectedPattern[] {
  if (ctx.language !== 'typescript' && ctx.language !== 'javascript') return [];

  const fnDecl = /\bfunction\s+\w+\s*\(/;
  const arrowFn = /\b(?:const|let)\s+\w+\s*=\s*(?:\([^)]*\)|[^=])\s*=>/;

  const removedFnDecl = ctx.removedLines.filter(l => fnDecl.test(l));
  const addedArrow = ctx.addedLines.filter(l => arrowFn.test(l));

  if (removedFnDecl.length >= 1 && addedArrow.length >= 1) {
    return [{
      fingerprint: 'syntax:arrow-functions',
      category: 'syntax',
      subcategory: 'arrow-functions',
      summary: 'Converts function declarations to arrow functions',
      ruleText: 'Use arrow function expressions (`const fn = () => {}`) instead of function declarations.',
      before: removedFnDecl[0].trim(),
      after: addedArrow[0].trim(),
    }];
  }

  const removedArrow = ctx.removedLines.filter(l => arrowFn.test(l));
  const addedFnDecl = ctx.addedLines.filter(l => fnDecl.test(l));

  if (removedArrow.length >= 1 && addedFnDecl.length >= 1) {
    return [{
      fingerprint: 'syntax:function-declarations',
      category: 'syntax',
      subcategory: 'function-declarations',
      summary: 'Converts arrow functions to function declarations',
      ruleText: 'Use function declarations instead of arrow function expressions.',
      before: removedArrow[0].trim(),
      after: addedFnDecl[0].trim(),
    }];
  }

  return [];
}

function detectGuardClause(ctx: DetectorContext): DetectedPattern[] {
  const nestedIf = /if\s*\([^)]+\)\s*\{/;
  const elseBlock = /\}\s*else\s*\{/;
  const earlyReturn = /^\s*(if\s*\([^)]+\)\s*(return|throw|continue|break))/;

  const removedNested = ctx.removedLines.filter(l => nestedIf.test(l) || elseBlock.test(l)).length;
  const addedGuards = ctx.addedLines.filter(l => earlyReturn.test(l)).length;

  if (removedNested >= 1 && addedGuards >= 1) {
    return [{
      fingerprint: 'control-flow:guard-clauses',
      category: 'control-flow',
      subcategory: 'guard-clauses',
      summary: 'Replaces nested conditionals with guard clauses',
      ruleText: 'Use early returns (guard clauses) instead of nested if/else blocks. Check for the error case and return early, keeping the main logic at the top indentation level.',
      before: ctx.removedLines.find(l => nestedIf.test(l))?.trim() ?? '',
      after: ctx.addedLines.find(l => earlyReturn.test(l))?.trim() ?? '',
    }];
  }

  return [];
}

function detectDestructuring(ctx: DetectorContext): DetectedPattern[] {
  if (ctx.language !== 'typescript' && ctx.language !== 'javascript') return [];

  const dotAccess = /\w+\.\w+/;
  const destructure = /(?:const|let|var)\s*\{[^}]+\}\s*=/;

  const removedDot = ctx.removedLines.filter(l => dotAccess.test(l) && !destructure.test(l)).length;
  const addedDestructure = ctx.addedLines.filter(l => destructure.test(l)).length;

  if (removedDot >= 2 && addedDestructure >= 1) {
    return [{
      fingerprint: 'syntax:destructuring',
      category: 'syntax',
      subcategory: 'destructuring',
      summary: 'Uses object destructuring',
      ruleText: 'Prefer object destructuring over repeated property access.',
      before: ctx.removedLines.find(l => dotAccess.test(l))?.trim() ?? '',
      after: ctx.addedLines.find(l => destructure.test(l))?.trim() ?? '',
    }];
  }

  return [];
}

function detectOptionalChaining(ctx: DetectorContext): DetectedPattern[] {
  if (ctx.language !== 'typescript' && ctx.language !== 'javascript') return [];

  const andAnd = /&&\s*\w+\./;
  const optChain = /\?\./;

  const removedAnd = ctx.removedLines.filter(l => andAnd.test(l)).length;
  const addedOpt = ctx.addedLines.filter(l => optChain.test(l)).length;

  if (removedAnd >= 1 && addedOpt >= 1) {
    return [{
      fingerprint: 'syntax:optional-chaining',
      category: 'syntax',
      subcategory: 'optional-chaining',
      summary: 'Uses optional chaining',
      ruleText: 'Use optional chaining (`?.`) instead of logical AND guards for property access.',
      before: ctx.removedLines.find(l => andAnd.test(l))?.trim() ?? '',
      after: ctx.addedLines.find(l => optChain.test(l))?.trim() ?? '',
    }];
  }

  return [];
}

function detectTemplateStrings(ctx: DetectorContext): DetectedPattern[] {
  if (ctx.language !== 'typescript' && ctx.language !== 'javascript') return [];

  const concat = /['"][^'"]*['"]\s*\+/;
  const template = /`[^`]*\$\{/;

  const removedConcat = ctx.removedLines.filter(l => concat.test(l)).length;
  const addedTemplate = ctx.addedLines.filter(l => template.test(l)).length;

  if (removedConcat >= 1 && addedTemplate >= 1) {
    return [{
      fingerprint: 'syntax:template-literals',
      category: 'syntax',
      subcategory: 'template-literals',
      summary: 'Uses template literals instead of string concatenation',
      ruleText: 'Use template literals instead of string concatenation.',
      before: ctx.removedLines.find(l => concat.test(l))?.trim() ?? '',
      after: ctx.addedLines.find(l => template.test(l))?.trim() ?? '',
    }];
  }

  return [];
}

function detectImportType(ctx: DetectorContext): DetectedPattern[] {
  if (ctx.language !== 'typescript') return [];

  const normalImport = /^import\s+\{/;
  const typeImport = /^import\s+type\s+\{/;

  const removedNormal = ctx.removedLines.filter(l => normalImport.test(l.trim())).length;
  const addedType = ctx.addedLines.filter(l => typeImport.test(l.trim())).length;

  if (removedNormal >= 1 && addedType >= 1) {
    return [{
      fingerprint: 'imports:import-type',
      category: 'imports',
      subcategory: 'import-type',
      summary: 'Uses import type for type-only imports',
      ruleText: 'Use `import type` when importing types that are not used as values.',
      before: ctx.removedLines.find(l => normalImport.test(l.trim()))?.trim() ?? '',
      after: ctx.addedLines.find(l => typeImport.test(l.trim()))?.trim() ?? '',
    }];
  }

  return [];
}

function detectImportOrdering(ctx: DetectorContext): DetectedPattern[] {
  if (ctx.language !== 'typescript' && ctx.language !== 'javascript') return [];

  const importLine = /^import\s/;
  const removedImports = ctx.removedLines.filter(l => importLine.test(l.trim()));
  const addedImports = ctx.addedLines.filter(l => importLine.test(l.trim()));

  if (removedImports.length >= 3 && addedImports.length >= 3) {
    const same = removedImports.every((l, i) => addedImports[i]?.trim() === l.trim());
    if (!same) {
      return [{
        fingerprint: 'imports:reordered',
        category: 'imports',
        subcategory: 'ordering',
        summary: 'Reorders imports',
        ruleText: 'Group and sort import statements. Place node/built-in imports first, then external packages, then internal modules.',
        before: removedImports.slice(0, 3).map(l => l.trim()).join('\n'),
        after: addedImports.slice(0, 3).map(l => l.trim()).join('\n'),
      }];
    }
  }

  return [];
}

function detectTypeAnnotations(ctx: DetectorContext): DetectedPattern[] {
  if (ctx.language !== 'typescript') return [];

  const withoutType = /(?:const|let|var)\s+\w+\s*=/;
  const withType = /(?:const|let|var)\s+\w+\s*:\s*\w/;

  const removedUntyped = ctx.removedLines.filter(l => withoutType.test(l) && !withType.test(l)).length;
  const addedTyped = ctx.addedLines.filter(l => withType.test(l)).length;

  if (removedUntyped >= 1 && addedTyped >= 1) {
    return [{
      fingerprint: 'types:explicit-annotations',
      category: 'types',
      subcategory: 'explicit-annotations',
      summary: 'Adds explicit type annotations',
      ruleText: 'Add explicit type annotations to variable declarations where the type is not obvious from the initializer.',
      before: ctx.removedLines.find(l => withoutType.test(l))?.trim() ?? '',
      after: ctx.addedLines.find(l => withType.test(l))?.trim() ?? '',
    }];
  }

  return [];
}

function detectUnknownOverAny(ctx: DetectorContext): DetectedPattern[] {
  if (ctx.language !== 'typescript') return [];

  const hasAny = /:\s*any\b/;
  const hasUnknown = /:\s*unknown\b/;

  const removedAny = ctx.removedLines.filter(l => hasAny.test(l)).length;
  const addedUnknown = ctx.addedLines.filter(l => hasUnknown.test(l)).length;

  if (removedAny >= 1 && addedUnknown >= 1) {
    return [{
      fingerprint: 'types:unknown-over-any',
      category: 'types',
      subcategory: 'unknown-over-any',
      summary: 'Replaces `any` with `unknown`',
      ruleText: 'Use `unknown` instead of `any`. Narrow the type with type guards before using the value.',
      before: ctx.removedLines.find(l => hasAny.test(l))?.trim() ?? '',
      after: ctx.addedLines.find(l => hasUnknown.test(l))?.trim() ?? '',
    }];
  }

  return [];
}

function detectInterfaceVsType(ctx: DetectorContext): DetectedPattern[] {
  if (ctx.language !== 'typescript') return [];

  const interfaceDecl = /^\s*(?:export\s+)?interface\s+/;
  const typeDecl = /^\s*(?:export\s+)?type\s+\w+\s*=/;

  const removedInterface = ctx.removedLines.filter(l => interfaceDecl.test(l)).length;
  const addedType = ctx.addedLines.filter(l => typeDecl.test(l)).length;

  if (removedInterface >= 1 && addedType >= 1) {
    return [{
      fingerprint: 'types:type-over-interface',
      category: 'types',
      subcategory: 'type-alias',
      summary: 'Prefers type aliases over interfaces',
      ruleText: 'Use `type` aliases instead of `interface` declarations for object types.',
      before: ctx.removedLines.find(l => interfaceDecl.test(l))?.trim() ?? '',
      after: ctx.addedLines.find(l => typeDecl.test(l))?.trim() ?? '',
    }];
  }

  const removedType = ctx.removedLines.filter(l => typeDecl.test(l)).length;
  const addedInterface = ctx.addedLines.filter(l => interfaceDecl.test(l)).length;

  if (removedType >= 1 && addedInterface >= 1) {
    return [{
      fingerprint: 'types:interface-over-type',
      category: 'types',
      subcategory: 'interface',
      summary: 'Prefers interfaces over type aliases',
      ruleText: 'Use `interface` declarations instead of `type` aliases for object types.',
      before: ctx.removedLines.find(l => typeDecl.test(l))?.trim() ?? '',
      after: ctx.addedLines.find(l => interfaceDecl.test(l))?.trim() ?? '',
    }];
  }

  return [];
}

function detectAsyncAwait(ctx: DetectorContext): DetectedPattern[] {
  const thenChain = /\.then\s*\(/;
  const asyncAwait = /\bawait\s+/;

  const removedThen = ctx.removedLines.filter(l => thenChain.test(l)).length;
  const addedAwait = ctx.addedLines.filter(l => asyncAwait.test(l)).length;

  if (removedThen >= 1 && addedAwait >= 1) {
    return [{
      fingerprint: 'async:async-await',
      category: 'async',
      subcategory: 'async-await',
      summary: 'Converts .then() chains to async/await',
      ruleText: 'Use `async/await` instead of `.then()` chains for asynchronous code.',
      before: ctx.removedLines.find(l => thenChain.test(l))?.trim() ?? '',
      after: ctx.addedLines.find(l => asyncAwait.test(l))?.trim() ?? '',
    }];
  }

  return [];
}

function detectNamingConventions(ctx: DetectorContext): DetectedPattern[] {
  const results: DetectedPattern[] = [];

  // Boolean naming: isX, hasX, canX
  const boolWithout = /(?:const|let)\s+(\w+)\s*(?::\s*boolean)?\s*=/;
  const boolWith = /(?:const|let)\s+(is|has|can|should|will)\w+\s*(?::\s*boolean)?\s*=/;

  const removedNoBoolPrefix = ctx.removedLines.filter(l =>
    boolWithout.test(l) && !boolWith.test(l) && /boolean/.test(l)
  ).length;
  const addedBoolPrefix = ctx.addedLines.filter(l => boolWith.test(l)).length;

  if (removedNoBoolPrefix >= 1 && addedBoolPrefix >= 1) {
    results.push({
      fingerprint: 'naming:boolean-prefix',
      category: 'naming',
      subcategory: 'boolean-prefix',
      summary: 'Adds boolean prefixes (is/has/can)',
      ruleText: 'Prefix boolean variables with `is`, `has`, `can`, `should`, or `will`.',
      before: ctx.removedLines.find(l => boolWithout.test(l))?.trim() ?? '',
      after: ctx.addedLines.find(l => boolWith.test(l))?.trim() ?? '',
    });
  }

  return results;
}

function detectCommentChanges(ctx: DetectorContext): DetectedPattern[] {
  const comment = /^\s*(\/\/|\/\*|#)/;
  const jsdoc = /^\s*\/\*\*/;

  const removedComments = ctx.removedLines.filter(l => comment.test(l) && !jsdoc.test(l)).length;
  const addedComments = ctx.addedLines.filter(l => comment.test(l) && !jsdoc.test(l)).length;

  if (removedComments >= 3 && addedComments === 0) {
    return [{
      fingerprint: 'comments:remove-obvious',
      category: 'comments',
      subcategory: 'remove-obvious',
      summary: 'Removes obvious/redundant comments',
      ruleText: 'Do not add comments that restate what the code does. Only comment on why something is done when the reason is not obvious.',
      before: ctx.removedLines.find(l => comment.test(l))?.trim() ?? '',
      after: '(removed)',
    }];
  }

  const removedNoJsdoc = ctx.removedLines.filter(l => !jsdoc.test(l)).length;
  const addedJsdoc = ctx.addedLines.filter(l => jsdoc.test(l)).length;

  if (addedJsdoc >= 1 && removedNoJsdoc > 0) {
    return [{
      fingerprint: 'comments:add-jsdoc',
      category: 'comments',
      subcategory: 'jsdoc',
      summary: 'Adds JSDoc comments to exports',
      ruleText: 'Add JSDoc comments to exported functions and types.',
      before: ctx.removedLines[0]?.trim() ?? '',
      after: ctx.addedLines.find(l => jsdoc.test(l))?.trim() ?? '',
    }];
  }

  return [];
}

function detectErrorHandling(ctx: DetectorContext): DetectedPattern[] {
  const results: DetectedPattern[] = [];

  // Empty catch blocks
  const emptyCatch = /catch\s*\([^)]*\)\s*\{\s*\}/;
  const catchWithBody = /catch\s*\([^)]*\)\s*\{/;

  const removedEmpty = ctx.removedLines.some(l => emptyCatch.test(l));
  const addedWithBody = ctx.addedLines.filter(l => catchWithBody.test(l)).length;

  if (removedEmpty && addedWithBody >= 1) {
    results.push({
      fingerprint: 'error-handling:no-empty-catch',
      category: 'error-handling',
      subcategory: 'no-empty-catch',
      summary: 'Adds error handling to empty catch blocks',
      ruleText: 'Never use empty catch blocks. At minimum, log the error or add a comment explaining why it is intentionally ignored.',
      before: ctx.removedLines.find(l => emptyCatch.test(l))?.trim() ?? '',
      after: ctx.addedLines.find(l => catchWithBody.test(l))?.trim() ?? '',
    });
  }

  // Error cause chaining
  const newError = /new\s+\w*Error\s*\(/;
  const withCause = /\{\s*cause\s*[,:]/;

  const removedNoCause = ctx.removedLines.filter(l => newError.test(l) && !withCause.test(l)).length;
  const addedCause = ctx.addedLines.filter(l => newError.test(l) && withCause.test(l)).length;

  if (removedNoCause >= 1 && addedCause >= 1) {
    results.push({
      fingerprint: 'error-handling:error-cause',
      category: 'error-handling',
      subcategory: 'error-cause',
      summary: 'Chains errors with cause',
      ruleText: 'When rethrowing or wrapping errors, include the original error as `cause`.',
      before: ctx.removedLines.find(l => newError.test(l))?.trim() ?? '',
      after: ctx.addedLines.find(l => withCause.test(l))?.trim() ?? '',
    });
  }

  return results;
}

function detectEarlyReturn(ctx: DetectorContext): DetectedPattern[] {
  const nestedElse = ctx.removedLines.filter(l => /\}\s*else\s*\{/.test(l)).length;
  const earlyReturns = ctx.addedLines.filter(l => /^\s*return\s/.test(l)).length;
  const removedReturns = ctx.removedLines.filter(l => /^\s*return\s/.test(l)).length;

  if (nestedElse >= 1 && earlyReturns > removedReturns) {
    return [{
      fingerprint: 'control-flow:early-return',
      category: 'control-flow',
      subcategory: 'early-return',
      summary: 'Uses early returns to reduce nesting',
      ruleText: 'Return early from functions to avoid deep nesting. Handle edge cases at the top of the function.',
      before: ctx.removedLines.find(l => /\}\s*else\s*\{/.test(l))?.trim() ?? '',
      after: ctx.addedLines.find(l => /^\s*return\s/.test(l))?.trim() ?? '',
    }];
  }

  return [];
}

function detectObjectShorthand(ctx: DetectorContext): DetectedPattern[] {
  if (ctx.language !== 'typescript' && ctx.language !== 'javascript') return [];

  const longhand = /(\w+)\s*:\s*\1[,\s}]/;
  const removedLong = ctx.removedLines.filter(l => longhand.test(l)).length;

  if (removedLong >= 2) {
    return [{
      fingerprint: 'syntax:object-shorthand',
      category: 'syntax',
      subcategory: 'object-shorthand',
      summary: 'Uses object property shorthand',
      ruleText: 'Use shorthand property names when the key and value variable have the same name.',
      before: ctx.removedLines.find(l => longhand.test(l))?.trim() ?? '',
      after: ctx.addedLines[0]?.trim() ?? '',
    }];
  }

  return [];
}

function detectNullishCoalescing(ctx: DetectorContext): DetectedPattern[] {
  if (ctx.language !== 'typescript' && ctx.language !== 'javascript') return [];

  const orOr = /\|\|/;
  const nullishCoalesce = /\?\?/;

  const removedOr = ctx.removedLines.filter(l => orOr.test(l) && !nullishCoalesce.test(l)).length;
  const addedNullish = ctx.addedLines.filter(l => nullishCoalesce.test(l)).length;

  if (removedOr >= 1 && addedNullish >= 1) {
    return [{
      fingerprint: 'syntax:nullish-coalescing',
      category: 'syntax',
      subcategory: 'nullish-coalescing',
      summary: 'Uses nullish coalescing operator',
      ruleText: 'Use `??` instead of `||` for default values when `0`, `""`, or `false` are valid values.',
      before: ctx.removedLines.find(l => orOr.test(l))?.trim() ?? '',
      after: ctx.addedLines.find(l => nullishCoalesce.test(l))?.trim() ?? '',
    }];
  }

  return [];
}

function detectExplicitReturnType(ctx: DetectorContext): DetectedPattern[] {
  if (ctx.language !== 'typescript') return [];

  const fnNoReturn = /(?:function\s+\w+|(?:const|let)\s+\w+\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=]))\s*(?:=>|\{)/;
  const fnWithReturn = /\)\s*:\s*\w/;

  const removedNoReturn = ctx.removedLines.filter(l => fnNoReturn.test(l) && !fnWithReturn.test(l)).length;
  const addedWithReturn = ctx.addedLines.filter(l => fnWithReturn.test(l)).length;

  if (removedNoReturn >= 1 && addedWithReturn >= 1) {
    return [{
      fingerprint: 'types:explicit-return-type',
      category: 'types',
      subcategory: 'explicit-return-type',
      summary: 'Adds explicit return types to functions',
      ruleText: 'Add explicit return type annotations to functions, especially exported ones.',
      before: ctx.removedLines.find(l => fnNoReturn.test(l))?.trim() ?? '',
      after: ctx.addedLines.find(l => fnWithReturn.test(l))?.trim() ?? '',
    }];
  }

  return [];
}

function detectNamedExports(ctx: DetectorContext): DetectedPattern[] {
  if (ctx.language !== 'typescript' && ctx.language !== 'javascript') return [];

  const defaultExport = /export\s+default\b/;
  const namedExport = /export\s+(?:const|function|class|type|interface)\b/;

  const removedDefault = ctx.removedLines.filter(l => defaultExport.test(l)).length;
  const addedNamed = ctx.addedLines.filter(l => namedExport.test(l)).length;

  if (removedDefault >= 1 && addedNamed >= 1) {
    return [{
      fingerprint: 'structure:named-exports',
      category: 'structure',
      subcategory: 'named-exports',
      summary: 'Prefers named exports over default exports',
      ruleText: 'Use named exports instead of default exports. Named exports improve refactoring and import autocompletion.',
      before: ctx.removedLines.find(l => defaultExport.test(l))?.trim() ?? '',
      after: ctx.addedLines.find(l => namedExport.test(l))?.trim() ?? '',
    }];
  }

  return [];
}

function detectConstAssertions(ctx: DetectorContext): DetectedPattern[] {
  if (ctx.language !== 'typescript') return [];

  const asConst = /as\s+const\b/;
  const addedAsConst = ctx.addedLines.filter(l => asConst.test(l)).length;
  const removedAsConst = ctx.removedLines.filter(l => asConst.test(l)).length;

  if (addedAsConst > removedAsConst && addedAsConst >= 1) {
    return [{
      fingerprint: 'types:const-assertions',
      category: 'types',
      subcategory: 'const-assertions',
      summary: 'Uses `as const` for literal types',
      ruleText: 'Use `as const` assertions for constant values to get narrow literal types.',
      before: ctx.removedLines[0]?.trim() ?? '',
      after: ctx.addedLines.find(l => asConst.test(l))?.trim() ?? '',
    }];
  }

  return [];
}
