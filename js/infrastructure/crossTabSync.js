const CHANNEL = 'study-grand-prix-data-v1';
let channel;
const listeners = new Set();
function notify() { for (const listener of listeners) listener(); }
export function publishChange() {
    // Notification failure must never turn a committed transaction into a failure.
    try { channel?.postMessage({ type: 'changed' }); } catch { /* Reconcile on focus/poll. */ }
}
export function subscribeChanges(listener) {
    if (!channel && typeof BroadcastChannel !== 'undefined') {
        try {
            channel = new BroadcastChannel(CHANNEL);
            channel.onmessage = notify;
        } catch { channel = null; } // Some browsers expose the API but deny it.
    }
    listeners.add(listener);
    return () => listeners.delete(listener);
}
// Notifications are hints. Focus and polling reconcile from IndexedDB even if
// BroadcastChannel is unavailable or a message was missed while suspended.
window.addEventListener('focus', notify);
document.addEventListener('visibilitychange', () => { if (!document.hidden) notify(); });
setInterval(notify, 10000);
