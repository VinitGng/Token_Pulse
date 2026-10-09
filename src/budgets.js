// src/budgets.js
// TokenPulse: Budget Management, Threshold Alerts, and Real-Time Enforcement Engine

export const DEFAULT_BUDGETS = [
  { id: 'bgt_eng', entity_type: 'team', entity_id: 'Core Engineering', period: 'monthly', limit_usd: 50.00, alert_threshold: 0.80, enforcement_mode: 'monitor' },
  { id: 'bgt_support', entity_type: 'team', entity_id: 'Customer Support', period: 'monthly', limit_usd: 35.00, alert_threshold: 0.80, enforcement_mode: 'monitor' },
  { id: 'bgt_ds', entity_type: 'team', entity_id: 'Data Science', period: 'monthly', limit_usd: 40.00, alert_threshold: 0.80, enforcement_mode: 'monitor' },
  { id: 'bgt_mkt', entity_type: 'team', entity_id: 'Marketing & Content', period: 'monthly', limit_usd: 25.00, alert_threshold: 0.80, enforcement_mode: 'monitor' },
  { id: 'bgt_product', entity_type: 'team', entity_id: 'Product Growth', period: 'monthly', limit_usd: 20.00, alert_threshold: 0.80, enforcement_mode: 'monitor' }
];

/**
 * Gets start timestamp for a given budget period
 */
function getPeriodStartTime(period) {
  const now = new Date();
  if (period === 'daily') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }
  if (period === 'monthly') {
    return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  }
  return 0; // 'total' / all time
}

/**
 * Evaluates budget status for an entity
 */
export function evaluateEntityBudget(db, entityType, entityId) {
  const budgetStmt = db.prepare(`
    SELECT * FROM budgets 
    WHERE entity_type = ? AND entity_id = ?
  `);
  const budget = budgetStmt.get(entityType, entityId);
  if (!budget) return null;

  const startMs = getPeriodStartTime(budget.period);
  const spendStmt = db.prepare(`
    SELECT COALESCE(SUM(total_cost), 0.0) as current_spend
    FROM requests
    WHERE ${entityType === 'team' ? 'team = ?' : 'feature = ?'}
      AND timestamp >= ?
  `);
  const currentSpend = Number(Number(spendStmt.get(entityId, startMs).current_spend).toFixed(6));
  const limitUsd = Number(budget.limit_usd);
  const threshold = Number(budget.alert_threshold || 0.80);
  const utilizationPct = limitUsd > 0 ? Number(((currentSpend / limitUsd) * 100).toFixed(2)) : 0;
  const remainingUsd = Number(Math.max(0, limitUsd - currentSpend).toFixed(6));

  let status = 'HEALTHY';
  if (currentSpend >= limitUsd) {
    status = 'EXCEEDED';
  } else if (currentSpend >= limitUsd * threshold) {
    status = 'WARNING';
  }

  return {
    id: budget.id,
    entity_type: budget.entity_type,
    entity_id: budget.entity_id,
    period: budget.period,
    limit_usd: limitUsd,
    alert_threshold: threshold,
    enforcement_mode: budget.enforcement_mode,
    current_spend: currentSpend,
    remaining_usd: remainingUsd,
    utilization_pct: utilizationPct,
    status
  };
}

/**
 * Pre-request budget check before proxying LLM call
 * If enforcement_mode === 'enforce' and budget is exceeded, blocks request
 */
export function checkPreRequestBudget(db, teamName, featureName) {
  const teamBudget = evaluateEntityBudget(db, 'team', teamName);
  if (teamBudget) {
    if (teamBudget.enforcement_mode === 'enforce' && teamBudget.status === 'EXCEEDED') {
      return {
        allowed: false,
        reason: `Monthly budget exceeded for team '${teamName}' ($${teamBudget.current_spend.toFixed(2)} / $${teamBudget.limit_usd.toFixed(2)})`,
        budget: teamBudget
      };
    }
  }

  const featureBudget = evaluateEntityBudget(db, 'feature', featureName);
  if (featureBudget) {
    if (featureBudget.enforcement_mode === 'enforce' && featureBudget.status === 'EXCEEDED') {
      return {
        allowed: false,
        reason: `Monthly budget exceeded for feature '${featureName}' ($${featureBudget.current_spend.toFixed(2)} / $${featureBudget.limit_usd.toFixed(2)})`,
        budget: featureBudget
      };
    }
  }

  return {
    allowed: true,
    teamBudget,
    featureBudget,
    warning: (teamBudget?.status === 'WARNING' || featureBudget?.status === 'WARNING')
  };
}

/**
 * Gets all budgets with live utilization metrics
 */
export function getAllBudgetsWithMetrics(db) {
  const stmt = db.prepare('SELECT * FROM budgets ORDER BY entity_type, entity_id');
  const allBudgets = stmt.all();

  return allBudgets.map(b => {
    const startMs = getPeriodStartTime(b.period);
    const spendStmt = db.prepare(`
      SELECT COALESCE(SUM(total_cost), 0.0) as current_spend
      FROM requests
      WHERE ${b.entity_type === 'team' ? 'team = ?' : 'feature = ?'}
        AND timestamp >= ?
    `);
    const currentSpend = Number(Number(spendStmt.get(b.entity_id, startMs).current_spend).toFixed(6));
    const limitUsd = Number(b.limit_usd);
    const threshold = Number(b.alert_threshold || 0.80);
    const utilizationPct = limitUsd > 0 ? Number(((currentSpend / limitUsd) * 100).toFixed(2)) : 0;
    const remainingUsd = Number(Math.max(0, limitUsd - currentSpend).toFixed(6));

    let status = 'HEALTHY';
    if (currentSpend >= limitUsd) {
      status = 'EXCEEDED';
    } else if (currentSpend >= limitUsd * threshold) {
      status = 'WARNING';
    }

    return {
      id: b.id,
      entity_type: b.entity_type,
      entity_id: b.entity_id,
      period: b.period,
      limit_usd: limitUsd,
      alert_threshold: threshold,
      enforcement_mode: b.enforcement_mode,
      current_spend: currentSpend,
      remaining_usd: remainingUsd,
      utilization_pct: utilizationPct,
      status,
      updated_at: b.updated_at
    };
  });
}
