// Marketing milestones only. Player answers and research logs stay in the game.
(function () {
  'use strict';
  const config = window.MeridianAnalyticsConfig || {};
  const url = new URL(location.href);
  const excluded = ['test', 'debug', 'onboarded', 'sandbox'].some(key => url.searchParams.has(key));
  const enabled = /^G-[A-Z0-9]+$/.test(config.measurement_id || '') &&
    (config.hosts || []).includes(url.hostname) && url.pathname.startsWith(config.path || '/meridian/') &&
    !excluded && navigator.doNotTrack !== '1' && window.doNotTrack !== '1' && !navigator.globalPrivacyControl;
  const seen = new Set();
  let pendingRound = null;
  const events = new Set(['game_ready', 'play_started', 'first_round_started', 'first_round_completed']);
  const modes = new Set(['guided', 'chart', 'flags', 'capitals', 'speedrun', 'family', 'daily', 'review', 'journey', 'test_out']);
  // Keep only campaign tags, never debug options, pasted text or arbitrary URL data.
  const landing = new URL(url.origin + url.pathname);
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']) {
    const value = url.searchParams.get(key);
    if (value && /^[a-zA-Z0-9_-]{1,100}$/.test(value)) landing.searchParams.set(key, value);
  }
  function send(name, parameters = {}) {
    window.gtag('event', name, {send_to: config.measurement_id, page_location: landing.href, ...parameters});
  }
  window.MeridianAnalytics = {
    track(name, mode = '') {
      if (!enabled || !events.has(name) || seen.has(name)) return;
      // Godot creates its first scene behind the loader. Count play only after the tap.
      if (name === 'first_round_started' && !seen.has('play_started')) {
        pendingRound = mode;
        return;
      }
      if (name === 'first_round_completed' && !seen.has('first_round_started')) return;
      seen.add(name);
      send(name, modes.has(mode) ? {game_mode: mode} : {});
      if (name === 'play_started' && pendingRound !== null) {
        const firstMode = pendingRound;
        pendingRound = null;
        this.track('first_round_started', firstMode);
      }
    }
  };
  if (!enabled) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', config.measurement_id, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    page_location: landing.href,
    page_referrer: document.referrer ? new URL(document.referrer).origin : '',
    page_title: 'Meridian'
  });
  send('page_view', {page_title: 'Meridian'});
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + config.measurement_id;
  document.head.appendChild(script);
}());
