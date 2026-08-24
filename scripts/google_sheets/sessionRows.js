const MAX_CELL_CHARACTERS = 49_000;

const EXPORT_HEADERS = [
  'participant_id',
  'condition',
  'assignment_mode',
  'phase',
  'scenario_row_id',
  'created_at',
  'completed_at',
  'name',
  'org',
  'turn5_input_method',
  'turn5_user_message',
  'pre_survey_json',
  'safety_case_json',
  'turn0_json',
  'intro_script_json',
  'turn4_json',
  'turn5_json',
  'turn6_json',
  'post_survey_json',
];

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
}

function jsonCell(value) {
  if (value === undefined || value === null) return '';
  return JSON.stringify(stableValue(value));
}

function isoCell(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('export timestamp is invalid');
  return date.toISOString();
}

function assertCellSizes(row, participantId) {
  row.forEach((value, index) => {
    if (String(value ?? '').length > MAX_CELL_CHARACTERS) {
      throw new Error(
        `Google Sheets cell exceeds ${MAX_CELL_CHARACTERS} characters: ${participantId} ${EXPORT_HEADERS[index]}`,
      );
    }
  });
}

function buildExportRow(session) {
  const data = session.data && typeof session.data === 'object' ? session.data : {};
  const preSurvey = data.preSurvey || {};
  const turn5 = data.turn5 || {};
  const row = [
    session.participantId,
    session.condition,
    session.assignmentMode,
    session.phase,
    data.scenarioRowId ?? '',
    isoCell(session.createdAt),
    isoCell(session.completedAt),
    preSurvey.profile?.name || '',
    preSurvey.profile?.org || '',
    turn5.inputMethod || '',
    turn5.userMessage || '',
    jsonCell(preSurvey),
    jsonCell(data.safetyCase),
    jsonCell(data.turn0),
    jsonCell(data.introScript),
    jsonCell(data.turn4),
    jsonCell(turn5),
    jsonCell(data.turn6),
    jsonCell(data.postSurvey),
  ];
  assertCellSizes(row, session.participantId);
  return row;
}

module.exports = {
  EXPORT_HEADERS,
  MAX_CELL_CHARACTERS,
  buildExportRow,
};
