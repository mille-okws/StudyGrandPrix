// Public OAuth client IDs are configuration, not secrets.
export const GOOGLE_OAUTH_CLIENT_ID = globalThis.STUDY_GRAND_PRIX_CONFIG?.googleClientId || '';
export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';
