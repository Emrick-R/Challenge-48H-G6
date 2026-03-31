import fs from 'node:fs/promises';
import path from 'node:path';
import { withTransaction } from '../server/db.js';

const projectRoot = process.cwd();
const normalizedInputFile = path.join(projectRoot, 'question', 'question-bank.normalized.json');
const targetThemeId = 3;

function normalizeComparable(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

async function execute(executor, sql, args = []) {
  return executor.execute({ sql, args });
}

async function queryAll(executor, sql, args = []) {
  const result = await execute(executor, sql, args);
  return result.rows ?? [];
}

async function queryScalar(executor, sql, args = []) {
  const rows = await queryAll(executor, sql, args);
  const row = rows[0];

  if (!row) {
    return null;
  }

  const [firstKey] = Object.keys(row);
  return firstKey ? row[firstKey] : null;
}

function isCorrectOption(record, optionValue) {
  const normalizedAnswer = normalizeComparable(record.answer);
  const normalizedOption = normalizeComparable(optionValue);
  const normalizedBasename = normalizeComparable(path.basename(optionValue));

  return normalizedOption === normalizedAnswer || normalizedBasename === normalizedAnswer;
}

function buildExplanation(record, correctOption) {
  if (!correctOption) {
    return null;
  }

  if (correctOption.value.startsWith('/question-assets/')) {
    return `La bonne reponse est l option ${correctOption.label}.`;
  }

  return `La bonne reponse est ${correctOption.value}.`;
}

async function main() {
  const raw = await fs.readFile(normalizedInputFile, 'utf8');
  const parsed = JSON.parse(raw);
  const validRecords = parsed.records.filter((record) => record.issues.length === 0);

  const result = await withTransaction(async (transaction) => {
    await execute(
      transaction,
      `INSERT INTO themes (id, name, slug, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         slug = excluded.slug,
         description = excluded.description,
         updated_at = CURRENT_TIMESTAMP`,
      [targetThemeId, 'Qui a la ref', 'qui-a-la-ref', 'Banque complete des questions Qui a la ref'],
    );

    await execute(
      transaction,
      'DELETE FROM rooms WHERE theme_id = ?',
      [targetThemeId],
    );

    await execute(
      transaction,
      'DELETE FROM questions WHERE theme_id = ?',
      [targetThemeId],
    );

    let insertedQuestions = 0;
    let insertedChoices = 0;

    for (const record of validRecords) {
      const questionTypeId = record.mediaPath ? 2 : 1;
      const correctOption = record.options.find((option) => isCorrectOption(record, option.value)) ?? null;
      const questionInsert = await execute(
        transaction,
        `INSERT INTO questions (
           theme_id,
           question_type_id,
           title,
           question_text,
           media_type,
           media_path,
           correct_text,
           explanation,
           difficulty,
           base_points,
           answer_time_seconds,
           reveal_time_seconds,
           is_active,
           created_at,
           updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'easy', 100, 20, 5, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          targetThemeId,
          questionTypeId,
          record.title,
          record.prompt,
          record.mediaType ?? 'none',
          record.mediaPath,
          correctOption?.value ?? record.answer,
          buildExplanation(record, correctOption),
        ],
      );

      const questionId = Number(questionInsert.lastInsertRowid);
      insertedQuestions += 1;

      for (const [index, option] of record.options.entries()) {
        await execute(
          transaction,
          `INSERT INTO choices (
             question_id,
             label,
             choice_text,
             choice_order,
             is_correct,
             created_at
           ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [
            questionId,
            option.label,
            option.value,
            index + 1,
            isCorrectOption(record, option.value) ? 1 : 0,
          ],
        );
        insertedChoices += 1;
      }
    }

    const playableCount = await queryScalar(
      transaction,
      `SELECT COUNT(*)
       FROM questions q
       WHERE q.theme_id = ?`,
      [targetThemeId],
    );

    return {
      insertedQuestions,
      insertedChoices,
      playableCount: Number(playableCount),
    };
  });

  console.log(
    JSON.stringify(
      {
        themeId: targetThemeId,
        ...result,
      },
      null,
      2,
    ),
  );
}

await main();
