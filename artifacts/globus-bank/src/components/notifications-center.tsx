import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, ShieldCheck, WalletCards, ArrowLeftRight } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useUser } from '@clerk/react';
import {
  getGetBankPushConfigQueryKey,
  getListBankNotificationsQueryKey,
  useClearBankNotifications,
  useDeleteBankPushSubscription,
  useGetBankPushConfig,
  useListBankNotifications,
  useMarkBankNotificationRead,
  useSaveBankPushSubscription,
} from '@workspace/api-client-react';

type WebpushrCommand = (method: string, argument?: unknown) => void;
declare global {
  interface Window {
    webpushr?: WebpushrCommand;
    __globusWebpushrLoad?: Promise<WebpushrCommand>;
    __globusWebpushrSiteKey?: string;
  }
}

function loadWebpushr(siteKey: string): Promise<WebpushrCommand> {
  if (window.__globusWebpushrLoad) return window.__globusWebpushrLoad;
  window.__globusWebpushrLoad = new Promise((resolve, reject) => {
    const setup = () => {
      const api = window.webpushr;
      if (!api) {
        reject(new Error('Webpushr did not finish loading.'));
        return;
      }
      if (window.__globusWebpushrSiteKey !== siteKey) {
        const base = new URL(import.meta.env.BASE_URL || '/', window.location.origin);
        const worker = new URL('sw.js', base).pathname;
        api('setup', {
          key: siteKey,
          sw: worker,
          scope: base.pathname,
          integration: 'https',
        });
        window.__globusWebpushrSiteKey = siteKey;
      }
      resolve(api);
    };

    const existing = document.getElementById('webpushr-script') as HTMLScriptElement | null;
    if (existing) {
      if (window.webpushr && window.__globusWebpushrSiteKey === siteKey) {
        resolve(window.webpushr);
      } else {
        existing.addEventListener('load', setup, { once: true });
        existing.addEventListener('error', () => reject(new Error('Webpushr could not be loaded.')), { once: true });
      }
      return;
    }

    if (!window.webpushr) {
      const queue: unknown[][] = [];
      const queuedApi = ((...args: unknown[]) => { queue.push(args); }) as WebpushrCommand & { q?: unknown[][] };
      queuedApi.q = queue;
      window.webpushr = queuedApi;
    }
    const script = document.createElement('script');
    script.id = 'webpushr-script';
    script.src = 'https://cdn.webpushr.com/app.min.js';
    script.async = true;
    script.referrerPolicy = 'strict-origin-when-cross-origin';
    script.onload = setup;
    script.onerror = () => reject(new Error('Webpushr could not be loaded.'));
    document.head.appendChild(script);
  });
  window.__globusWebpushrLoad.catch(() => { window.__globusWebpushrLoad = undefined; });
  return window.__globusWebpushrLoad;
}

function fetchWebpushrSubscriberId(api: WebpushrCommand): Promise<string | null> {
  return new Promise(resolve => {
    const timeout = window.setTimeout(() => resolve(null), 7000);
    try {
      api('fetch_id', (value: unknown) => {
        window.clearTimeout(timeout);
        resolve(typeof value === 'string' && /^[A-Za-z0-9._:-]{1,160}$/.test(value) ? value : null);
      });
    } catch {
      window.clearTimeout(timeout);
      resolve(null);
    }
  });
}

const categoryIcon = {
  transfer: ArrowLeftRight,
  wallet: WalletCards,
  security: ShieldCheck,
};

export function NotificationsCenter() {
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const { user } = useUser();
  const [open, setOpen] = useState(location === '/notifications');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelTop, setPanelTop] = useState(56);
  const [pushMessage, setPushMessage] = useState('');
  const [pushError, setPushError] = useState('');
  const [notificationError, setNotificationError] = useState('');
  const subscriptionStorageKey = user?.id ? `globus-push-subscription-id:${user.id}` : '';
  const permissionPromptStorageKey = user?.id ? `globus-push-permission-prompted:${user.id}` : '';
  const [savedSubscriptionId, setSavedSubscriptionId] = useState(() =>
    subscriptionStorageKey ? localStorage.getItem(subscriptionStorageKey) ?? '' : '',
  );
  useEffect(() => {
    if (location === '/notifications') setOpen(true);
  }, [location]);
  useEffect(() => {
    if (!open) return;
    const placePanel = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      if (!trigger) return;
      setPanelTop(Math.max(8, Math.min(trigger.bottom + 8, window.innerHeight - 350)));
    };
    placePanel();
    window.addEventListener('resize', placePanel);
    window.addEventListener('scroll', placePanel, true);
    const dismissOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismissOutside);
    return () => {
      window.removeEventListener('resize', placePanel);
      window.removeEventListener('scroll', placePanel, true);
      document.removeEventListener('pointerdown', dismissOutside);
    };
  }, [open]);
  useEffect(() => {
    if (!subscriptionStorageKey) {
      setSavedSubscriptionId('');
      return;
    }
    setSavedSubscriptionId(localStorage.getItem(subscriptionStorageKey) ?? '');
  }, [subscriptionStorageKey]);
  const notifications = useListBankNotifications({
    query: { queryKey: getListBankNotificationsQueryKey(), refetchOnWindowFocus: true, refetchInterval: 60_000 },
  });
  const push = useGetBankPushConfig({ query: { queryKey: getGetBankPushConfigQueryKey(), retry: false } });
  const markRead = useMarkBankNotificationRead();
  const clearNotifications = useClearBankNotifications();
  const saveSubscription = useSaveBankPushSubscription();
  const saveSubscriber = saveSubscription.mutateAsync;
  const deleteSubscription = useDeleteBankPushSubscription();
  const unreadCount = notifications.data?.filter(item => !item.readAt).length ?? 0;
  const supported = typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

  useEffect((): (() => void) | undefined => {
    if (!user?.id || !push.data?.configured || !push.data.siteKey || !supported) return undefined;
    if (Notification.permission === 'granted') {
      if (subscriptionStorageKey && localStorage.getItem(subscriptionStorageKey)) return undefined;
      let cancelled = false;
      void (async () => {
        try {
          const siteKey = push.data?.siteKey;
          if (!siteKey) return;
          const api = await loadWebpushr(siteKey);
          const subscriberId = await fetchWebpushrSubscriberId(api);
          if (!subscriberId || cancelled) return;
          const result = await saveSubscriber({ data: { subscriberId } });
          if (cancelled) return;
          setSavedSubscriptionId(result.id ?? '');
          if (result.id && subscriptionStorageKey) {
            localStorage.setItem(subscriptionStorageKey, result.id);
          }
          setPushMessage('Browser alerts are enabled on this device.');
          await queryClient.invalidateQueries({ queryKey: getGetBankPushConfigQueryKey() });
        } catch (err) {
          if (!cancelled) {
            setPushError(err instanceof Error ? err.message : 'Browser alerts could not be linked automatically.');
          }
        }
      })();
      return () => { cancelled = true; };
    }

    if (
      Notification.permission === 'default' &&
      permissionPromptStorageKey &&
      !localStorage.getItem(permissionPromptStorageKey)
    ) {
      localStorage.setItem(permissionPromptStorageKey, 'shown');
      setPushMessage('In-app notifications are on for your account. Tap Enable alerts to allow browser notifications on this device.');
      setOpen(true);
    }
    return undefined;
  }, [
    permissionPromptStorageKey,
    push.data?.configured,
    push.data?.siteKey,
    queryClient,
    saveSubscriber,
    subscriptionStorageKey,
    supported,
    user?.id,
  ]);

  const enablePush = async () => {
    setPushError('');
    setPushMessage('');
    if (!supported) {
      setPushError('Browser push is not supported in this browser.');
      return;
    }
    if (!push.data?.configured || !push.data.siteKey) {
      setPushError('Webpushr has not been configured for this app.');
      return;
    }
    try {
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }
      if (permission !== 'granted') {
        setPushError('Notifications are blocked in browser settings. Allow them there, then try again.');
        return;
      }
      const api = await loadWebpushr(push.data.siteKey);
      const subscriberId = await fetchWebpushrSubscriberId(api);
      if (!subscriberId) {
        setPushMessage('Complete the Webpushr permission prompt, then select Enable alerts again to link this device.');
        return;
      }
      const result = await saveSubscriber({
        data: { subscriberId },
      });
      setSavedSubscriptionId(result.id ?? '');
      if (result.id && subscriptionStorageKey) {
        localStorage.setItem(subscriptionStorageKey, result.id);
      }
      setPushMessage('Browser notifications are enabled for this device.');
      await queryClient.invalidateQueries({ queryKey: getGetBankPushConfigQueryKey() });
    } catch (err) {
      setPushError(err instanceof Error ? err.message : 'Browser notifications could not be enabled.');
    }
  };
  const disablePush = async () => {
    setPushError('');
    setPushMessage('');
    if (!savedSubscriptionId) {
      setPushError('This browser subscription cannot be removed here. Enable push on this device first, then disable it from this session.');
      return;
    }
    try {
      await deleteSubscription.mutateAsync({ subscriptionId: savedSubscriptionId });
      setSavedSubscriptionId('');
      if (subscriptionStorageKey) localStorage.removeItem(subscriptionStorageKey);
      setPushMessage('Globus alerts are disconnected for this device. Browser permission can be changed in your device settings.');
      await queryClient.invalidateQueries({ queryKey: getGetBankPushConfigQueryKey() });
    } catch (err) {
      setPushError(err instanceof Error ? err.message : 'Browser notifications could not be disabled.');
    }
  };
  const readOne = async (id: string) => {
    setNotificationError('');
    try {
      await markRead.mutateAsync({ notificationId: id });
      await queryClient.invalidateQueries({ queryKey: getListBankNotificationsQueryKey() });
    } catch {
      setNotificationError('This notification could not be marked as read. Try again.');
    }
  };
  const clearAll = async () => {
    if (!notifications.data?.length) return;
    if (!window.confirm('Delete all notifications from this account? This cannot be undone.')) return;
    setNotificationError('');
    try {
      await clearNotifications.mutateAsync();
      await queryClient.invalidateQueries({ queryKey: getListBankNotificationsQueryKey() });
    } catch {
      setNotificationError('Notifications could not be cleared. Try again.');
    }
  };

  return (
    <div className="relative">
      <button ref={triggerRef} type="button" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} aria-haspopup="dialog" aria-expanded={open} aria-controls="notifications-panel" onClick={() => setOpen(value => !value)} data-testid="button-notifications-center" className="relative grid h-9 w-9 place-items-center rounded-lg border border-[#d6e8e9] bg-white text-[#377d83] hover:bg-[#eff8f8]">
        <Bell size={16} />
        {unreadCount > 0 && <span data-testid="badge-notification-unread-count" className="absolute -right-1 -top-1 grid h-[17px] min-w-[17px] place-items-center rounded-full border-2 border-[#f7f9fb] bg-[#b5574e] px-1 text-[8px] font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>
      {open && <div ref={panelRef} id="notifications-panel" role="dialog" aria-label="Notifications center" onKeyDown={event => { if (event.key === 'Escape') setOpen(false); }} style={{ top: panelTop, maxHeight: `calc(100dvh - ${panelTop}px - 8px)` }} className="fixed left-1/2 z-[100] flex w-[min(380px,calc(100vw-1.5rem))] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-[#dfe7ec] bg-white shadow-[0_20px_55px_rgba(19,46,76,.18)]" data-testid="notifications-panel">
          <div className="flex shrink-0 items-center justify-between border-b border-[#edf0f3] px-4 py-3">
          <div><h2 className="text-[12px] font-bold text-[#203851]">Notifications</h2><p className="mt-0.5 text-[9px] text-[#8290a0]">{unreadCount ? `${unreadCount} unread` : 'All caught up'}</p></div>
          <div className="flex items-center gap-2">
            <button type="button" disabled={!notifications.data?.length || clearNotifications.isPending} onClick={() => void clearAll()} data-testid="button-clear-notifications" className="rounded-md px-2 py-1 text-[9px] font-bold text-[#a24940] hover:bg-[#fff1ef] disabled:opacity-40">{clearNotifications.isPending ? 'Clearing…' : 'Clear all'}</button>
            <button type="button" aria-label="Close notifications" onClick={() => setOpen(false)} data-testid="button-close-notifications" className="rounded-md px-2 py-1 text-[9px] font-bold text-[#61758a] hover:bg-[#f2f6f7]">Close</button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {notificationError && <p role="alert" data-testid="status-notification-error" className="mx-4 mt-3 rounded-md bg-[#fff1ef] px-2 py-1.5 text-[8px] text-[#a24940]">{notificationError}</p>}
          {notifications.isLoading ? <div className="space-y-2 p-4" aria-label="Loading notifications" data-testid="notifications-loading">{[0, 1, 2].map(item => <div key={item} className="h-14 animate-pulse rounded-lg bg-[#f1f4f6]" />)}</div> :
            notifications.isError ? <div className="p-4 text-center"><p className="text-[10px] text-[#8d5b51]">Notifications could not be loaded.</p><button type="button" onClick={() => void notifications.refetch()} data-testid="button-retry-notifications" className="mt-2 text-[9px] font-bold text-[#397b80] underline">Try again</button></div> :
              notifications.data?.length ? <ul className="divide-y divide-[#edf0f2]">{notifications.data.map(item => {
                const Icon = categoryIcon[item.category];
                return <li key={item.id} data-testid={`notification-item-${item.id}`} className={`flex items-start gap-2.5 px-4 py-3 ${item.readAt ? 'bg-white' : 'bg-[#f4f9f9]'}`}>
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#e9f2f3] text-[#47858a]"><Icon size={14} /></span>
                  <div className="min-w-0 flex-1"><p className="text-[10px] font-bold text-[#334b64]" data-testid={`text-notification-title-${item.id}`}>{item.title}</p><p className="mt-1 text-[9px] leading-4 text-[#728296]">{item.body}</p><div className="mt-1 flex flex-wrap items-center gap-x-2 text-[8px] text-[#91a0ad]"><span>{new Date(item.createdAt).toLocaleString()}</span>{item.reference && <span className="font-mono">{item.reference}</span>}</div></div>
                  {!item.readAt && <button type="button" disabled={markRead.isPending} onClick={() => void readOne(item.id)} aria-label={`Mark ${item.title} as read`} data-testid={`button-mark-notification-read-${item.id}`} className="shrink-0 rounded-md p-1.5 text-[#548489] hover:bg-[#e5f0f0]"><CheckCheck size={14} /></button>}
                </li>;
              })}</ul> : <div className="px-5 py-8 text-center" data-testid="notifications-empty"><span className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-[#eef5f6] text-[#53858a]"><Bell size={16} /></span><p className="mt-2 text-[10px] font-bold text-[#3e566e]">No notifications yet</p><p className="mt-1 text-[9px] text-[#8794a2]">Account activity notices will appear here.</p></div>}
        </div>
        <div className="shrink-0 border-t border-[#edf0f3] bg-[#fbfcfd] p-3">
          <p className="text-[9px] font-bold text-[#40576f]">Browser alerts</p>
          <p className="mt-0.5 text-[8px] leading-4 text-[#8492a1]">In-app notifications are enabled for every account. Browser alerts are linked automatically where permission is already granted.</p>
          {push.isError && <p role="alert" className="mt-1 text-[8px] text-[#a24940]">Push settings are unavailable.</p>}
          {pushError && <p role="alert" data-testid="status-browser-push-error" className="mt-1 rounded-md bg-[#fff1ef] px-2 py-1.5 text-[8px] text-[#a24940]">{pushError}</p>}
          {pushMessage && <p role="status" data-testid="status-browser-push-message" className="mt-1 rounded-md bg-[#eef7f1] px-2 py-1.5 text-[8px] text-[#41755f]">{pushMessage}</p>}
          <div className="mt-2 flex items-center justify-between gap-2">
              <span data-testid="status-browser-push-config" className="text-[8px] text-[#8794a2]">{push.isLoading ? 'Checking availability…' : !supported ? 'Not supported in this browser' : push.data?.configured ? 'Webpushr available' : 'Not configured'}</span>
            {savedSubscriptionId ? <button type="button" disabled={deleteSubscription.isPending} onClick={() => void disablePush()} data-testid="button-disable-browser-push" className="h-8 rounded-lg border border-[#dfe6eb] bg-white px-3 text-[9px] font-bold text-[#52697e] disabled:opacity-50">{deleteSubscription.isPending ? 'Disabling…' : 'Disable alerts'}</button> :
              <button type="button" disabled={!supported || !push.data?.configured || saveSubscription.isPending} onClick={() => void enablePush()} data-testid="button-enable-browser-push" className="h-8 rounded-lg bg-[#173858] px-3 text-[9px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">{saveSubscription.isPending ? 'Linking…' : 'Enable alerts'}</button>}
          </div>
        </div>
      </div>}
    </div>
  );
}
