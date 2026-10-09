// src/attribution.js
// TokenPulse: Configurable Attribution Resolution and Entity Validation Service

// Preconfigured Known Enterprise Teams
export const DEFAULT_TEAMS = [
  { id: 'team_eng', name: 'Core Engineering', description: 'Backend, Frontend, and Infrastructure Engineering' },
  { id: 'team_support', name: 'Customer Support', description: 'Customer Experience, Tier 1-3 Support, and Ticketing' },
  { id: 'team_ds', name: 'Data Science', description: 'Analytics, Machine Learning, and Big Data Engineering' },
  { id: 'team_mkt', name: 'Marketing & Content', description: 'Digital Marketing, Content Ops, and Growth SEO' },
  { id: 'team_product', name: 'Product Growth', description: 'Product Management, Onboarding, and Growth Experiments' }
];

// Preconfigured Known Enterprise Features
export const DEFAULT_FEATURES = [
  { id: 'feat_codereview', name: 'Code Review Assistant', team_id: 'team_eng', description: 'Automated PR code quality & security checks' },
  { id: 'feat_archcopilot', name: 'Architecture Copilot', team_id: 'team_eng', description: 'System design helper & RFC drafting' },
  { id: 'feat_citriage', name: 'CI Bug Triager', team_id: 'team_eng', description: 'Continuous integration failure analysis' },

  { id: 'feat_ticketsummary', name: 'Ticket Summarizer', team_id: 'team_support', description: 'Customer conversation & ticket summaries' },
  { id: 'feat_autoresp', name: 'Auto Responder Bot', team_id: 'team_support', description: 'Instant tier-1 support agent responses' },
  { id: 'feat_livechat', name: 'Live Chat Assistant', team_id: 'team_support', description: 'Agent co-pilot for real-time customer messaging' },

  { id: 'feat_sqlgen', name: 'SQL Query Generator', team_id: 'team_ds', description: 'Natural language to SQL query translator' },
  { id: 'feat_datapipeline', name: 'Data Pipeline Explainer', team_id: 'team_ds', description: 'DAG & data lineage explanations' },
  { id: 'feat_jupyter', name: 'Jupyter Copilot', team_id: 'team_ds', description: 'Notebook data science code assistant' },

  { id: 'feat_seoblog', name: 'SEO Blog Drafter', team_id: 'team_mkt', description: 'Content marketing long-form drafts' },
  { id: 'feat_adcopy', name: 'Ad Copy Optimizer', team_id: 'team_mkt', description: 'Ad variant generator & A/B test copy' },
  { id: 'feat_social', name: 'Social Media Campaign', team_id: 'team_mkt', description: 'Multi-platform social content generation' },

  { id: 'feat_sentiment', name: 'Customer Sentiment Analyzer', team_id: 'team_product', description: 'NPS & review sentiment classification' },
  { id: 'feat_feedback', name: 'Feature Feedback Classifier', team_id: 'team_product', description: 'User feedback taxonomy classifier' },
  { id: 'feat_churn', name: 'Churn Predictor', team_id: 'team_product', description: 'AI churn risk assessment assistant' }
];

/**
 * Normalizes text for case-insensitive matching
 */
function cleanStr(s) {
  return String(s || '').trim().toLowerCase();
}

/**
 * Resolves and validates attribution metadata
 * Enforces strict policy: unverified or missing entities are marked as 'Unassigned'
 * 
 * @param {object} req - Express request object
 * @param {Array} [knownTeams] - List of configured teams
 * @param {Array} [knownFeatures] - List of configured features
 * @returns {object} Validated attribution record
 */
export function resolveAttribution(req, knownTeams = DEFAULT_TEAMS, knownFeatures = DEFAULT_FEATURES) {
  const headers = req.headers || {};
  const body = req.body || {};
  const query = req.query || {};

  // Extract raw candidates from standard headers, body metadata, or query parameters
  const rawTeam = 
    headers['x-team'] ||
    headers['x-team-id'] ||
    body.metadata?.team ||
    body.metadata?.team_id ||
    body.team ||
    query.team ||
    '';

  const rawFeature = 
    headers['x-feature'] ||
    headers['x-feature-id'] ||
    body.metadata?.feature ||
    body.metadata?.feature_id ||
    body.feature ||
    query.feature ||
    '';

  const rawUser = 
    headers['x-user'] ||
    headers['x-user-id'] ||
    body.metadata?.user ||
    body.metadata?.user_id ||
    body.user ||
    query.user ||
    '';

  // 1. Team Validation
  let validatedTeam = 'Unassigned';
  let teamId = 'unassigned';
  let teamStatus = 'unassigned';

  if (rawTeam) {
    const cleanRaw = cleanStr(rawTeam);
    const match = knownTeams.find(t => 
      cleanStr(t.name) === cleanRaw || 
      cleanStr(t.id) === cleanRaw
    );
    if (match) {
      validatedTeam = match.name;
      teamId = match.id;
      teamStatus = 'verified';
    } else {
      // Unrecognized entity - record as unassigned
      validatedTeam = 'Unassigned';
      teamId = 'unassigned';
      teamStatus = 'unknown_entity';
    }
  }

  // 2. Feature Validation
  let validatedFeature = 'Unassigned';
  let featureId = 'unassigned';
  let featureStatus = 'unassigned';

  if (rawFeature) {
    const cleanRaw = cleanStr(rawFeature);
    const match = knownFeatures.find(f => 
      cleanStr(f.name) === cleanRaw || 
      cleanStr(f.id) === cleanRaw
    );
    if (match) {
      validatedFeature = match.name;
      featureId = match.id;
      featureStatus = 'verified';
    } else {
      validatedFeature = 'Unassigned';
      featureId = 'unassigned';
      featureStatus = 'unknown_entity';
    }
  }

  // 3. User Sanitization
  let sanitizedUser = 'anonymous';
  if (rawUser) {
    // Sanitize user: alphanumeric, dots, dashes, underscores, @
    sanitizedUser = String(rawUser).trim().replace(/[^a-zA-Z0-9._@-]/g, '');
    if (!sanitizedUser) sanitizedUser = 'anonymous';
  }

  return {
    team: validatedTeam,
    teamId,
    teamStatus,
    feature: validatedFeature,
    featureId,
    featureStatus,
    userId: sanitizedUser,
    isFullyAttributed: teamStatus === 'verified' && featureStatus === 'verified'
  };
}
