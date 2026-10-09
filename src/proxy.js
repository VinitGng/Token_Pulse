// src/proxy.js
// TokenPulse: Request Pipeline, Provider Adapter Dispatch, Telemetry Logger & Replay

import { calculateCost, normalizeModelName } from './pricing.js';
import { logRequest, getPricingTable, getTeams, getFeatures, getRequestById, db } from './db.js';
import { resolveAttribution } from './attribution.js';
import { checkPreRequestBudget } from './budgets.js';
import { resolveAdapter } from './adapters/index.js';
import { sanitizeHeadersForLogging } from './auth.js';

/**
 * Handles /v1/chat/completions requests through TokenPulse proxy pipeline
 */
export async function handleChatCompletions(req, res) {
  const startTime = Date.now();
  const body = req.body || {};
  const requestedModel = body.model || 'gpt-4o';
  const model = normalizeModelName(requestedModel);
  const isStream = Boolean(body.stream);

  // 1. Resolve and Validate Attribution
  const knownTeams = getTeams();
  const knownFeatures = getFeatures();
  const attribution = resolveAttribution(req, knownTeams, knownFeatures);

  // 2. Pre-Request Budget Check
  const budgetCheck = checkPreRequestBudget(db, attribution.team, attribution.feature);
  if (!budgetCheck.allowed) {
    return res.status(429).json({
      error: {
        message: budgetCheck.reason,
        type: 'budget_exceeded_error',
        code: 429,
        team: attribution.team,
        feature: attribution.feature
      }
    });
  }

  // 3. Resolve Provider Adapter
  const forceSimulated = req.headers['x-simulate'] === 'true' || body.simulate === true;
  const upstreamKey = req.headers['x-upstream-key'] || null;
  const requestedProvider = req.headers['x-provider'] || null;

  const { adapter, providerName, isSimulatedFallback, reason } = resolveAdapter(model, {
    forceSimulated,
    upstreamKey,
    provider: requestedProvider
  });

  const reqId = `req_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
  let statusCode = 200;
  let adapterResult = null;
  let executionError = null;

  // 4. Execute Request via Selected Provider Adapter
  try {
    const normalizedReq = adapter.normalizeRequest(body);
    adapterResult = await adapter.execute(normalizedReq, {
      simulatedDelay: req.headers['x-simulated-delay'],
      apiKey: upstreamKey
    });
  } catch (err) {
    statusCode = 500;
    executionError = err.message || 'Upstream provider failure';
    adapterResult = {
      content: `[Error: ${executionError}]`,
      isSimulated: adapter.providerName === 'simulated',
      usageSource: 'estimated',
      usage: { prompt_tokens: 0, completion_tokens: 0, cached_tokens: 0, total_tokens: 0 }
    };
  }

  const endTime = Date.now();
  const latencyMs = endTime - startTime;

  // 5. Extract Token Counts & Usage Source
  const promptTokens = adapterResult.usage?.prompt_tokens || 0;
  const completionTokens = adapterResult.usage?.completion_tokens || 0;
  const cachedTokens = adapterResult.usage?.cached_tokens || 0;
  const totalTokens = promptTokens + completionTokens + cachedTokens;
  const usageSource = adapterResult.usageSource || 'simulated';

  // 6. Calculate Cost with Decimal-Safe Arithmetic
  const pricingTable = getPricingTable();
  const cost = calculateCost(model, promptTokens, completionTokens, pricingTable, {
    cachedTokens,
    isFailedRequest: statusCode >= 400,
    provider: providerName
  });

  // Extract preview text
  let promptPreview = '';
  if (Array.isArray(body.messages)) {
    promptPreview = body.messages.map(m => `${m.role}: ${m.content}`).join('\n').slice(0, 300);
  } else if (typeof body.prompt === 'string') {
    promptPreview = body.prompt.slice(0, 300);
  }

  // 7. Persist Telemetry Record into Database
  const logRecord = {
    id: reqId,
    timestamp: startTime,
    iso_timestamp: new Date(startTime).toISOString(),
    team: attribution.team,
    feature: attribution.feature,
    user_id: attribution.userId,
    model: model,
    provider: providerName,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    cached_tokens: cachedTokens,
    total_tokens: totalTokens,
    prompt_cost: cost.promptCost,
    completion_cost: cost.completionCost,
    cached_cost: cost.cachedCost,
    total_cost: cost.totalCost,
    latency_ms: latencyMs,
    status_code: statusCode,
    is_stream: isStream ? 1 : 0,
    is_simulated: adapterResult.isSimulated ? 1 : 0,
    usage_source: usageSource,
    pricing_version: cost.pricingVersion || '2026-Q1',
    prompt_preview: promptPreview || '(empty prompt)',
    response_preview: (adapterResult.content || '').slice(0, 300),
    raw_metadata: JSON.stringify({
      attribution_status: { team: attribution.teamStatus, feature: attribution.featureStatus },
      budget_warning: budgetCheck.warning,
      fallback_reason: isSimulatedFallback ? reason : null,
      sanitized_headers: sanitizeHeadersForLogging(req.headers)
    })
  };

  logRequest(logRecord);

  // Return error response if provider execution failed
  if (statusCode >= 400) {
    return res.status(statusCode).json({
      error: {
        message: executionError,
        type: 'provider_execution_error',
        code: statusCode
      },
      request_id: reqId,
      cost_metadata: { total_cost_usd: 0 }
    });
  }

  // Set FinOps Observability Response Headers
  res.setHeader('x-tokenpulse-request-id', reqId);
  res.setHeader('x-tokenpulse-cost-usd', cost.totalCost.toString());
  res.setHeader('x-tokenpulse-tokens-total', totalTokens.toString());
  res.setHeader('x-tokenpulse-provider', providerName);
  res.setHeader('x-tokenpulse-simulated', adapterResult.isSimulated ? 'true' : 'false');
  if (budgetCheck.warning) {
    res.setHeader('x-tokenpulse-budget-warning', 'true');
  }

  // 8. Stream SSE or Return JSON
  if (isStream && adapterResult.isSimulated) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const words = adapterResult.content.split(' ');
    for (let i = 0; i < words.length; i++) {
      const chunk = {
        id: reqId,
        object: 'chat.completion.chunk',
        created: Math.floor(startTime / 1000),
        model: model,
        choices: [
          {
            index: 0,
            delta: { content: (i === 0 ? '' : ' ') + words[i] },
            finish_reason: i === words.length - 1 ? 'stop' : null
          }
        ]
      };
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      if (i % 4 === 0) {
        await new Promise(r => setTimeout(r, 15));
      }
    }

    // Stream usage chunk
    const usageChunk = {
      id: reqId,
      object: 'chat.completion.chunk',
      created: Math.floor(startTime / 1000),
      model: model,
      choices: [],
      usage: adapterResult.usage,
      cost_metadata: { total_cost_usd: cost.totalCost, rates: cost.rates }
    };
    res.write(`data: ${JSON.stringify(usageChunk)}\n\n`);
    res.write('data: [DONE]\n\n');
    return res.end();
  }

  // Standard JSON response
  const standardResponse = adapter.normalizeResponse(adapterResult, model, reqId);
  standardResponse.cost_metadata = {
    team: attribution.team,
    feature: attribution.feature,
    user: attribution.userId,
    prompt_cost_usd: cost.promptCost,
    completion_cost_usd: cost.completionCost,
    cached_cost_usd: cost.cachedCost,
    total_cost_usd: cost.totalCost,
    rates_per_million: cost.rates,
    latency_ms: latencyMs,
    usage_source: usageSource,
    is_simulated: adapterResult.isSimulated
  };

  return res.status(200).json(standardResponse);
}

/**
 * Replays a historical request through the proxy pipeline
 */
export async function handleRequestReplay(req, res) {
  const { id } = req.params;
  const original = getRequestById(id);
  if (!original) {
    return res.status(404).json({ success: false, error: 'Original request ID not found' });
  }

  // Construct synthetic request with original attribution
  const syntheticReq = {
    headers: {
      'x-team': original.team,
      'x-feature': original.feature,
      'x-user': original.user_id,
      'x-simulated-delay': '120'
    },
    body: {
      model: original.model,
      messages: [{ role: 'user', content: original.prompt_preview }],
      stream: false,
      replayedFrom: original.id
    }
  };

  return handleChatCompletions(syntheticReq, res);
}
