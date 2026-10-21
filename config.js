/*
 * Public runtime configuration for Study Grand Prix.
 *
 * This file is loaded before the ES module application entrypoint.  A Google
 * OAuth client id is public configuration; never place a client secret here.
 * Deployments may replace this file, or inject the same global before
 * index.js is loaded.
 */
(function initialiseStudyGrandPrixConfig(global) {
  const existing = global.STUDY_GRAND_PRIX_CONFIG;
  const configured = existing && typeof existing === 'object' ? existing : {};
  const clientId = typeof configured.googleClientId === 'string'
    ? configured.googleClientId.trim()
    : '';

  // Keep the global stable even when no OAuth client has been provisioned.
  // The calendar integration will remain optional and report a clear state.
  global.STUDY_GRAND_PRIX_CONFIG = Object.freeze({
    ...configured,
    googleClientId: clientId
  });
})(window);
