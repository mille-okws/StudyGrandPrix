// Public OAuth client IDs are configuration, not secrets. Keep validation
// here so every consumer sees the same normalized value.
const configuredClientId = globalThis.STUDY_GRAND_PRIX_CONFIG?.googleClientId;
const normalizedClientId = typeof configuredClientId === 'string'
    ? configuredClientId.trim()
    : '';

// Google web client IDs use this suffix. The prefix is intentionally kept
// permissive because Google may vary its numeric project identifier format.
export const isGoogleClientId = value => typeof value === 'string'
    && /^[^\s/]+\.apps\.googleusercontent\.com$/.test(value.trim());

export const GOOGLE_OAUTH_CLIENT_ID = isGoogleClientId(normalizedClientId)
    ? normalizedClientId
    : '';

export const GOOGLE_OAUTH_CONFIG_ERROR = normalizedClientId && !isGoogleClientId(normalizedClientId)
    ? 'O Client ID do Google tem formato inválido.'
    : '';

export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';
