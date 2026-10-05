const fs = require('fs');
const path = require('path');
const {
  canonicalExpression,
  canonicalPredicate,
  compareIndexDefinition,
  extractExpectedIndexes,
} = require('../scratch/migration_015_index_validation.cjs');

const migrationSql = fs.readFileSync(
  path.join(__dirname, '..', 'migrations', '015_society_notices.sql'),
  'utf8'
);
const indexSpecs = extractExpectedIndexes(migrationSql);

function actualFromExpected(expected, overrides = {}) {
  const base = {
    name: expected.name,
    table_schema: expected.schema,
    table_name: expected.table,
    is_unique: expected.unique,
    is_primary: false,
    is_valid: true,
    is_ready: true,
    access_method: expected.accessMethod,
    key_attribute_count: expected.keys.length,
    total_attribute_count: expected.keys.length,
    definition: expected.statement,
    predicate: expected.predicate,
    keys: expected.keys.map((key, index) => ({
      position: index + 1,
      definition: `${key.expression}${key.direction === 'DESC' ? ' DESC' : ''}${key.direction === 'ASC' && /\sASC\s*$/i.test(key.expression) ? ' ASC' : ''}${key.direction === 'DESC' && key.nulls === 'FIRST' ? ' NULLS FIRST' : ''}`,
      column_name: /^[\w$]+$/.test(key.expression) ? key.expression : null,
      is_expression: !/^[\w$]+$/.test(key.expression),
      descending: key.direction === 'DESC',
      nulls_first: key.nulls === 'FIRST',
    })),
  };
  return { ...base, ...overrides };
}

describe('Migration 015 index assertion diagnostics', () => {
  it('derives all four expected index definitions and the descending creator timestamp key from the migration SQL', () => {
    expect(indexSpecs.map((index) => index.name).sort()).toEqual([
      'idx_notices_complex_status_start',
      'idx_notices_creator_created',
      'idx_notifications_society_notice_delivery',
      'idx_notifications_society_notice_id',
    ].sort());

    const creatorIndex = indexSpecs.find((index) => index.name === 'idx_notices_creator_created');
    expect(creatorIndex.statement).toContain('(created_by, created_at DESC)');
    expect(creatorIndex.keys.map((key) => [key.expression, key.direction, key.nulls])).toEqual([
      ['created_by', 'ASC', 'LAST'],
      ['created_at', 'DESC', 'FIRST'],
    ]);
  });

  it('accepts harmless PostgreSQL formatting, qualification, identifier-quote, and text-cast normalization', () => {
    const deliveryIndex = indexSpecs.find((index) => index.name === 'idx_notifications_society_notice_delivery');
    const actual = actualFromExpected(deliveryIndex, {
      definition: 'CREATE UNIQUE INDEX idx_notifications_society_notice_delivery ON public.notifications USING btree (user_id, ((metadata ->> \'notice_id\'::text))) WHERE ((type = \'society_notice\'::text) AND (metadata ? \'notice_id\'::text))',
      keys: [
        { position: 1, definition: '"user_id"', column_name: 'user_id', is_expression: false, descending: false, nulls_first: false },
        { position: 2, definition: '(("metadata" ->> \'notice_id\'::text))', column_name: null, is_expression: true, descending: false, nulls_first: false },
      ],
      predicate: '(("type" = \'society_notice\'::text) AND (("metadata" ? \'notice_id\'::text)))',
    });

    const result = compareIndexDefinition(deliveryIndex, actual);
    expect(result.failedComparisons).toEqual([]);
    expect(result.compatible).toBe(true);
    expect(canonicalExpression('(("type" = \'society_notice\'::text) AND (("metadata" ? \'notice_id\'::text)))'))
      .toBe(canonicalExpression(deliveryIndex.predicate));
  });

  it('accepts the exact predicate PostgreSQL captured during the rolled-back attempt', () => {
    const deliveryIndex = indexSpecs.find((index) => index.name === 'idx_notifications_society_notice_delivery');
    const captured = '(((type)::text = \'society_notice\'::text) AND (metadata ? \'notice_id\'::text))';
    const actual = actualFromExpected(deliveryIndex, {
      definition: 'CREATE UNIQUE INDEX idx_notifications_society_notice_delivery ON public.notifications USING btree (user_id, ((metadata ->> \'notice_id\'::text))) WHERE (((type)::text = \'society_notice\'::text) AND (metadata ? \'notice_id\'::text))',
      predicate: captured,
    });

    const result = compareIndexDefinition(deliveryIndex, actual);
    expect(result.failedComparisons).toEqual([]);
    expect(result.compatible).toBe(true);
    expect(canonicalPredicate(captured)).toBe(canonicalPredicate(deliveryIndex.predicate));
  });

  it('rejects a genuinely different society-notice partial predicate', () => {
    const deliveryIndex = indexSpecs.find((index) => index.name === 'idx_notifications_society_notice_delivery');
    const actual = actualFromExpected(deliveryIndex, {
      predicate: "(((type)::text = 'society_notice'::text) AND (metadata ? 'other_key'::text))",
    });

    const result = compareIndexDefinition(deliveryIndex, actual);
    expect(result.compatible).toBe(false);
    expect(result.failedComparisons).toEqual([expect.objectContaining({ property: 'predicate' })]);
  });

  it('rejects an actually incompatible creator index and names the failed properties', () => {
    const creatorIndex = indexSpecs.find((index) => index.name === 'idx_notices_creator_created');
    const actual = actualFromExpected(creatorIndex, {
      table_name: 'notifications',
      is_unique: true,
      definition: 'CREATE UNIQUE INDEX idx_notices_creator_created ON public.notifications USING btree (created_by, created_at)',
      keys: [
        { position: 1, definition: 'created_at', column_name: 'created_at', is_expression: false, descending: false, nulls_first: false },
        { position: 2, definition: 'created_by', column_name: 'created_by', is_expression: false, descending: false, nulls_first: false },
      ],
    });

    const result = compareIndexDefinition(creatorIndex, actual);
    expect(result.compatible).toBe(false);
    expect(result.failedComparisons.map((failure) => failure.property)).toEqual(expect.arrayContaining([
      'table', 'unique', 'key_1_expression', 'key_2_expression', 'key_2_direction', 'key_2_nulls',
    ]));
    expect(result.actualDefinition).toContain('ON public.notifications');
    expect(result.expectedDefinition).toContain('(created_by, created_at DESC)');
  });
});
