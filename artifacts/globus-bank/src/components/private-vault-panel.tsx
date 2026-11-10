import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/react';
import { useLocation } from 'wouter';
import {
  getGetBankVaultBillingQueryKey,
  getGetBankVaultEmailPreferencesQueryKey,
  getGetBankVaultStatusQueryKey,
  getGetBankPushConfigQueryKey,
  getGetBankPushPreferencesQueryKey,
  getListBankTransactionsQueryKey,
  getListBankVaultTransactionNotesQueryKey,
  getListBankVaultWalletControlsQueryKey,
  useCreateBankVaultSubscriptionProofUploadUrl,
  useDeleteBankPushSubscription,
  useDeleteBankVaultTransactionNote,
  useGetBankPushConfig,
  useGetBankPushPreferences,
  useGetBankVaultBilling,
  useGetBankVaultEmailPreferences,
  useGetBankVaultStatus,
  useInitializeBankVaultPasscode,
  useListBankTransactions,
  useListBankVaultTransactionNotes,
  useListBankVaultWalletControls,
  useRequestBankVaultSubscription,
  useSaveBankPushSubscription,
  useUnlockBankVault,
  useUpdateBankPushPreferences,
  useUpdateBankVaultEmailPreferences,
  useUpdateBankVaultPasscode,
  useUpdateBankVaultTransactionNote,
  useUpdateBankVaultWalletControl,
} from '@workspace/api-client-react';
import type { BankTransaction, BankVaultEmailPreferences, BankVaultProofUploadInputContentType, BankVaultWalletControl } from '@workspace/api-client-react';
import { fetchWebpushrSubscriberId, loadWebpushr } from '../lib/webpushr-client';

const fieldClass = 'h-9 w-full rounded-lg border border-[#dfe6eb] bg-white px-3 text-[11px] text-[#344b64] outline-none focus:border-[#77aeb0] focus:ring-2 focus:ring-[#77aeb0]/15';
type VaultPlanCode = '1m' | '3m' | '1y';
type SubscriptionStep = 'closed' | 'plans' | 'payment';
const proofContentTypes: BankVaultProofUploadInputContentType[] = ['application/pdf', 'image/jpeg', 'image/png'];
function proofTypeFor(file: File): BankVaultProofUploadInputContentType | null {
  if (proofContentTypes.includes(file.type as BankVaultProofUploadInputContentType)) {
    return file.type as BankVaultProofUploadInputContentType;
  }
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  return null;
}
function ngnMinor(value: string) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(value) / 100);
}

function bannerForeground(hex: string) {
  const parts = hex.replace('#', '').match(/.{2}/g)?.map(value => Number.parseInt(value, 16));
  if (!parts || parts.length !== 3 || parts.some(Number.isNaN)) return '#ffffff';
  const luminance = (0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2]) / 255;
  return luminance > 0.62 ? '#17314f' : '#ffffff';
}

export function PrivateVaultPanel() {
  const queryClient = useQueryClient();
  const { user } = useUser();
  const [, navigate] = useLocation();
  const status = useGetBankVaultStatus({ query: { queryKey: getGetBankVaultStatusQueryKey(), retry: false, refetchInterval: 60_000 } });
  const initialize = useInitializeBankVaultPasscode();
  const unlock = useUnlockBankVault();
  const [sessionToken, setSessionToken] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [passcode, setPasscode] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busyWallet, setBusyWallet] = useState('');
  const [bannerTheme, setBannerTheme] = useState<BankVaultEmailPreferences['bannerTheme']>('navy');
  const [bannerHeadline, setBannerHeadline] = useState('A Globus transfer notice');
  const [bannerBackgroundColor, setBannerBackgroundColor] = useState('#12385d');
  const [includeSupportLink, setIncludeSupportLink] = useState(false);
  const [supportUrl, setSupportUrl] = useState('');
  const [browserPushMessage, setBrowserPushMessage] = useState('');
  const [browserPushError, setBrowserPushError] = useState('');
  const subscriptionStorageKey = user?.id ? `globus-push-subscription-id:${user.id}` : '';
  const [savedPushSubscriptionId, setSavedPushSubscriptionId] = useState('');
  const browserPushSupported = typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  const [selectedTransactionId, setSelectedTransactionId] = useState('');
  const [privateNoteDraft, setPrivateNoteDraft] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<VaultPlanCode>('1m');
  const [subscriptionStep, setSubscriptionStep] = useState<SubscriptionStep>('closed');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofUploaded, setProofUploaded] = useState(false);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const lastSubscriptionStatus = useRef<string | undefined>(undefined);
  const billing = useGetBankVaultBilling({
    query: {
      queryKey: getGetBankVaultBillingQueryKey(),
      enabled: !!sessionToken,
      retry: false,
    },
    request: sessionToken ? { headers: { 'X-Globus-Vault-Session': sessionToken } } : undefined,
  });
  const uploadProofUrl = useCreateBankVaultSubscriptionProofUploadUrl({
    request: sessionToken ? { headers: { 'X-Globus-Vault-Session': sessionToken } } : undefined,
  });
  const requestSubscription = useRequestBankVaultSubscription({
    request: sessionToken ? { headers: { 'X-Globus-Vault-Session': sessionToken } } : undefined,
  });
  const browserPushConfig = useGetBankPushConfig({
    query: { queryKey: getGetBankPushConfigQueryKey(), retry: false },
  });
  const browserPushPreferences = useGetBankPushPreferences({
    query: {
      queryKey: getGetBankPushPreferencesQueryKey(),
      enabled: !!sessionToken,
      retry: false,
    },
  });
  const savePushSubscription = useSaveBankPushSubscription();
  const deletePushSubscription = useDeleteBankPushSubscription();
  const updateBrowserPushPreferences = useUpdateBankPushPreferences();
  useEffect(() => () => {
    void queryClient.cancelQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
    void queryClient.cancelQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
    void queryClient.cancelQueries({ queryKey: getGetBankVaultBillingQueryKey() });
    void queryClient.cancelQueries({ queryKey: getListBankVaultTransactionNotesQueryKey() });
    queryClient.removeQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
    queryClient.removeQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
    queryClient.removeQueries({ queryKey: getGetBankVaultBillingQueryKey() });
    queryClient.removeQueries({ queryKey: getListBankVaultTransactionNotesQueryKey() });
  }, [queryClient]);

  const controls = useListBankVaultWalletControls({
    query: {
      queryKey: getListBankVaultWalletControlsQueryKey(),
      enabled: !!sessionToken,
      retry: false,
    },
    request: sessionToken ? { headers: { 'X-Globus-Vault-Session': sessionToken } } : undefined,
  });
  const emailPreferences = useGetBankVaultEmailPreferences({
    query: {
      queryKey: getGetBankVaultEmailPreferencesQueryKey(),
      enabled: !!sessionToken,
      retry: false,
    },
    request: sessionToken ? { headers: { 'X-Globus-Vault-Session': sessionToken } } : undefined,
  });
  const saveEmailPreferences = useUpdateBankVaultEmailPreferences({
    request: sessionToken ? { headers: { 'X-Globus-Vault-Session': sessionToken } } : undefined,
  });
  const updatePasscode = useUpdateBankVaultPasscode({
    request: sessionToken ? { headers: { 'X-Globus-Vault-Session': sessionToken } } : undefined,
  });
  const updateControl = useUpdateBankVaultWalletControl({
    request: sessionToken ? { headers: { 'X-Globus-Vault-Session': sessionToken } } : undefined,
  });
  const transactions = useListBankTransactions(
    { limit: 100 },
    {
      query: {
        queryKey: getListBankTransactionsQueryKey({ limit: 100 }),
        enabled: !!sessionToken,
        staleTime: 30_000,
      },
    },
  );
  const transactionNotes = useListBankVaultTransactionNotes({
    query: {
      queryKey: getListBankVaultTransactionNotesQueryKey(),
      enabled: !!sessionToken,
      retry: false,
    },
    request: sessionToken ? { headers: { 'X-Globus-Vault-Session': sessionToken } } : undefined,
  });
  const saveTransactionNote = useUpdateBankVaultTransactionNote({
    request: sessionToken ? { headers: { 'X-Globus-Vault-Session': sessionToken } } : undefined,
  });
  const deleteTransactionNote = useDeleteBankVaultTransactionNote({
    request: sessionToken ? { headers: { 'X-Globus-Vault-Session': sessionToken } } : undefined,
  });
  useEffect(() => {
    if (!subscriptionStorageKey) {
      setSavedPushSubscriptionId('');
      return;
    }
    setSavedPushSubscriptionId(localStorage.getItem(subscriptionStorageKey) ?? '');
  }, [subscriptionStorageKey]);
  useEffect(() => {
    if (!emailPreferences.data) return;
    setBannerTheme(emailPreferences.data.bannerTheme);
    setBannerHeadline(emailPreferences.data.bannerHeadline);
    setBannerBackgroundColor(emailPreferences.data.bannerBackgroundColor);
    setIncludeSupportLink(emailPreferences.data.includeSupportLink);
    setSupportUrl(emailPreferences.data.supportUrl ?? '');
  }, [emailPreferences.data]);
  useEffect(() => {
    if (!selectedTransactionId && transactions.data?.length) {
      setSelectedTransactionId(transactions.data[0].id);
    }
  }, [selectedTransactionId, transactions.data]);
  const selectedTransactionNote = transactionNotes.data?.find(
    item => item.transactionId === selectedTransactionId,
  );
  useEffect(() => {
    setPrivateNoteDraft(selectedTransactionNote?.note ?? '');
  }, [selectedTransactionId, selectedTransactionNote?.note]);
  useEffect(() => {
    if (sessionToken) return;
    void queryClient.cancelQueries({ queryKey: getListBankVaultTransactionNotesQueryKey() });
    queryClient.removeQueries({ queryKey: getListBankVaultTransactionNotesQueryKey() });
    setSelectedTransactionId('');
    setPrivateNoteDraft('');
  }, [queryClient, sessionToken]);
  useEffect(() => {
    if (!sessionToken || !expiresAt) return;
    const remaining = Date.parse(expiresAt) - Date.now();
    if (remaining <= 0) {
      queryClient.removeQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
      queryClient.removeQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
      queryClient.removeQueries({ queryKey: getGetBankVaultBillingQueryKey() });
      setSessionToken('');
      setExpiresAt('');
      setProofFile(null);
      setProofUploaded(false);
      setSubscriptionStep('closed');
      return;
    }
    const timeout = window.setTimeout(() => {
      void queryClient.cancelQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
      void queryClient.cancelQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
      void queryClient.cancelQueries({ queryKey: getGetBankVaultBillingQueryKey() });
      queryClient.removeQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
      queryClient.removeQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
      queryClient.removeQueries({ queryKey: getGetBankVaultBillingQueryKey() });
      setSessionToken('');
      setExpiresAt('');
      setProofFile(null);
      setProofUploaded(false);
      setSubscriptionStep('closed');
    }, remaining);
    return () => window.clearTimeout(timeout);
  }, [expiresAt, queryClient, sessionToken]);
  useEffect(() => {
    const currentStatus = status.data?.subscriptionStatus;
    if (!currentStatus) return;
    const previousStatus = lastSubscriptionStatus.current;
    lastSubscriptionStatus.current = currentStatus;
    if (previousStatus && previousStatus !== currentStatus && currentStatus !== 'pending' && sessionToken) {
      void queryClient.cancelQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
      void queryClient.cancelQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
      void queryClient.cancelQueries({ queryKey: getGetBankVaultBillingQueryKey() });
      queryClient.removeQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
      queryClient.removeQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
      queryClient.removeQueries({ queryKey: getGetBankVaultBillingQueryKey() });
      setSessionToken('');
      setExpiresAt('');
      setProofFile(null);
      setProofUploaded(false);
      setSubscriptionStep('closed');
      setMessage('Vault access changed. Enter your passcode again to continue.');
    }
  }, [queryClient, sessionToken, status.data?.subscriptionStatus]);

  const submitPasscode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      if (!status.data?.configured) {
        await initialize.mutateAsync({ data: { passcode } });
        await queryClient.invalidateQueries({ queryKey: getGetBankVaultStatusQueryKey() });
        setPasscode('');
        setMessage('Vault passcode set. Unlock to view plans and Vault settings.');
      } else {
        const result = await unlock.mutateAsync({ data: { passcode } });
        setSessionToken(result.sessionToken);
        setExpiresAt(result.expiresAt);
        setPasscode('');
        await queryClient.invalidateQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
        await queryClient.invalidateQueries({ queryKey: getGetBankVaultBillingQueryKey() });
        await queryClient.invalidateQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The vault request could not be completed.');
    }
  };
  const changeVaultPasscode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      await updatePasscode.mutateAsync({ data: { newPasscode } });
      setNewPasscode('');
      setSessionToken('');
      setExpiresAt('');
      setProofFile(null);
      setProofUploaded(false);
      setSubscriptionStep('closed');
      void queryClient.cancelQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
      void queryClient.cancelQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
      void queryClient.cancelQueries({ queryKey: getGetBankVaultBillingQueryKey() });
      queryClient.removeQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
      queryClient.removeQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
      queryClient.removeQueries({ queryKey: getGetBankVaultBillingQueryKey() });
      setMessage('Vault passcode updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vault passcode could not be updated.');
    }
  };
  const lockVault = () => {
    void queryClient.cancelQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
    void queryClient.cancelQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
    void queryClient.cancelQueries({ queryKey: getGetBankVaultBillingQueryKey() });
    queryClient.removeQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
    queryClient.removeQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
    queryClient.removeQueries({ queryKey: getGetBankVaultBillingQueryKey() });
    setSessionToken('');
    setExpiresAt('');
    setPasscode('');
    setNewPasscode('');
    setProofFile(null);
    setProofUploaded(false);
    setSubscriptionStep('closed');
  };
  const uploadSubscriptionProof = async () => {
    setError('');
    setMessage('');
    setIsUploadingProof(true);
    try {
      if (!proofFile) throw new Error('Choose a payment proof file before submitting.');
      if (proofFile.size < 1 || proofFile.size > 10 * 1024 * 1024) {
        throw new Error('Payment proof must be 10 MB or smaller.');
      }
      const contentType = proofTypeFor(proofFile);
      if (!contentType) {
        throw new Error('Choose a PDF, JPG, or PNG payment proof.');
      }
      const upload = await uploadProofUrl.mutateAsync({
        data: {
          planCode: selectedPlan,
          contentType,
          sizeBytes: proofFile.size,
          fileName: proofFile.name,
        },
      });
      const uploaded = await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: proofFile,
      });
      if (!uploaded.ok) throw new Error('Payment proof upload failed. Try again.');
      setProofUploaded(true);
      setMessage('Payment proof uploaded successfully. Submit it below to send your subscription request for review.');
    } catch (err) {
      setProofUploaded(false);
      setError(err instanceof Error ? err.message : 'The payment proof could not be uploaded.');
    } finally {
      setIsUploadingProof(false);
    }
  };
  const submitSubscriptionRequest = async () => {
    setError('');
    setMessage('');
    try {
      if (!proofUploaded) throw new Error('Upload your payment proof before submitting the request.');
      await requestSubscription.mutateAsync();
      await queryClient.invalidateQueries({ queryKey: getGetBankVaultStatusQueryKey() });
      setProofFile(null);
      setProofUploaded(false);
      setSubscriptionStep('closed');
      setMessage('Payment proof submitted. Your subscription request is awaiting administrator review.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The subscription request could not be submitted.');
    }
  };
  const billingBusy = uploadProofUrl.isPending || requestSubscription.isPending || isUploadingProof;
  const submitEmailPreferences = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!status.data?.subscriptionActive) {
      setError('An active Vault subscription is required to change settings.');
      return;
    }
    try {
      await saveEmailPreferences.mutateAsync({
        data: {
          bannerTheme,
          bannerHeadline: bannerHeadline.trim(),
          bannerBackgroundColor,
          includeSupportLink,
          supportUrl: supportUrl.trim() || null,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
      setMessage('Transfer email banner preferences saved for future alerts.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The email preferences could not be saved.');
    }
  };
  const savePrivateTransactionNote = async () => {
    if (
      !sessionToken ||
      !subscriptionActive ||
      !selectedTransactionId ||
      !privateNoteDraft.trim()
    ) return;
    setError('');
    setMessage('');
    try {
      await saveTransactionNote.mutateAsync({
        transactionId: selectedTransactionId,
        data: { note: privateNoteDraft.trim() },
      });
      await queryClient.invalidateQueries({ queryKey: getListBankVaultTransactionNotesQueryKey() });
      setMessage('Private note saved. It does not change the transaction or receipt.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The private note could not be saved.');
    }
  };
  const removePrivateTransactionNote = async () => {
    if (!sessionToken || !subscriptionActive || !selectedTransactionId || !selectedTransactionNote) return;
    setError('');
    setMessage('');
    try {
      await deleteTransactionNote.mutateAsync({ transactionId: selectedTransactionId });
      await queryClient.invalidateQueries({ queryKey: getListBankVaultTransactionNotesQueryKey() });
      setPrivateNoteDraft('');
      setMessage('Private note deleted. The transaction record is unchanged.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The private note could not be deleted.');
    }
  };
  const enableBrowserAlerts = async () => {
    setBrowserPushError('');
    setBrowserPushMessage('');
    if (!browserPushSupported) {
      setBrowserPushError('Browser notifications are not supported on this device.');
      return;
    }
    if (!browserPushConfig.data?.configured || !browserPushConfig.data.siteKey) {
      setBrowserPushError('Browser alerts are not available right now.');
      return;
    }
    try {
      let permission = Notification.permission;
      if (permission === 'default') permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setBrowserPushError('Allow notifications in your browser settings, then try again.');
        return;
      }
      const api = await loadWebpushr(browserPushConfig.data.siteKey);
      const subscriberId = await fetchWebpushrSubscriberId(api);
      if (!subscriberId) {
        setBrowserPushMessage('Finish the browser permission prompt, then select Enable alerts again.');
        return;
      }
      const result = await savePushSubscription.mutateAsync({ data: { subscriberId } });
      setSavedPushSubscriptionId(result.id ?? '');
      if (result.id && subscriptionStorageKey) {
        localStorage.setItem(subscriptionStorageKey, result.id);
      }
      setBrowserPushMessage('Browser alerts are enabled on this device.');
      await queryClient.invalidateQueries({ queryKey: getGetBankPushConfigQueryKey() });
    } catch (err) {
      setBrowserPushError(err instanceof Error ? err.message : 'Browser alerts could not be enabled.');
    }
  };
  const disableBrowserAlerts = async () => {
    setBrowserPushError('');
    setBrowserPushMessage('');
    if (!savedPushSubscriptionId) {
      setBrowserPushError('This device alert link could not be found. Enable alerts on this device first.');
      return;
    }
    try {
      await deletePushSubscription.mutateAsync({ subscriptionId: savedPushSubscriptionId });
      setSavedPushSubscriptionId('');
      if (subscriptionStorageKey) localStorage.removeItem(subscriptionStorageKey);
      setBrowserPushMessage('Globus alerts are disconnected for this device.');
      await queryClient.invalidateQueries({ queryKey: getGetBankPushConfigQueryKey() });
    } catch (err) {
      setBrowserPushError(err instanceof Error ? err.message : 'Browser alerts could not be disabled.');
    }
  };
  const updateBrowserAlertCategory = async (
    key: 'transferEnabled' | 'walletEnabled' | 'securityEnabled',
    enabled: boolean,
  ) => {
    setBrowserPushError('');
    setBrowserPushMessage('');
    try {
      const preferences = await updateBrowserPushPreferences.mutateAsync({
        data: { [key]: enabled },
      });
      queryClient.setQueryData(getGetBankPushPreferencesQueryKey(), preferences);
      setBrowserPushMessage('Alert choices saved for all linked devices.');
    } catch (err) {
      setBrowserPushError(err instanceof Error ? err.message : 'Alert choices could not be saved.');
    }
  };
  const changeControl = async (control: BankVaultWalletControl, input: Partial<BankVaultWalletControl>) => {
    if (!sessionToken || !status.data?.subscriptionActive || busyWallet) return;
    setBusyWallet(control.walletId);
    setError('');
    setMessage('');
    try {
      await updateControl.mutateAsync({ walletId: control.walletId, data: input });
      await queryClient.invalidateQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
      setMessage(`${control.currency} wallet policy updated. It applies to future requests only.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wallet policy could not be updated.');
    } finally {
      setBusyWallet('');
    }
  };

  const loading = initialize.isPending || unlock.isPending || updatePasscode.isPending;
  const subscriptionActive = !!status.data?.subscriptionActive;
  const subscriptionPending = status.data?.subscriptionStatus === 'pending';
  return (
    <section className="rounded-[18px] border border-[#e1e8ee] bg-white p-4 sm:p-5" data-testid="private-vault-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[.15em] text-[#55868b]">Private controls</p>
          <h2 className="mt-1 text-[13px] font-bold text-[#29425c]">Private vault</h2>
          <p className="mt-1 max-w-2xl text-[10px] leading-4 text-[#718296]">Protect wallet-level settings with a separate four-digit passcode. Wallet policy affects future requests only; it does not change existing activity.</p>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eef6f6] text-[#43888e]"><ShieldCheck size={17} /></span>
      </div>
      {status.isLoading ? <div className="mt-4 h-10 animate-pulse rounded-lg bg-[#f0f4f6]" /> :
        status.isError ? <div className="mt-4 flex items-center justify-between rounded-lg border border-[#eadfda] bg-[#fff8f6] px-3 py-2 text-[10px] text-[#a24940]"><span>Vault status is unavailable.</span><button type="button" data-testid="button-retry-vault-status" onClick={() => void status.refetch()} className="font-bold underline">Try again</button></div> :
          !status.data?.configured ? (
            <form onSubmit={submitPasscode} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end" data-testid="form-vault-setup">
              <label className="min-w-0 flex-1 text-[9px] font-bold text-[#5c7085]">Create a four-digit vault passcode
                <input required pattern="[0-9]{4}" inputMode="numeric" autoComplete="new-password" maxLength={4} value={passcode} onChange={event => setPasscode(event.target.value.replace(/\D/g, '').slice(0, 4))} className={`${fieldClass} mt-1`} data-testid="input-vault-passcode" />
              </label>
              <button type="submit" disabled={loading || passcode.length !== 4} data-testid="button-vault-setup" className="h-9 rounded-lg bg-[#173858] px-4 text-[10px] font-bold text-white disabled:opacity-50">{initialize.isPending ? 'Setting up…' : 'Set up vault'}</button>
            </form>
          ) : !sessionToken ? (
            <form onSubmit={submitPasscode} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end" data-testid="form-vault-unlock">
              <label className="min-w-0 flex-1 text-[9px] font-bold text-[#5c7085]">Four-digit vault passcode
                <input required pattern="[0-9]{4}" inputMode="numeric" autoComplete="current-password" maxLength={4} value={passcode} onChange={event => setPasscode(event.target.value.replace(/\D/g, '').slice(0, 4))} className={`${fieldClass} mt-1`} data-testid="input-vault-unlock-passcode" />
              </label>
              <button type="submit" disabled={loading || passcode.length !== 4} data-testid="button-vault-unlock" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#173858] px-4 text-[10px] font-bold text-white disabled:opacity-50"><LockKeyhole size={13} />{unlock.isPending ? 'Unlocking…' : 'Unlock vault'}</button>
            </form>
          ) : (
            <div className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#d9e8e9] bg-[#f3f8f8] px-3 py-2">
                <p className="text-[10px] font-semibold text-[#426e70]" data-testid="status-vault-unlocked">
                  {subscriptionActive ? 'Vault unlocked · subscription active' : 'Vault unlocked · read-only'}
                  {expiresAt ? ` · session ends ${new Date(expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}
                  {status.data?.expiresAt ? ` · plan ends ${new Date(status.data.expiresAt).toLocaleDateString()}` : ''}
                </p>
                <button type="button" disabled={updatePasscode.isPending || updateControl.isPending || billingBusy} data-testid="button-vault-lock" onClick={lockVault} className="rounded-md border border-[#d4e1e4] bg-white px-3 py-1.5 text-[9px] font-bold text-[#466577] disabled:opacity-50">Lock vault</button>
              </div>

              {!subscriptionActive && <section className="mt-3 rounded-xl border border-[#e8e1cc] bg-[#fbf8ef] p-4" data-testid="vault-subscription-access">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8a784c]">Vault subscription · {status.data?.subscriptionStatus || 'inactive'}</p>
                    <p className="mt-1 text-[10px] leading-5 text-[#786e55]">
                      {subscriptionPending
                        ? `Your ${status.data?.planCode || ''} plan request and payment proof are awaiting administrator review.`
                        : status.data?.subscriptionStatus === 'rejected'
                          ? 'Your previous request was declined. You can submit a new request with payment proof.'
                          : status.data?.subscriptionStatus === 'expired'
                            ? 'Your subscription has expired. Choose a plan and submit new payment proof for review.'
                            : 'Choose a plan and submit payment proof. Vault changes are available after administrator approval.'}
                    </p>
                    {subscriptionPending && status.data?.amountMinor && <p className="mt-1 text-[10px] font-bold text-[#6f633f]">{ngnMinor(status.data.amountMinor)} · submitted {status.data.proofUploadedAt ? new Date(status.data.proofUploadedAt).toLocaleString() : ''}</p>}
                  </div>
                  {!subscriptionPending && subscriptionStep === 'closed' && <button type="button" onClick={() => { setError(''); setMessage(''); setSubscriptionStep('plans'); }} data-testid="button-vault-subscribe" className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-[#173858] px-4 text-[10px] font-bold text-white hover:bg-[#214b70]">
                    Subscribe <ArrowRight size={13} />
                  </button>}
                </div>

                {subscriptionPending ? null : billing.isLoading ? <div className="mt-3 h-12 animate-pulse rounded-lg bg-white/70" /> :
                  billing.isError ? <div className="mt-3 flex items-center justify-between rounded-lg bg-white/70 px-3 py-2 text-[9px] text-[#a24940]"><span>Manual payment details could not be loaded.</span><button type="button" onClick={() => void billing.refetch()} className="font-bold underline">Retry</button></div> :
                    billing.data && <>
                      {!billing.data.configured && <p className="mt-3 rounded-lg border border-[#e8dfc5] bg-white/75 p-3 text-[9px] leading-4 text-[#786e55]">Manual payment instructions are being configured by Globus administrators. You can view Vault settings, but cannot submit a request yet.</p>}

                      {subscriptionStep === 'plans' && <div className="mt-4" data-testid="vault-subscription-plans">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-[10px] font-bold text-[#6c6249]">Choose your access plan</h3>
                          <button type="button" onClick={() => setSubscriptionStep('closed')} className="text-[9px] font-semibold text-[#75816c]">Cancel</button>
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                          {billing.data.plans.map(plan => <button key={plan.code} type="button" disabled={!billing.data.configured} onClick={() => { setSelectedPlan(plan.code as VaultPlanCode); setProofFile(null); setProofUploaded(false); setMessage(''); setError(''); setSubscriptionStep('payment'); }} data-testid={`button-vault-plan-${plan.code}`} className="rounded-lg border border-[#e5dec9] bg-white/80 p-3 text-left transition hover:border-[#43888e] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
                            <span className="block text-[9px] font-semibold text-[#7d7358]">{plan.label}</span>
                            <strong className="mt-1 block text-[12px] text-[#334f5b]">{ngnMinor(plan.priceMinor)}</strong>
                            <span className="mt-2 inline-flex items-center gap-1 text-[9px] font-bold text-[#397b80]">Choose plan <ArrowRight size={11} /></span>
                          </button>)}
                        </div>
                      </div>}

                      {subscriptionStep === 'payment' && (() => {
                        const plan = billing.data.plans.find(item => item.code === selectedPlan);
                        if (!plan) return null;
                        return <div className="mt-4 space-y-3" data-testid="vault-subscription-payment">
                          <button type="button" onClick={() => { setSubscriptionStep('plans'); setProofFile(null); setProofUploaded(false); setError(''); setMessage(''); }} className="inline-flex items-center gap-1.5 text-[9px] font-bold text-[#397b80]"><ArrowLeft size={12} /> Back to plans</button>
                          <div className="rounded-lg border border-[#e8dfc5] bg-white/80 p-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div><p className="text-[9px] font-bold uppercase tracking-[.1em] text-[#8a784c]">Selected plan</p><p className="mt-1 text-[11px] font-bold text-[#334f5b]">{plan.label}</p></div>
                              <strong className="text-[13px] text-[#334f5b]">{ngnMinor(plan.priceMinor)}</strong>
                            </div>
                            <div className="mt-3 border-t border-[#eee8d9] pt-3 text-[9px] leading-4 text-[#786e55]">
                              <p className="font-bold text-[#5d563f]">{billing.data.paymentMethod}</p>
                              {billing.data.bankName && <p>{billing.data.bankName}</p>}
                              {billing.data.accountName && <p>Account name: {billing.data.accountName}</p>}
                              {billing.data.accountNumber && <p>Account / reference: <span className="font-mono font-bold">{billing.data.accountNumber}</span></p>}
                              <p className="mt-1 whitespace-pre-wrap">{billing.data.instructions}</p>
                            </div>
                          </div>
                          <label className="block text-[9px] font-bold text-[#6c6249]">Payment proof · PDF, JPG or PNG, up to 10 MB
                            <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" disabled={!billing.data.configured || billingBusy} onChange={event => { setProofFile(event.currentTarget.files?.[0] ?? null); setProofUploaded(false); setError(''); setMessage(''); }} className="mt-1 block w-full text-[9px] text-[#687b7e] file:mr-2 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:text-[9px] file:font-bold file:text-[#3c626b]" data-testid="input-vault-payment-proof" />
                          </label>
                          {proofFile && <p className="truncate text-[9px] text-[#6f8175]">{proofFile.name} · {(proofFile.size / 1024 / 1024).toFixed(2)} MB</p>}
                          {proofUploaded && <p role="status" data-testid="status-vault-proof-uploaded" className="flex items-center gap-2 rounded-lg border border-[#cfe5d8] bg-[#eff8f2] px-3 py-2 text-[9px] font-semibold text-[#41755f]"><CheckCircle2 size={14} />Payment proof uploaded successfully. You can now submit your request.</p>}
                          <div className="flex flex-wrap gap-2">
                            <button type="button" disabled={!billing.data.configured || billingBusy || !proofFile || proofUploaded} onClick={() => void uploadSubscriptionProof()} data-testid="button-vault-upload-proof" className="h-9 rounded-lg border border-[#b9d2d0] bg-white px-4 text-[10px] font-bold text-[#397b80] disabled:opacity-50">
                              {uploadProofUrl.isPending ? 'Preparing upload…' : isUploadingProof ? 'Uploading proof…' : proofUploaded ? 'Proof uploaded' : 'Upload payment proof'}
                            </button>
                            <button type="button" disabled={!proofUploaded || billingBusy} onClick={() => void submitSubscriptionRequest()} data-testid="button-vault-submit-subscription-request" className="h-9 rounded-lg bg-[#173858] px-4 text-[10px] font-bold text-white disabled:opacity-50">
                              {requestSubscription.isPending ? 'Submitting request…' : 'Submit subscription request'}
                            </button>
                          </div>
                        </div>;
                      })()}
                    </>}
              </section>}

              <div className="mt-3 grid gap-3 lg:grid-cols-[.75fr_1.25fr]">
                {subscriptionActive ? <form onSubmit={changeVaultPasscode} className="rounded-xl border border-[#e7ecef] p-3" data-testid="form-vault-change-passcode">
                  <h3 className="text-[10px] font-bold text-[#344b64]">Change passcode</h3>
                  <label className="mt-2 block text-[9px] font-semibold text-[#667a8d]">New four-digit passcode
                    <input required pattern="[0-9]{4}" inputMode="numeric" autoComplete="new-password" maxLength={4} value={newPasscode} onChange={event => setNewPasscode(event.target.value.replace(/\D/g, '').slice(0, 4))} className={`${fieldClass} mt-1`} data-testid="input-vault-new-passcode" />
                  </label>
                  <button type="submit" disabled={loading || newPasscode.length !== 4} data-testid="button-vault-change-passcode" className="mt-2 h-8 rounded-lg border border-[#dfe6eb] px-3 text-[9px] font-bold text-[#405a73] disabled:opacity-50">{updatePasscode.isPending ? 'Updating…' : 'Update passcode'}</button>
                </form> : <div className="rounded-xl border border-[#e7ecef] bg-[#f8fafb] p-3"><h3 className="text-[10px] font-bold text-[#344b64]">Vault settings are read-only</h3><p className="mt-1 text-[9px] leading-4 text-[#8190a0]">An active subscription is required to change the passcode or wallet and email settings.</p></div>}
                <div className="rounded-xl border border-[#e7ecef] p-3">
                  <div className="flex items-center justify-between gap-2"><h3 className="text-[10px] font-bold text-[#344b64]">Wallet policies</h3><button type="button" onClick={() => void controls.refetch()} data-testid="button-refresh-wallet-controls" className="text-[9px] font-bold text-[#397b80]">Refresh</button></div>
                  <p className="mt-1 text-[9px] leading-4 text-[#8190a0]">Policy choices apply to future requests only. Existing transactions keep their recorded status.</p>
                  <p className="mt-1 text-[9px] leading-4 text-[#8190a0]">Deposit requests are reviewed by an administrator; balances change only after approval.</p>
                  {controls.isLoading ? <div className="mt-2 h-10 animate-pulse rounded-lg bg-[#f0f4f6]" /> : controls.isError ? <p role="alert" className="mt-2 text-[9px] text-[#a24940]">Wallet controls could not be loaded. Refresh to try again.</p> : controls.data?.length ? (
                    <div className="mt-2 space-y-2">{controls.data.map(control => <article key={control.walletId} data-testid={`vault-wallet-control-${control.walletId}`} className="rounded-lg bg-[#f8fafb] p-2.5">
                      <div className="flex items-center justify-between gap-2"><strong className="text-[10px] text-[#324962]">{control.currency} wallet</strong><label className="flex items-center gap-1.5 text-[8px] text-[#64798d]"><input type="checkbox" checked={control.transfersEnabled} disabled={!subscriptionActive || busyWallet === control.walletId} onChange={event => void changeControl(control, { transfersEnabled: event.target.checked })} data-testid={`toggle-vault-transfers-${control.walletId}`} />Transfers</label></div>
                      <button type="button" onClick={() => navigate(`/add-money?currency=${encodeURIComponent(control.currency)}`)} data-testid={`button-vault-request-deposit-${control.currency}`} className="mt-2 h-7 rounded-md border border-[#b9d2d0] bg-white px-2.5 text-[8px] font-bold text-[#397b80]">Request deposit to {control.currency}</button>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <label className="flex items-center gap-1.5 text-[8px] text-[#64798d]"><input type="checkbox" checked={control.depositsEnabled} disabled={!subscriptionActive || busyWallet === control.walletId} onChange={event => void changeControl(control, { depositsEnabled: event.target.checked })} data-testid={`toggle-vault-deposits-${control.walletId}`} />Deposits</label>
                        <label className="flex items-center gap-1.5 text-[8px] text-[#64798d]"><input type="checkbox" checked={control.withdrawalsEnabled} disabled={!subscriptionActive || busyWallet === control.walletId} onChange={event => void changeControl(control, { withdrawalsEnabled: event.target.checked })} data-testid={`toggle-vault-withdrawals-${control.walletId}`} />Withdrawals</label>
                      </div>
                      <label className="mt-2 flex items-center gap-2 text-[8px] font-semibold text-[#64798d]">Future transfer requests
                        <select value={control.futureTransferMode} disabled={!subscriptionActive || busyWallet === control.walletId} onChange={event => void changeControl(control, { futureTransferMode: event.target.value as BankVaultWalletControl['futureTransferMode'] })} className="h-7 flex-1 rounded-md border border-[#dfe6eb] bg-white px-2 text-[9px]" data-testid={`select-vault-future-transfer-mode-${control.walletId}`}>
                          <option value="successful">Successful after ledger posting</option><option value="pending">Pending administrator review</option><option value="failed">Fail without posting</option>
                        </select>
                      </label>
                      {busyWallet === control.walletId && <p role="status" className="mt-1 text-[8px] text-[#55868b]">Saving wallet policy…</p>}
                    </article>)}</div>
                  ) : <p className="mt-2 rounded-lg border border-dashed border-[#dfe6eb] p-3 text-center text-[9px] text-[#8492a1]">No wallet controls are available.</p>}
                </div>
              </div>
              <details className="mt-3 rounded-xl border border-[#e7ecef] bg-[#fbfcfd] p-3" data-testid="vault-browser-alert-settings">
                <summary className="cursor-pointer text-[10px] font-bold text-[#344b64]">Browser alerts</summary>
                <p className="mt-2 text-[9px] leading-4 text-[#8190a0]">Choose which account alerts can reach linked devices. In-app notifications remain available in the notification center.</p>
                {browserPushConfig.isError && <p role="alert" className="mt-2 text-[9px] text-[#a24940]">Browser alert setup is unavailable. Try again later.</p>}
                {browserPushPreferences.isLoading ? <div className="mt-2 h-8 animate-pulse rounded-lg bg-[#f0f4f6]" /> :
                  browserPushPreferences.isError ? <p role="alert" className="mt-2 text-[9px] text-[#a24940]">Alert choices could not be loaded.</p> :
                    <fieldset disabled={updateBrowserPushPreferences.isPending} className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                      <legend className="sr-only">Push alert categories</legend>
                      {([
                        ['transferEnabled', 'Transfers'],
                        ['walletEnabled', 'Wallet activity'],
                        ['securityEnabled', 'Security'],
                      ] as const).map(([key, label]) => <label key={key} className="flex min-w-0 items-center gap-2 rounded-lg border border-[#e4eaee] bg-white px-3 py-2 text-[9px] font-medium text-[#62788c]">
                        <input type="checkbox" checked={browserPushPreferences.data?.[key] ?? true} onChange={event => void updateBrowserAlertCategory(key, event.currentTarget.checked)} data-testid={`vault-toggle-push-${key}`} className="accent-[#438481]" />
                        <span>{label}</span>
                      </label>)}
                    </fieldset>}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span data-testid="status-vault-browser-push" className="text-[8px] text-[#8794a2]">
                    {browserPushConfig.isLoading ? 'Checking availability…' : !browserPushSupported ? 'Not supported on this device' : browserPushConfig.data?.configured ? savedPushSubscriptionId ? 'This device is linked' : 'Available to enable on this device' : 'Not configured'}
                  </span>
                  {savedPushSubscriptionId ? <button type="button" disabled={deletePushSubscription.isPending} onClick={() => void disableBrowserAlerts()} data-testid="button-vault-disable-browser-push" className="h-8 rounded-lg border border-[#dfe6eb] bg-white px-3 text-[9px] font-bold text-[#52697e] disabled:opacity-50">{deletePushSubscription.isPending ? 'Disabling…' : 'Disable alerts on this device'}</button> :
                    <button type="button" disabled={!browserPushSupported || !browserPushConfig.data?.configured || savePushSubscription.isPending} onClick={() => void enableBrowserAlerts()} data-testid="button-vault-enable-browser-push" className="h-8 rounded-lg bg-[#173858] px-3 text-[9px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">{savePushSubscription.isPending ? 'Linking…' : 'Enable alerts on this device'}</button>}
                </div>
                {browserPushError && <p role="alert" data-testid="status-vault-browser-push-error" className="mt-2 rounded-md bg-[#fff1ef] px-2 py-1.5 text-[8px] text-[#a24940]">{browserPushError}</p>}
                {browserPushMessage && <p role="status" data-testid="status-vault-browser-push-message" className="mt-2 rounded-md bg-[#eef7f1] px-2 py-1.5 text-[8px] text-[#41755f]">{browserPushMessage}</p>}
              </details>
              <details className="mt-3 rounded-xl border border-[#e7ecef] bg-[#fbfcfd] p-3" data-testid="vault-personal-transaction-notes">
                <summary className="cursor-pointer text-[10px] font-bold text-[#344b64]">Personal transaction notes</summary>
                <p className="mt-2 text-[9px] leading-4 text-[#8190a0]">These notes are private to your Vault. They never change balances, official transaction details, receipts, or notifications.</p>
                {!subscriptionActive && <p className="mt-2 text-[9px] font-semibold text-[#8a784c]">Notes are read-only until your subscription is active.</p>}
                {transactions.isLoading || transactionNotes.isLoading ? <div className="mt-2 h-10 animate-pulse rounded-lg bg-[#f0f4f6]" /> :
                  transactions.isError || transactionNotes.isError ? <div className="mt-2 rounded-lg border border-[#eadfda] bg-[#fff8f6] p-3 text-[9px] text-[#a24940]"><p>Transaction notes could not be loaded.</p><button type="button" onClick={() => { void transactions.refetch(); void transactionNotes.refetch(); }} className="mt-1 font-bold underline">Try again</button></div> :
                    !transactions.data?.length ? <p className="mt-2 rounded-lg border border-dashed border-[#dfe6eb] p-3 text-center text-[9px] text-[#8492a1]">Your transactions will appear here when available.</p> :
                      <div className="mt-3 grid gap-2">
                        <label className="text-[9px] font-semibold text-[#5c7085]">Choose a transaction
                          <select value={selectedTransactionId} onChange={event => setSelectedTransactionId(event.target.value)} className={`${fieldClass} mt-1`} data-testid="select-private-note-transaction">
                            {transactions.data.map((transaction: BankTransaction) => <option key={transaction.id} value={transaction.id}>
                              {`${new Date(transaction.createdAt).toLocaleDateString()} · ${transaction.currency} ${transaction.amount} · ${transaction.reference}`}
                            </option>)}
                          </select>
                        </label>
                        {selectedTransactionId && <>
                          <label className="text-[9px] font-semibold text-[#5c7085]">Your private note
                            <textarea disabled={!subscriptionActive} maxLength={500} rows={3} value={privateNoteDraft} onChange={event => setPrivateNoteDraft(event.target.value)} placeholder="Add a reminder for yourself" className="mt-1 w-full resize-y rounded-lg border border-[#dfe6eb] bg-white px-3 py-2 text-[10px] leading-4 text-[#344b64] outline-none focus:border-[#77aeb0] disabled:bg-[#f3f5f5]" data-testid="input-private-transaction-note" />
                            <span className="mt-1 block text-right text-[8px] font-normal text-[#8794a2]">{privateNoteDraft.length}/500</span>
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {subscriptionActive && <button type="button" disabled={saveTransactionNote.isPending || deleteTransactionNote.isPending || !privateNoteDraft.trim()} onClick={() => void savePrivateTransactionNote()} data-testid="button-save-private-transaction-note" className="h-8 rounded-lg bg-[#173858] px-3 text-[9px] font-bold text-white disabled:opacity-50">{saveTransactionNote.isPending ? 'Saving…' : 'Save private note'}</button>}
                            {subscriptionActive && selectedTransactionNote && <button type="button" disabled={saveTransactionNote.isPending || deleteTransactionNote.isPending} onClick={() => void removePrivateTransactionNote()} data-testid="button-delete-private-transaction-note" className="h-8 rounded-lg border border-[#dfe6eb] bg-white px-3 text-[9px] font-bold text-[#6b7888] disabled:opacity-50">{deleteTransactionNote.isPending ? 'Deleting…' : 'Delete note'}</button>}
                          </div>
                        </>}
                      </div>}
              </details>
              <details className="mt-3 rounded-xl border border-[#e7ecef] bg-[#fbfcfd] p-3" data-testid="vault-email-banner-settings">
                <summary className="cursor-pointer text-[10px] font-bold text-[#344b64]">Transaction email banner</summary>
                <p className="mt-2 text-[9px] leading-4 text-[#8190a0]">Customize the branded banner and optional support footer link for future transfer alerts.</p>
                {!subscriptionActive && <p className="mt-2 text-[9px] font-semibold text-[#8a784c]">Read-only until your subscription is active.</p>}
                {emailPreferences.isLoading ? <div className="mt-2 h-8 animate-pulse rounded-lg bg-[#f0f4f6]" /> : emailPreferences.isError ? <p role="alert" className="mt-2 text-[9px] text-[#a24940]">Email banner settings could not be loaded.</p> : <form onSubmit={submitEmailPreferences} className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-[9px] font-semibold text-[#5c7085]">Banner color
                    <select disabled={!subscriptionActive} value={bannerTheme} onChange={event => setBannerTheme(event.target.value as BankVaultEmailPreferences['bannerTheme'])} className={`${fieldClass} mt-1 disabled:bg-[#f3f5f5]`} data-testid="select-vault-email-banner-theme">
                      <option value="navy">Globus navy</option><option value="teal">Globus teal</option><option value="gold">Globus gold</option>
                    </select>
                  </label>
                  <label className="text-[9px] font-semibold text-[#5c7085]">Banner headline
                    <input disabled={!subscriptionActive} required maxLength={60} value={bannerHeadline} onChange={event => setBannerHeadline(event.target.value)} className={`${fieldClass} mt-1 disabled:bg-[#f3f5f5]`} data-testid="input-vault-email-banner-headline" />
                  </label>
                  <label className="text-[9px] font-semibold text-[#5c7085]">Custom banner background
                    <span className="mt-1 flex h-9 items-center gap-2 rounded-lg border border-[#dfe6eb] bg-white px-2">
                      <input disabled={!subscriptionActive} type="color" value={bannerBackgroundColor} onChange={event => setBannerBackgroundColor(event.target.value)} className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0 disabled:cursor-not-allowed" aria-label="Choose email banner background color" data-testid="input-vault-email-banner-background-color" />
                      <span className="font-mono text-[9px] font-normal uppercase text-[#687d90]">{bannerBackgroundColor}</span>
                    </span>
                  </label>
                  <div aria-label="Email banner preview" data-testid="preview-vault-email-banner" className="overflow-hidden rounded-lg border border-[#e2e8eb] sm:col-span-2">
                    <div className="px-4 py-3" style={{ backgroundColor: bannerBackgroundColor, color: bannerForeground(bannerBackgroundColor) }}>
                      <p className="text-[10px] font-extrabold tracking-[.12em]">GLOBUS <span className="text-[#d6b45e]">BANK</span></p>
                      <p className="mt-1 text-[10px] font-semibold">{bannerHeadline || 'A Globus transfer notice'}</p>
                    </div>
                    <div className="bg-white px-4 py-2 text-[9px] text-[#526b7e]">Transfer update · transaction details</div>
                    {includeSupportLink && supportUrl.trim() && <div className="border-t border-[#e7ecee] bg-white px-4 py-2 text-center text-[9px] font-bold text-[#356e75]">Sender-provided support link</div>}
                  </div>
                  <label className="text-[9px] font-semibold text-[#5c7085] sm:col-span-2">Support contact URL
                    <input disabled={!subscriptionActive} type="url" maxLength={500} value={supportUrl} onChange={event => setSupportUrl(event.target.value)} placeholder="https://support.example.com" className={`${fieldClass} mt-1 disabled:bg-[#f3f5f5]`} data-testid="input-vault-email-support-url" />
                    <span className="mt-1 block text-[8px] font-normal text-[#8794a2]">Use an HTTPS link. Recipients will see it identified as a sender-provided link, and it appears only when enabled below.</span>
                  </label>
                  <label className="flex items-start gap-2 text-[9px] leading-4 text-[#64798d] sm:col-span-2">
                    <input disabled={!subscriptionActive} type="checkbox" checked={includeSupportLink} onChange={event => setIncludeSupportLink(event.target.checked)} className="mt-0.5 accent-[#438481]" data-testid="toggle-vault-email-support-link" />
                    <span>Include my support contact link in future recipient alert email footers.</span>
                  </label>
                  {subscriptionActive && <button type="submit" disabled={saveEmailPreferences.isPending || !bannerHeadline.trim() || (includeSupportLink && !supportUrl.trim())} data-testid="button-save-vault-email-banner" className="h-8 justify-self-start rounded-lg bg-[#173858] px-3 text-[9px] font-bold text-white disabled:opacity-50 sm:col-span-2">{saveEmailPreferences.isPending ? 'Saving…' : 'Save email design'}</button>}
                </form>}
              </details>
            </div>
          )}
      {(error || updateControl.isError) && <p role="alert" data-testid="status-vault-error" className="mt-3 rounded-lg bg-[#fff1ef] px-3 py-2 text-[9px] text-[#a24940]">{error || 'A wallet policy could not be saved.'}</p>}
      {message && <p role="status" data-testid="status-vault-message" className="mt-3 rounded-lg bg-[#f0f8f4] px-3 py-2 text-[9px] text-[#41755f]">{message}</p>}
    </section>
  );
}
