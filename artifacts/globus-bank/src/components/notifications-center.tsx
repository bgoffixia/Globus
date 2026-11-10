import { useEffect, useState } from 'react';
import { Bell, CheckCheck, ShieldCheck, WalletCards, ArrowLeftRight } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useUser } from '@clerk/react';
import {
  getGetBankPushConfigQueryKey,
  getListBankNotificationsQueryKey,
  useDeleteBankPushSubscription,
  useGetBankPushConfig,
  useListBankNotifications,
  useMarkBankNotificationRead,
  useSaveBankPushSubscription,
} from '@workspace/api-client-react';

function decodeKey(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), char => char.charCodeAt(0));
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
  const [pushMessage, setPushMessage] = useState('');
  const [pushError, setPushError] = useState('');
  const [notificationError, setNotificationError] = useState('');
  const subscriptionStorageKey = user?.id ? `globus-push-subscription-id:${user.id}` : '';
  const [savedSubscriptionId, setSavedSubscriptionId] = useState(() =>
    subscriptionStorageKey ? localStorage.getItem(subscriptionStorageKey) ?? '' : '',
  );
  useEffect(() => {
    if (location === '/notifications') setOpen(true);
  }, [location]);
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
  const saveSubscription = useSaveBankPushSubscription();
  const deleteSubscription = useDeleteBankPushSubscription();
  const unreadCount = notifications.data?.filter(item => !item.readAt).length ?? 0;
  const supported = typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

  const enablePush = async () => {
    setPushError('');
    setPushMessage('');
    if (!supported) {
      setPushError('Browser push is not supported in this browser.');
      return;
    }
    if (!push.data?.configured || !push.data.publicKey) {
      setPushError('Browser push is not configured for this account.');
      return;
    }
    try {
      const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
      if (permission !== 'granted') {
        setPushError(permission === 'denied' ? 'Notifications are blocked in browser settings. Allow them there, then try again.' : 'Notification permission was not granted.');
        return;
      }
      const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeKey(push.data.publicKey),
      });
      const keys = subscription.toJSON().keys;
      if (!subscription.endpoint || !keys?.p256dh || !keys.auth) throw new Error('The browser did not return a complete push subscription.');
      const result = await saveSubscription.mutateAsync({
        data: { endpoint: subscription.endpoint, p256dh: keys.p256dh, auth: keys.auth },
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
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      await subscription?.unsubscribe();
      setSavedSubscriptionId('');
      if (subscriptionStorageKey) localStorage.removeItem(subscriptionStorageKey);
      setPushMessage('Browser notifications are disabled for this device.');
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

  return (
    <div className="relative">
      <button type="button" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} aria-expanded={open} aria-controls="notifications-panel" onClick={() => setOpen(value => !value)} data-testid="button-notifications-center" className="relative grid h-9 w-9 place-items-center rounded-lg border border-[#d6e8e9] bg-white text-[#377d83] hover:bg-[#eff8f8]">
        <Bell size={16} />
        {unreadCount > 0 && <span data-testid="badge-notification-unread-count" className="absolute -right-1 -top-1 grid h-[17px] min-w-[17px] place-items-center rounded-full border-2 border-[#f7f9fb] bg-[#b5574e] px-1 text-[8px] font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>
      {open && <div id="notifications-panel" role="dialog" aria-label="Notifications center" className="absolute right-0 top-11 z-50 w-[min(380px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-[#dfe7ec] bg-white shadow-[0_20px_55px_rgba(19,46,76,.18)]" data-testid="notifications-panel">
        <div className="flex items-center justify-between border-b border-[#edf0f3] px-4 py-3">
          <div><h2 className="text-[12px] font-bold text-[#203851]">Notifications</h2><p className="mt-0.5 text-[9px] text-[#8290a0]">{unreadCount ? `${unreadCount} unread` : 'All caught up'}</p></div>
          <button type="button" aria-label="Close notifications" onClick={() => setOpen(false)} data-testid="button-close-notifications" className="rounded-md px-2 py-1 text-[9px] font-bold text-[#61758a] hover:bg-[#f2f6f7]">Close</button>
        </div>
        <div className="max-h-[min(48dvh,390px)] overflow-y-auto">
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
        <div className="border-t border-[#edf0f3] bg-[#fbfcfd] p-3">
          <p className="text-[9px] font-bold text-[#40576f]">Browser alerts</p>
          <p className="mt-0.5 text-[8px] leading-4 text-[#8492a1]">Opt in to device notifications for account activity.</p>
          {push.isError && <p role="alert" className="mt-1 text-[8px] text-[#a24940]">Push settings are unavailable.</p>}
          {pushError && <p role="alert" data-testid="status-browser-push-error" className="mt-1 rounded-md bg-[#fff1ef] px-2 py-1.5 text-[8px] text-[#a24940]">{pushError}</p>}
          {pushMessage && <p role="status" data-testid="status-browser-push-message" className="mt-1 rounded-md bg-[#eef7f1] px-2 py-1.5 text-[8px] text-[#41755f]">{pushMessage}</p>}
          <div className="mt-2 flex items-center justify-between gap-2">
            <span data-testid="status-browser-push-config" className="text-[8px] text-[#8794a2]">{push.isLoading ? 'Checking availability…' : !supported ? 'Not supported in this browser' : push.data?.configured ? 'Available' : 'Not configured'}</span>
            {savedSubscriptionId ? <button type="button" disabled={deleteSubscription.isPending} onClick={() => void disablePush()} data-testid="button-disable-browser-push" className="h-8 rounded-lg border border-[#dfe6eb] bg-white px-3 text-[9px] font-bold text-[#52697e] disabled:opacity-50">{deleteSubscription.isPending ? 'Disabling…' : 'Disable alerts'}</button> :
              <button type="button" disabled={!supported || !push.data?.configured || saveSubscription.isPending} onClick={() => void enablePush()} data-testid="button-enable-browser-push" className="h-8 rounded-lg bg-[#173858] px-3 text-[9px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">{saveSubscription.isPending ? 'Enabling…' : 'Enable alerts'}</button>}
          </div>
        </div>
      </div>}
    </div>
  );
}
