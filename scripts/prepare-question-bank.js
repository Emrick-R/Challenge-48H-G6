import fs from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const sourceFile = path.join(projectRoot, 'question', 'Questions');
const sourceAssetsRoot = path.join(projectRoot, 'question', 'assets');
const publicAssetsRoot = path.join(projectRoot, 'public', 'question-assets');
const normalizedOutputFile = path.join(projectRoot, 'question', 'question-bank.normalized.json');
const reportOutputFile = path.join(projectRoot, 'question', 'question-bank.report.md');

const sectionTypeMap = new Map([
  ['VSS', { label: 'Video sans son', mediaType: 'video' }],
  ['SU', { label: 'Son uniquement', mediaType: 'audio' }],
  ['IU', { label: 'Image uniquement', mediaType: 'image' }],
  ['TT', { label: 'Texte a trou', mediaType: 'image' }],
]);

const knownFileAliases = new Map([
  ['miew.webp', 'mew.webp'],
  ['under.gif', 'under.webp'],
  ['yaleshendeks.webp', 'yaleshendeks.png'],
  ['metalpipe.webp', 'metal pipe.webp'],
]);

const assetExtensions = new Set(['.webp', '.gif', '.png', '.jpg', '.jpeg', '.mp3', '.mp4']);

function toSlug(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function stripWrappingQuotes(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed.replace(/^"(.*)"$/, '$1');
}

function normalizeWhitespace(value) {
  return String(value ?? '')
    .replace(/\r/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeComparable(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function dedupeBy(items, getKey) {
  const seen = new Set();
  const output = [];

  for (const item of items) {
    const key = getKey(item);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(item);
  }

  return output;
}

async function listAssetFiles(rootDirectory) {
  const output = [];

  async function walk(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      output.push(fullPath);
    }
  }

  await walk(rootDirectory);
  return output;
}

function parseQuestionBlocks(rawText) {
  const lines = rawText.replace(/\r/g, '').split('\n');
  const blocks = [];
  let currentSection = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    const sectionMatch = trimmed.match(/^=.+\(([A-Z]+)\)\s*:/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      continue;
    }

    if (!trimmed.startsWith('-')) {
      continue;
    }

    const header = trimmed;
    const blockLines = [];
    let braceDepth = 0;
    let foundOpeningBrace = false;

    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const nextLine = lines[cursor];
      const nextTrimmed = nextLine.trim();

      if (!foundOpeningBrace) {
        if (!nextTrimmed) {
          continue;
        }

        if (nextTrimmed.startsWith('{')) {
          foundOpeningBrace = true;
          braceDepth += 1;
          blockLines.push(nextLine);
          continue;
        }

        if (nextTrimmed.startsWith('-') || nextTrimmed.startsWith('=')) {
          break;
        }

        continue;
      }

      blockLines.push(nextLine);
      braceDepth += (nextLine.match(/{/g) ?? []).length;
      braceDepth -= (nextLine.match(/}/g) ?? []).length;

      if (braceDepth === 0) {
        index = cursor;
        break;
      }
    }

    blocks.push({
      sectionCode: currentSection,
      header,
      objectText: blockLines.join('\n'),
    });
  }

  return blocks;
}

function extractField(pattern, sourceText) {
  const match = sourceText.match(pattern);
  return match?.[1] ?? null;
}

function parseOptions(sourceText) {
  const rawOptions = extractField(/options:\s*\[(.*?)\]/s, sourceText);

  if (!rawOptions) {
    return [];
  }

  return [...rawOptions.matchAll(/"([^"]*)"/g)].map((match) => match[1]);
}

function parseHeaderMediaPath(header) {
  const mediaMatch = header.match(/(\.\/assets\/[^\s]+)/i);
  return mediaMatch?.[1] ?? null;
}

function parseHeaderTitle(header) {
  const stripped = header
    .replace(/^\-\s*/, '')
    .replace(/(\.\/assets\/[^\s]+)/i, '')
    .replace(/\b(Video|Vidéo|VidÃ©o|Gif|Image|Mp4|Son)\s*:?\s*$/i, '')
    .trim();

  return stripped.replace(/\s+\-\s*$/g, '').trim();
}

function normalizeType(sourceType, sectionCode) {
  return sectionTypeMap.get(sourceType) ?? sectionTypeMap.get(sectionCode) ?? null;
}

function buildAssetIndexes(assetFiles) {
  const byBaseName = new Map();

  for (const assetPath of assetFiles) {
    const baseName = path.basename(assetPath).toLowerCase();
    if (!byBaseName.has(baseName)) {
      byBaseName.set(baseName, []);
    }
    byBaseName.get(baseName).push(assetPath);
  }

  return { byBaseName };
}

function toPublicAssetPath(assetPath) {
  const relativePath = path.relative(sourceAssetsRoot, assetPath).replace(/\\/g, '/');
  return `/question-assets/${relativePath}`;
}

function inferMediaTypeFromPath(assetPath, fallbackType) {
  const extension = path.extname(assetPath ?? '').toLowerCase();

  if (['.mp4', '.webm'].includes(extension)) {
    return 'video';
  }

  if (['.mp3', '.wav', '.ogg'].includes(extension)) {
    return 'audio';
  }

  if (['.gif', '.webp', '.png', '.jpg', '.jpeg'].includes(extension)) {
    return 'image';
  }

  return fallbackType ?? 'image';
}

async function ensureCopiedToPublic(assetPath) {
  const relativePath = path.relative(sourceAssetsRoot, assetPath);
  const destinationPath = path.join(publicAssetsRoot, relativePath);
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.copyFile(assetPath, destinationPath);
}

function resolveAssetPath(rawValue, assetIndex) {
  if (!rawValue) {
    return { source: null, publicPath: null, warnings: [] };
  }

  const warnings = [];
  const normalizedRaw = rawValue.replace(/\\/g, '/').trim();
  const requestedBaseName = path.basename(normalizedRaw);
  const aliasedBaseName = knownFileAliases.get(requestedBaseName.toLowerCase()) ?? requestedBaseName;
  const assetCandidates = assetIndex.byBaseName.get(aliasedBaseName.toLowerCase()) ?? [];

  if (!assetCandidates.length) {
    warnings.push(`Asset introuvable: ${rawValue}`);
    return {
      source: null,
      publicPath: null,
      warnings,
    };
  }

  if (assetCandidates.length > 1) {
    warnings.push(`Asset ambigu resolu par premier match: ${rawValue}`);
  }

  const source = assetCandidates[0];
  return {
    source,
    publicPath: toPublicAssetPath(source),
    warnings,
  };
}

function normalizeOptionValue(optionValue, assetIndex) {
  const trimmed = normalizeWhitespace(optionValue);
  const extension = path.extname(trimmed).toLowerCase();

  if (!assetExtensions.has(extension)) {
    return {
      kind: 'text',
      label: trimmed,
      assetPath: null,
      warnings: [],
    };
  }

  const resolved = resolveAssetPath(trimmed, assetIndex);

  return {
    kind: 'asset',
    label: resolved.publicPath ?? trimmed,
    assetPath: resolved.publicPath,
    warnings: resolved.warnings,
  };
}

function normalizeQuestionRecord(rawBlock, assetIndex, sequence) {
  const typeCode = extractField(/type:\s*"([^"]+)"/, rawBlock.objectText) ?? rawBlock.sectionCode;
  const typeMeta = normalizeType(typeCode, rawBlock.sectionCode);
  const question = stripWrappingQuotes(
    extractField(/question:\s*"([^"]*)"/s, rawBlock.objectText) ?? '',
  );
  const answer = stripWrappingQuotes(
    extractField(/answer:\s*"([^"]*)"/s, rawBlock.objectText) ?? '',
  );
  const options = parseOptions(rawBlock.objectText);
  const rawMediaPath = parseHeaderMediaPath(rawBlock.header);
  const mediaResolution = resolveAssetPath(rawMediaPath, assetIndex);
  const normalizedOptions = options.map((option) => normalizeOptionValue(option, assetIndex));

  const issues = [];
  const warnings = [
    ...mediaResolution.warnings,
    ...normalizedOptions.flatMap((option) => option.warnings),
  ];

  if (!typeMeta) {
    issues.push(`Type inconnu: ${typeCode ?? 'n/a'}`);
  }

  if (!question) {
    issues.push('Question vide');
  }

  if (options.length !== 4) {
    issues.push(`Nombre d'options invalide: ${options.length}`);
  }

  const uniqueOptions = new Set(options.map((option) => normalizeWhitespace(option).toLowerCase()));
  if (uniqueOptions.size !== options.length) {
    issues.push('Options dupliquees');
  }

  const normalizedAnswer = normalizeComparable(answer);
  const resolvedAnswerAsset = resolveAssetPath(answer, assetIndex);
  const normalizedResolvedAnswerAsset = resolvedAnswerAsset.publicPath
    ? normalizeComparable(resolvedAnswerAsset.publicPath)
    : null;
  const matchedAnswerOption = normalizedOptions.find((option) =>
    normalizeComparable(option.label) === normalizedAnswer
      || normalizeComparable(path.basename(option.label)) === normalizedAnswer
      || (normalizedResolvedAnswerAsset != null
        && normalizeComparable(option.label) === normalizedResolvedAnswerAsset),
  );

  if (!matchedAnswerOption) {
    issues.push(`Reponse absente des options: ${answer}`);
  }

  if (rawMediaPath && !mediaResolution.source) {
    issues.push(`Media principal manquant: ${rawMediaPath}`);
  }

  const title = normalizeWhitespace(parseHeaderTitle(rawBlock.header));
  const slug = `${String(sequence).padStart(3, '0')}-${toSlug(title || question || `question-${sequence}`)}`;

  return {
    id: slug,
    sequence,
    sourceType: typeCode,
    category: typeMeta?.label ?? rawBlock.sectionCode ?? 'Inconnue',
    title: title || question,
    prompt: normalizeWhitespace(question),
    mediaType: mediaResolution.publicPath
      ? inferMediaTypeFromPath(mediaResolution.publicPath, typeMeta?.mediaType ?? 'image')
      : 'none',
    mediaPath: mediaResolution.publicPath,
    options: normalizedOptions.map((option, index) => ({
      label: ['A', 'B', 'C', 'D'][index] ?? String(index + 1),
      value: option.label,
      kind: option.kind,
    })),
    answer,
    answerLabel: matchedAnswerOption?.label ?? null,
    issues: dedupeBy(issues, (issue) => issue),
    warnings: dedupeBy(warnings, (warning) => warning),
    raw: {
      header: rawBlock.header,
      rawMediaPath,
      objectText: rawBlock.objectText,
    },
  };
}

function buildMarkdownReport(records) {
  const total = records.length;
  const valid = records.filter((record) => record.issues.length === 0).length;
  const invalid = total - valid;
  const warnings = records.filter((record) => record.warnings.length > 0).length;
  const byCategory = [...sectionTypeMap.values()].map((meta) => ({
    label: meta.label,
    count: records.filter((record) => record.category === meta.label).length,
  }));

  const lines = [
    '# Rapport de validation des questions',
    '',
    `- Total: ${total}`,
    `- Valides: ${valid}`,
    `- Invalides: ${invalid}`,
    `- Avec avertissements: ${warnings}`,
    '',
    '## Repartition',
    '',
  ];

  for (const category of byCategory) {
    lines.push(`- ${category.label}: ${category.count}`);
  }

  lines.push('', '## Detail', '');

  for (const record of records) {
    lines.push(`### ${record.id}`);
    lines.push(`- Categorie: ${record.category}`);
    lines.push(`- Titre: ${record.title}`);
    lines.push(`- Prompt: ${record.prompt || '(vide)'}`);
    lines.push(`- Media: ${record.mediaType}${record.mediaPath ? ` -> ${record.mediaPath}` : ''}`);
    lines.push(`- Reponse attendue: ${record.answer}`);
    lines.push(`- Statut: ${record.issues.length ? 'INVALIDE' : 'VALIDE'}`);

    if (record.issues.length) {
      lines.push(`- Erreurs: ${record.issues.join(' | ')}`);
    }

    if (record.warnings.length) {
      lines.push(`- Avertissements: ${record.warnings.join(' | ')}`);
    }

    lines.push('- Options:');
    for (const option of record.options) {
      lines.push(`  - ${option.label}: ${option.value}`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const rawText = await fs.readFile(sourceFile, 'utf8');
  const assetFiles = await listAssetFiles(sourceAssetsRoot);
  const assetIndex = buildAssetIndexes(assetFiles);
  const rawBlocks = parseQuestionBlocks(rawText);
  const records = rawBlocks.map((block, index) => normalizeQuestionRecord(block, assetIndex, index + 1));

  for (const record of records) {
    if (record.mediaPath) {
      const source = resolveAssetPath(record.raw.rawMediaPath, assetIndex).source;
      if (source) {
        await ensureCopiedToPublic(source);
      }
    }

    for (const option of record.options) {
      if (!option.value.startsWith('/question-assets/')) {
        continue;
      }

      const source = resolveAssetPath(option.value, assetIndex).source
        ?? resolveAssetPath(path.basename(option.value), assetIndex).source;

      if (source) {
        await ensureCopiedToPublic(source);
      }
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    total: records.length,
    valid: records.filter((record) => record.issues.length === 0).length,
    records,
  };

  await fs.writeFile(normalizedOutputFile, JSON.stringify(payload, null, 2));
  await fs.writeFile(reportOutputFile, buildMarkdownReport(records));

  console.log(
    JSON.stringify(
      {
        normalizedOutputFile: path.relative(projectRoot, normalizedOutputFile),
        reportOutputFile: path.relative(projectRoot, reportOutputFile),
        total: payload.total,
        valid: payload.valid,
        invalid: payload.total - payload.valid,
      },
      null,
      2,
    ),
  );
}

await main();
