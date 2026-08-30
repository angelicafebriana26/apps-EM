export interface CriteriaLimit {
  alert: number | null;
  action: number | null;
  acceptance: number | null;
}

export type EMCriteriaConfig = Record<string, Record<string, CriteriaLimit>>;

export const emCriteriaMaster: EMCriteriaConfig = {
  'A': {
    '부유입자 ≥0.5 μm': { alert: 15, action: 24, acceptance: 29 },
    '부유입자 ≥5.0 μm': { alert: 1760, action: 2816, acceptance: 3520 },
    '부유균': { alert: 0, action: 0, acceptance: 0 },
    '낙하균': { alert: 0, action: 0, acceptance: 0 },
    '표면균': { alert: 0, action: 0, acceptance: 0 },
  },
  'B': {
    '부유입자 ≥0.5 μm': { alert: 1465, action: 2344, acceptance: 2930 },
    '부유입자 ≥5.0 μm': { alert: 176000, action: 281600, acceptance: 352000 },
    '부유균': { alert: 5, action: 8, acceptance: 10 },
    '낙하균': { alert: 3, action: 4, acceptance: 5 },
    '표면균': { alert: 3, action: 4, acceptance: 5 },
  },
  'C': {
    '부유입자 ≥0.5 μm': { alert: 14650, action: 23440, acceptance: 29300 },
    '부유입자 ≥5.0 μm': { alert: 1760000, action: 2816000, acceptance: 3520000 },
    '부유균': { alert: 50, action: 80, acceptance: 100 },
    '낙하균': { alert: 25, action: 40, acceptance: 50 },
    '표면균': { alert: 13, action: 20, acceptance: 25 },
  },
  'D': {
    '부유입자 ≥0.5 μm': { alert: null, action: null, acceptance: null },
    '부유입자 ≥5.0 μm': { alert: null, action: null, acceptance: null },
    '부유균': { alert: 100, action: 160, acceptance: 200 },
    '낙하균': { alert: 50, action: 80, acceptance: 100 },
    '표면균': { alert: 25, action: 40, acceptance: 50 },
  }
};

export function evaluateParameterStatus(grade: string | null, parameter: string | null, result: number | null): string {
  if (result === null || !grade || !parameter) return 'REVIEW REQUIRED';
  
  const rules = emCriteriaMaster[grade];
  if (!rules) return 'REVIEW REQUIRED'; // Unknown grade

  const limits = rules[parameter];
  if (!limits) return 'REVIEW REQUIRED'; // Unknown parameter

  // N/A criteria
  if (limits.alert === null && limits.action === null && limits.acceptance === null) {
    return 'NOT APPLICABLE';
  }

  // Zero-limit logic (Grade A micro)
  if (limits.alert === 0 && limits.action === 0 && limits.acceptance === 0) {
    return result === 0 ? 'PASS' : 'OOS';
  }

  // Standard limit logic
  if (limits.alert !== null && result <= limits.alert) return 'PASS';
  if (limits.action !== null && result <= limits.action) return 'ALERT';
  if (limits.acceptance !== null && result <= limits.acceptance) return 'ACTION';
  
  return 'OOS';
}

export function evaluateRoomConclusion(statuses: string[]): string {
  let highestSeverity = -1;
  const severityMap: Record<string, number> = {
    'PASS': 0,
    'ALERT': 1,
    'ACTION': 2,
    'OOS': 3
  };

  let hasReviewRequired = false;
  let hasApplicableParameters = false;

  for (const status of statuses) {
    if (status === 'NOT APPLICABLE') continue;
    if (status === 'REVIEW REQUIRED' || !status) {
      hasReviewRequired = true;
      continue;
    }
    
    hasApplicableParameters = true;
    const severity = severityMap[status] ?? -1;
    if (severity > highestSeverity) {
      highestSeverity = severity;
    }
  }

  if (hasReviewRequired) return 'REVIEW REQUIRED';
  if (!hasApplicableParameters) return 'REVIEW REQUIRED';

  if (highestSeverity === 3) return 'OOS';
  if (highestSeverity === 2) return 'ACTION';
  if (highestSeverity === 1) return 'ALERT';
  if (highestSeverity === 0) return 'PASS';

  return 'REVIEW REQUIRED';
}

export function getStatusColor(status: string | null): string {
  switch (status) {
    case 'PASS': return 'text-black';
    case 'ALERT': return 'text-blue-600';
    case 'ACTION': return 'text-green-600';
    case 'OOS': return 'text-red-600';
    case 'REVIEW REQUIRED': return 'text-orange-500';
    case 'NOT APPLICABLE': return 'text-gray-400';
    default: return 'text-gray-600';
  }
}
