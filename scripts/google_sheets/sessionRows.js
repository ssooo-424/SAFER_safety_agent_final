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
  'job_type',
  'position',
  'career',
  'profile_code',
  'important_person',
  'major_process',
  'detail_process',
  'process_content',
  'risk_type',
  'triggers',
  'selected_scenario',
  'accident_types',
  'feeling',
  'low_reason',
  'pre_extra_comment',
  'turn5_input_method',
  'turn5_user_message',
  'turn5_covered_count',
  'turn5_missing_count',
  'commit_selected_rule',
  'commit_final_phrase',
  'P1_1',
  'P1_2',
  'P1_3',
  'P1_4',
  'P2_1',
  'P2_3',
  'P2_4',
  'R1',
  'R2',
  'R3',
  'C1',
  'C2',
  'I1',
  'D1_fear_a',
  'D1_fear_b',
  'D1_tension_a',
  'D1_tension_b',
  'D1_discomfort_a',
  'D1_discomfort_b',
  'D2',
  'interview_1',
  'interview_2',
  'turn0_message',
  'turn1_message',
  'turn2_message',
  'turn3_messages',
  'organizational_outcome_messages',
  'turn4_message',
  'turn5_feedback',
  'turn6_message',
  'pre_survey_json',
  'safety_case_json',
  'intro_script_json',
  'post_survey_json',
  'turn0_dwell_sec',
  'turn1_dwell_sec',
  'turn2_dwell_sec',
  'turn3_dwell_sec',
  'organizational_outcome_dwell_sec',
  'turn4_dwell_sec',
  'turn5_dwell_sec',
  'turn6_dwell_sec',
  'chat_total_dwell_sec',
  'chat_total_elapsed_sec',
  'chat_hidden_sec',
  'turn_timings_json',
  'pre_R1',
  'pre_R2',
  'pre_R3',
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

function listCell(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(' | ');
  return value ?? '';
}

function assistantCell(value) {
  return String(value?.assistant || '').trim();
}

function secondsCell(milliseconds) {
  const value = Number(milliseconds);
  return Number.isFinite(value) && value >= 0 ? Number((value / 1000).toFixed(1)) : '';
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
  const profile = preSurvey.profile || {};
  const incident = preSurvey.incident || {};
  const psychology = preSurvey.psychology || {};
  const turn5 = data.turn5 || {};
  const evaluation = turn5.response?.evaluation || {};
  const introScript = data.introScript || {};
  const postSurvey = data.postSurvey || null;
  const postData = postSurvey?.data || postSurvey || {};
  const completedAt = session.completedAt || postSurvey?.timestamp;
  const timings = data.turnTimings || {};
  const timingStages = [
    'turn0', 'turn1', 'turn2', 'turn3', 'organizational_outcome', 'turn4', 'turn5', 'turn6'
  ];
  const hasTiming = timingStages.some(stage => timings[stage]);
  const sumTiming = field => timingStages.reduce(
    (total, stage) => total + (Number(timings[stage]?.[field]) || 0),
    0
  );
  const row = [
    session.participantId,
    session.condition,
    session.assignmentMode,
    session.phase,
    data.scenarioRowId ?? '',
    isoCell(session.createdAt),
    isoCell(completedAt),
    profile.name || '',
    profile.org || '',
    listCell(profile.jobType),
    profile.position || '',
    profile.career || '',
    profile.profileCode || '',
    profile.importantPerson || '',
    incident.majorProcess || '',
    incident.detailProcess || '',
    incident.processContent || '',
    incident.riskType || '',
    listCell(incident.triggers),
    incident.sentence || '',
    listCell(incident.accidents),
    incident.feeling || '',
    listCell(psychology.lowReason),
    psychology.extraComment || '',
    turn5.inputMethod || '',
    turn5.userMessage || '',
    evaluation.coveredCount ?? '',
    evaluation.missingCount ?? '',
    postSurvey?.commitSelectedRule || '',
    postSurvey?.commitFinalPhrase || '',
    postData.P1_1 ?? '',
    postData.P1_2 ?? '',
    postData.P1_3 ?? '',
    postData.P1_4 ?? '',
    postData.P2_1 ?? '',
    postData.P2_3 ?? '',
    postData.P2_4 ?? '',
    postData.R1 ?? '',
    postData.R2 ?? '',
    postData.R3 ?? '',
    postData.C1 ?? '',
    postData.C2 ?? '',
    postData.I1 ?? '',
    postData.D1_fear_a ?? '',
    postData.D1_fear_b ?? '',
    postData.D1_tension_a ?? '',
    postData.D1_tension_b ?? '',
    postData.D1_discomfort_a ?? '',
    postData.D1_discomfort_b ?? '',
    postData.D2 ?? '',
    postData.interview_1 || '',
    postData.interview_2 || '',
    assistantCell(data.turn0),
    introScript.turn1 || '',
    introScript.turn2 || '',
    listCell(introScript.turn3Messages || introScript.turn3),
    listCell(introScript.organizationalOutcomeMessages),
    assistantCell(data.turn4),
    assistantCell(turn5.response),
    assistantCell(data.turn6),
    jsonCell(preSurvey),
    jsonCell(data.safetyCase),
    jsonCell(introScript),
    jsonCell(postSurvey),
    ...timingStages.map(stage => secondsCell(timings[stage]?.activeMs)),
    hasTiming ? secondsCell(sumTiming('activeMs')) : '',
    hasTiming ? secondsCell(sumTiming('totalMs')) : '',
    hasTiming ? secondsCell(sumTiming('hiddenMs')) : '',
    jsonCell(hasTiming ? timings : null),
    psychology.riskPerception?.R1 ?? '',
    psychology.riskPerception?.R2 ?? '',
    psychology.riskPerception?.R3 ?? '',
  ];
  assertCellSizes(row, session.participantId);
  return row;
}

module.exports = {
  EXPORT_HEADERS,
  MAX_CELL_CHARACTERS,
  buildExportRow,
};
