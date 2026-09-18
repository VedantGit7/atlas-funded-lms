import type {
  SegmentCondition,
  SegmentConditionGroup,
  SegmentConditionsTree,
  SegmentLearnerFieldKey,
} from "./custom-field-segments.dto";
import {
  SEGMENT_LEARNER_FIELD_KEYS,
  SEGMENT_BOOLEAN_OPERATORS,
  SEGMENT_DATE_OPERATORS,
  SEGMENT_NUMBER_OPERATORS,
  SEGMENT_SELECT_OPERATORS,
  SEGMENT_TEXT_OPERATORS,
} from "./custom-field-segments.dto";

export type FieldTypeLookup = Map<string, string>;

export type BuiltPredicate = {
  sql: string;
  params: unknown[];
};

export type ConditionCompleteness = {
  complete: boolean;
  incompleteIds: string[];
  message: string | null;
};

const LEARNER_KEY_SET = new Set<string>(SEGMENT_LEARNER_FIELD_KEYS);

const EMPTY_VALUE_SQL = `
  (
    cfv.value_json is null
    or cfv.value_json::text in ('null', '""', '[]', '{}')
    or btrim(cfv.value_json::text, '"') = ''
  )
`;

const FILLED_VALUE_SQL = `
  (
    cfv.value_json is not null
    and cfv.value_json::text not in ('null', '""', '[]', '{}')
    and btrim(cfv.value_json::text, '"') <> ''
  )
`;

function nextParam(params: unknown[], value: unknown): string {
  params.push(value);
  return `$${params.length}`;
}

function learnerExpr(fieldKey: SegmentLearnerFieldKey): string {
  switch (fieldKey) {
    case "learner_name":
      return `lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))`;
    case "email":
      return `lower(coalesce(ap.email, m.invited_email_normalized, ''))`;
    case "status":
      return `m.status::text`;
    case "enrollment_count":
      return `(
        select count(*)::int from enrollments e
        where e.membership_id = m.id and e.tenant_id = m.tenant_id
      )`;
    case "total_spent_cents":
      return `coalesce((
        select sum(po.amount_cents)::int from payment_orders po
        where po.membership_id = m.id and po.tenant_id = m.tenant_id and po.status = 'paid'
      ), 0)`;
    case "last_active_at":
      return `m.last_active_at`;
    case "signed_up_at":
      return `coalesce(m.joined_at, m.created_at)`;
    default: {
      const _exhaustive: never = fieldKey;
      return _exhaustive;
    }
  }
}

function learnerEmptySql(fieldKey: SegmentLearnerFieldKey): string {
  switch (fieldKey) {
    case "learner_name":
    case "email":
      return `(${learnerExpr(fieldKey)} = '')`;
    case "status":
      return `false`;
    case "enrollment_count":
    case "total_spent_cents":
      return `(${learnerExpr(fieldKey)} is null)`;
    case "last_active_at":
    case "signed_up_at":
      return `(${learnerExpr(fieldKey)} is null)`;
    default: {
      const _exhaustive: never = fieldKey;
      return _exhaustive;
    }
  }
}

function textValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function numberPair(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const a = numberValue(value[0]);
  const b = numberValue(value[1]);
  if (a == null || b == null) return null;
  return [a, b];
}

function stringPair(value: unknown): [string, string] | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const a = textValue(value[0]);
  const b = textValue(value[1]);
  if (a == null || b == null) return null;
  return [a, b];
}

function stringList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.map((item) => textValue(item)).filter((item): item is string => item != null);
  return items.length > 0 ? items : null;
}

function daysValue(value: unknown): number | null {
  if (value && typeof value === "object" && !Array.isArray(value) && "days" in value) {
    return numberValue(value.days);
  }
  return numberValue(value);
}

export function operatorsForFieldType(fieldType: string): readonly string[] {
  switch (fieldType) {
    case "number":
      return SEGMENT_NUMBER_OPERATORS;
    case "boolean":
      return SEGMENT_BOOLEAN_OPERATORS;
    case "select":
      return SEGMENT_SELECT_OPERATORS;
    case "date":
      return SEGMENT_DATE_OPERATORS;
    case "text":
    default:
      return SEGMENT_TEXT_OPERATORS;
  }
}

export function resolveConditionFieldType(
  condition: SegmentCondition,
  fieldTypes: FieldTypeLookup,
): string | null {
  if (condition.fieldSource === "learner") {
    if (!LEARNER_KEY_SET.has(condition.fieldKey)) return null;
    if (condition.fieldKey === "enrollment_count" || condition.fieldKey === "total_spent_cents") {
      return "number";
    }
    if (condition.fieldKey === "last_active_at" || condition.fieldKey === "signed_up_at") {
      return "date";
    }
    if (condition.fieldKey === "status") return "select";
    return "text";
  }
  return fieldTypes.get(condition.fieldKey) ?? null;
}

export function isConditionComplete(
  condition: SegmentCondition,
  fieldTypes: FieldTypeLookup,
): boolean {
  const fieldType = resolveConditionFieldType(condition, fieldTypes);
  if (!fieldType) return false;
  const allowed = operatorsForFieldType(fieldType);
  if (!allowed.includes(condition.operator)) return false;

  const op = condition.operator;
  if (op === "is_empty" || op === "is_not_empty" || op === "is_true" || op === "is_false") {
    return true;
  }
  if (op === "between") {
    if (fieldType === "number") return numberPair(condition.value) != null;
    if (fieldType === "date") return stringPair(condition.value) != null;
    return false;
  }
  if (op === "is_any_of" || op === "is_none_of") {
    return stringList(condition.value) != null;
  }
  if (op === "in_last_n_days") {
    return daysValue(condition.value) != null;
  }
  if (fieldType === "number") return numberValue(condition.value) != null;
  if (fieldType === "boolean") return typeof condition.value === "boolean";
  return textValue(condition.value) != null && textValue(condition.value) !== "";
}

export function assessConditionsCompleteness(
  tree: SegmentConditionsTree,
  fieldTypes: FieldTypeLookup,
): ConditionCompleteness {
  const incompleteIds: string[] = [];
  for (const group of tree.groups) {
    for (const condition of group.conditions) {
      if (!isConditionComplete(condition, fieldTypes)) {
        incompleteIds.push(condition.id);
      }
    }
  }
  if (incompleteIds.length === 0) {
    return { complete: true, incompleteIds: [], message: null };
  }
  return {
    complete: false,
    incompleteIds,
    message: "Finish the highlighted condition to see matches.",
  };
}

function buildCustomFieldExists(fieldKeyParam: string, extraPredicate: string): string {
  return `exists (
    select 1
    from custom_field_values cfv
    join custom_field_definitions cfd
      on cfd.id = cfv.custom_field_definition_id
     and cfd.tenant_id = cfv.tenant_id
    where cfv.tenant_id = m.tenant_id
      and cfv.membership_id = m.id
      and cfd.status = 'ACTIVE'
      and cfd.key = ${fieldKeyParam}
      and ${extraPredicate}
  )`;
}

function buildCustomFieldNotExistsFilled(fieldKeyParam: string): string {
  return `not exists (
    select 1
    from custom_field_values cfv
    join custom_field_definitions cfd
      on cfd.id = cfv.custom_field_definition_id
     and cfd.tenant_id = cfv.tenant_id
    where cfv.tenant_id = m.tenant_id
      and cfv.membership_id = m.id
      and cfd.status = 'ACTIVE'
      and cfd.key = ${fieldKeyParam}
      and ${FILLED_VALUE_SQL}
  )`;
}

function buildLearnerCondition(
  condition: SegmentCondition,
  fieldType: string,
  params: unknown[],
): string | null {
  const key = condition.fieldKey as SegmentLearnerFieldKey;
  const expr = learnerExpr(key);
  const op = condition.operator;

  if (op === "is_empty") return learnerEmptySql(key);
  if (op === "is_not_empty") return `not (${learnerEmptySql(key)})`;

  if (fieldType === "number") {
    if (op === "eq") {
      const n = numberValue(condition.value);
      if (n == null) return null;
      return `(${expr} = ${nextParam(params, n)}::int)`;
    }
    if (op === "neq") {
      const n = numberValue(condition.value);
      if (n == null) return null;
      return `(${expr} <> ${nextParam(params, n)}::int)`;
    }
    if (op === "gt") {
      const n = numberValue(condition.value);
      if (n == null) return null;
      return `(${expr} > ${nextParam(params, n)}::int)`;
    }
    if (op === "lt") {
      const n = numberValue(condition.value);
      if (n == null) return null;
      return `(${expr} < ${nextParam(params, n)}::int)`;
    }
    if (op === "between") {
      const pair = numberPair(condition.value);
      if (!pair) return null;
      return `(${expr} between ${nextParam(params, pair[0])}::int and ${nextParam(params, pair[1])}::int)`;
    }
  }

  if (fieldType === "date") {
    if (op === "before") {
      const v = textValue(condition.value);
      if (!v) return null;
      return `(${expr} < ${nextParam(params, v)}::timestamptz)`;
    }
    if (op === "after") {
      const v = textValue(condition.value);
      if (!v) return null;
      return `(${expr} > ${nextParam(params, v)}::timestamptz)`;
    }
    if (op === "between") {
      const pair = stringPair(condition.value);
      if (!pair) return null;
      return `(${expr} between ${nextParam(params, pair[0])}::timestamptz and ${nextParam(params, pair[1])}::timestamptz)`;
    }
    if (op === "in_last_n_days") {
      const days = daysValue(condition.value);
      if (days == null) return null;
      return `(${expr} >= (now() - (${nextParam(params, days)}::int * interval '1 day')))`;
    }
  }

  if (fieldType === "select" || fieldType === "text") {
    if (op === "is" || op === "eq") {
      const v = textValue(condition.value);
      if (v == null) return null;
      if (key === "status") return `(${expr} = ${nextParam(params, v)})`;
      return `(${expr} = lower(${nextParam(params, v)}))`;
    }
    if (op === "is_not" || op === "neq") {
      const v = textValue(condition.value);
      if (v == null) return null;
      if (key === "status") return `(${expr} <> ${nextParam(params, v)})`;
      return `(${expr} <> lower(${nextParam(params, v)}))`;
    }
    if (op === "contains") {
      const v = textValue(condition.value);
      if (v == null) return null;
      return `(${expr} like '%' || lower(${nextParam(params, v)}) || '%')`;
    }
    if (op === "starts_with") {
      const v = textValue(condition.value);
      if (v == null) return null;
      return `(${expr} like lower(${nextParam(params, v)}) || '%')`;
    }
    if (op === "is_any_of") {
      const list = stringList(condition.value);
      if (!list) return null;
      return `(${expr} = any(${nextParam(params, list)}::text[]))`;
    }
    if (op === "is_none_of") {
      const list = stringList(condition.value);
      if (!list) return null;
      return `(not (${expr} = any(${nextParam(params, list)}::text[])))`;
    }
  }

  return null;
}

function buildCustomCondition(
  condition: SegmentCondition,
  fieldType: string,
  params: unknown[],
): string | null {
  const keyParam = nextParam(params, condition.fieldKey);
  const op = condition.operator;
  const textExpr = `lower(btrim(cfv.value_json #>> '{}'))`;
  const numExpr = `nullif(btrim(cfv.value_json #>> '{}'), '')::numeric`;
  const boolExpr = `lower(btrim(cfv.value_json #>> '{}'))`;
  const dateExpr = `nullif(btrim(cfv.value_json #>> '{}'), '')::timestamptz`;

  if (op === "is_empty") return buildCustomFieldNotExistsFilled(keyParam);
  if (op === "is_not_empty") {
    return buildCustomFieldExists(keyParam, FILLED_VALUE_SQL);
  }

  if (fieldType === "boolean") {
    if (op === "is_true") {
      return buildCustomFieldExists(
        keyParam,
        `${FILLED_VALUE_SQL} and ${boolExpr} in ('true', '1', 'yes')`,
      );
    }
    if (op === "is_false") {
      return buildCustomFieldExists(
        keyParam,
        `${FILLED_VALUE_SQL} and ${boolExpr} in ('false', '0', 'no')`,
      );
    }
  }

  if (fieldType === "number") {
    if (op === "eq") {
      const n = numberValue(condition.value);
      if (n == null) return null;
      return buildCustomFieldExists(
        keyParam,
        `${FILLED_VALUE_SQL} and ${numExpr} = ${nextParam(params, n)}::numeric`,
      );
    }
    if (op === "neq") {
      const n = numberValue(condition.value);
      if (n == null) return null;
      return buildCustomFieldExists(
        keyParam,
        `${FILLED_VALUE_SQL} and ${numExpr} <> ${nextParam(params, n)}::numeric`,
      );
    }
    if (op === "gt") {
      const n = numberValue(condition.value);
      if (n == null) return null;
      return buildCustomFieldExists(
        keyParam,
        `${FILLED_VALUE_SQL} and ${numExpr} > ${nextParam(params, n)}::numeric`,
      );
    }
    if (op === "lt") {
      const n = numberValue(condition.value);
      if (n == null) return null;
      return buildCustomFieldExists(
        keyParam,
        `${FILLED_VALUE_SQL} and ${numExpr} < ${nextParam(params, n)}::numeric`,
      );
    }
    if (op === "between") {
      const pair = numberPair(condition.value);
      if (!pair) return null;
      return buildCustomFieldExists(
        keyParam,
        `${FILLED_VALUE_SQL} and ${numExpr} between ${nextParam(params, pair[0])}::numeric and ${nextParam(params, pair[1])}::numeric`,
      );
    }
  }

  if (fieldType === "date") {
    if (op === "before") {
      const v = textValue(condition.value);
      if (!v) return null;
      return buildCustomFieldExists(
        keyParam,
        `${FILLED_VALUE_SQL} and ${dateExpr} < ${nextParam(params, v)}::timestamptz`,
      );
    }
    if (op === "after") {
      const v = textValue(condition.value);
      if (!v) return null;
      return buildCustomFieldExists(
        keyParam,
        `${FILLED_VALUE_SQL} and ${dateExpr} > ${nextParam(params, v)}::timestamptz`,
      );
    }
    if (op === "between") {
      const pair = stringPair(condition.value);
      if (!pair) return null;
      return buildCustomFieldExists(
        keyParam,
        `${FILLED_VALUE_SQL} and ${dateExpr} between ${nextParam(params, pair[0])}::timestamptz and ${nextParam(params, pair[1])}::timestamptz`,
      );
    }
    if (op === "in_last_n_days") {
      const days = daysValue(condition.value);
      if (days == null) return null;
      return buildCustomFieldExists(
        keyParam,
        `${FILLED_VALUE_SQL} and ${dateExpr} >= (now() - (${nextParam(params, days)}::int * interval '1 day'))`,
      );
    }
  }

  if (fieldType === "select") {
    if (op === "is") {
      const v = textValue(condition.value);
      if (v == null) return null;
      return buildCustomFieldExists(
        keyParam,
        `${FILLED_VALUE_SQL} and btrim(cfv.value_json #>> '{}') = ${nextParam(params, v)}`,
      );
    }
    if (op === "is_not") {
      const v = textValue(condition.value);
      if (v == null) return null;
      return `not ${buildCustomFieldExists(
        keyParam,
        `${FILLED_VALUE_SQL} and btrim(cfv.value_json #>> '{}') = ${nextParam(params, v)}`,
      )}`;
    }
    if (op === "is_any_of") {
      const list = stringList(condition.value);
      if (!list) return null;
      return buildCustomFieldExists(
        keyParam,
        `${FILLED_VALUE_SQL} and btrim(cfv.value_json #>> '{}') = any(${nextParam(params, list)}::text[])`,
      );
    }
    if (op === "is_none_of") {
      const list = stringList(condition.value);
      if (!list) return null;
      return `not ${buildCustomFieldExists(
        keyParam,
        `${FILLED_VALUE_SQL} and btrim(cfv.value_json #>> '{}') = any(${nextParam(params, list)}::text[])`,
      )}`;
    }
  }

  if (fieldType === "text" || fieldType === "select") {
    if (op === "is") {
      const v = textValue(condition.value);
      if (v == null) return null;
      return buildCustomFieldExists(
        keyParam,
        `${FILLED_VALUE_SQL} and ${textExpr} = lower(${nextParam(params, v)})`,
      );
    }
    if (op === "is_not") {
      const v = textValue(condition.value);
      if (v == null) return null;
      return `not ${buildCustomFieldExists(
        keyParam,
        `${FILLED_VALUE_SQL} and ${textExpr} = lower(${nextParam(params, v)})`,
      )}`;
    }
    if (op === "contains") {
      const v = textValue(condition.value);
      if (v == null) return null;
      return buildCustomFieldExists(
        keyParam,
        `${FILLED_VALUE_SQL} and ${textExpr} like '%' || lower(${nextParam(params, v)}) || '%'`,
      );
    }
    if (op === "starts_with") {
      const v = textValue(condition.value);
      if (v == null) return null;
      return buildCustomFieldExists(
        keyParam,
        `${FILLED_VALUE_SQL} and ${textExpr} like lower(${nextParam(params, v)}) || '%'`,
      );
    }
  }

  return null;
}

function buildConditionSql(
  condition: SegmentCondition,
  fieldTypes: FieldTypeLookup,
  params: unknown[],
): string | null {
  const fieldType = resolveConditionFieldType(condition, fieldTypes);
  if (!fieldType) return null;
  if (!operatorsForFieldType(fieldType).includes(condition.operator)) return null;

  if (condition.fieldSource === "learner") {
    return buildLearnerCondition(condition, fieldType, params);
  }
  return buildCustomCondition(condition, fieldType, params);
}

function joinPredicates(parts: string[], combinator: "and" | "or"): string {
  if (parts.length === 0) return "false";
  if (parts.length === 1) return parts[0] ?? "false";
  return `(${parts.join(` ${combinator} `)})`;
}

function buildGroupSql(
  group: SegmentConditionGroup,
  fieldTypes: FieldTypeLookup,
  params: unknown[],
): string | null {
  const parts: string[] = [];
  for (const condition of group.conditions) {
    if (!isConditionComplete(condition, fieldTypes)) return null;
    const sql = buildConditionSql(condition, fieldTypes, params);
    if (!sql) return null;
    parts.push(sql);
  }
  return joinPredicates(parts, group.combinator);
}

export function buildConditionsPredicate(
  tree: SegmentConditionsTree,
  fieldTypes: FieldTypeLookup,
): BuiltPredicate | null {
  const completeness = assessConditionsCompleteness(tree, fieldTypes);
  if (!completeness.complete) return null;

  const params: unknown[] = [];
  const groupParts: string[] = [];
  for (const group of tree.groups) {
    const sql = buildGroupSql(group, fieldTypes, params);
    if (!sql) return null;
    groupParts.push(sql);
  }
  return {
    sql: joinPredicates(groupParts, tree.rootCombinator),
    params,
  };
}

export function buildUnionPredicates(
  trees: SegmentConditionsTree[],
  fieldTypes: FieldTypeLookup,
): BuiltPredicate | null {
  const params: unknown[] = [];
  const parts: string[] = [];
  for (const tree of trees) {
    const completeness = assessConditionsCompleteness(tree, fieldTypes);
    if (!completeness.complete) continue;
    const groupParts: string[] = [];
    for (const group of tree.groups) {
      const sql = buildGroupSql(group, fieldTypes, params);
      if (!sql) {
        groupParts.length = 0;
        break;
      }
      groupParts.push(sql);
    }
    if (groupParts.length === 0) continue;
    parts.push(joinPredicates(groupParts, tree.rootCombinator));
  }
  if (parts.length === 0) return null;
  return { sql: joinPredicates(parts, "or"), params };
}

export function formatOperatorLabel(operator: string): string {
  switch (operator) {
    case "is":
      return "is";
    case "is_not":
      return "is not";
    case "contains":
      return "contains";
    case "starts_with":
      return "starts with";
    case "is_empty":
      return "is empty";
    case "is_not_empty":
      return "is not empty";
    case "eq":
      return "=";
    case "neq":
      return "≠";
    case "gt":
      return "above";
    case "lt":
      return "below";
    case "between":
      return "between";
    case "is_true":
      return "is true";
    case "is_false":
      return "is false";
    case "is_any_of":
      return "is any of";
    case "is_none_of":
      return "is none of";
    case "before":
      return "before";
    case "after":
      return "after";
    case "in_last_n_days":
      return "in the last";
    default:
      return operator.replaceAll("_", " ");
  }
}

export function formatConditionValue(condition: SegmentCondition): string {
  const op = condition.operator;
  if (op === "is_empty" || op === "is_not_empty" || op === "is_true" || op === "is_false") {
    return "";
  }
  if (op === "between" && Array.isArray(condition.value)) {
    return `${condition.value[0]}–${condition.value[1]}`;
  }
  if ((op === "is_any_of" || op === "is_none_of") && Array.isArray(condition.value)) {
    return condition.value.map(String).join(", ");
  }
  if (op === "in_last_n_days") {
    const days = daysValue(condition.value);
    return days == null ? "" : `${days} days`;
  }
  if (condition.value == null) return "";
  // An object here would render as "[object Object]" in the segment summary
  // shown to admins; JSON is at least inspectable.
  if (typeof condition.value === "object") return JSON.stringify(condition.value);
  return String(condition.value);
}

export function buildConditionSummary(
  tree: SegmentConditionsTree,
  fieldLabels: Map<string, string>,
): string {
  const groupTexts = tree.groups.map((group) => {
    const parts = group.conditions.map((condition) => {
      const label =
        fieldLabels.get(`${condition.fieldSource}:${condition.fieldKey}`) ??
        fieldLabels.get(condition.fieldKey) ??
        condition.fieldKey;
      const op = formatOperatorLabel(condition.operator);
      const value = formatConditionValue(condition);
      return value ? `${label} ${op} ${value}` : `${label} ${op}`;
    });
    const joiner = ` ${group.combinator.toUpperCase()} `;
    return parts.join(joiner);
  });
  const rootJoiner = ` ${tree.rootCombinator.toUpperCase()} `;
  return groupTexts.join(rootJoiner);
}

export function countConditions(tree: SegmentConditionsTree): {
  conditionCount: number;
  groupCount: number;
} {
  return {
    groupCount: tree.groups.length,
    conditionCount: tree.groups.reduce((sum, group) => sum + group.conditions.length, 0),
  };
}

/** Exported for tests — empty-value helper presence. */
export const __test = {
  EMPTY_VALUE_SQL,
  FILLED_VALUE_SQL,
  textValue,
  numberValue,
  numberPair,
  stringList,
  daysValue,
};
