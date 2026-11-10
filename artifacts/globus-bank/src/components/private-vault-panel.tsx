import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetBankVaultStatusQueryKey,
  getGetBankVaultEmailPreferencesQueryKey,
  getListBankVaultWalletControlsQueryKey,
  useGetBankVaultEmailPreferences,
  useGetBankVaultStatus,
  useInitializeBankVaultPasscode,
  useListBankVaultWalletControls,
  useRequestBankVaultSubscription,
  useUnlockBankVault,
  useUpdateBankVaultEmailPreferences,
  useUpdateBankVaultPasscode,
  useUpdateBankVaultWalletControl,
} from '@workspace/api-client-react';
import type { BankVaultEmailPreferences, BankVaultWalletControl } from '@workspace/api-client-react';

const fieldClass = 'h-9 w-full rounded-lg border border-[#dfe6eb] bg-white px-3 text-[11px] text-[#344b64] outline-none focus:border-[#77aeb0] focus:ring-2 focus:ring-[#77aeb0]/15';

export function PrivateVaultPanel() {
  const queryClient = useQueryClient();
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
  const [includeSupportLink, setIncludeSupportLink] = useState(false);
  const lastSubscriptionStatus = useRef<string | undefined>(undefined);
  const requestSubscription = useRequestBankVaultSubscription({
    request: sessionToken ? { headers: { 'X-Globus-Vault-Session': sessionToken } } : undefined,
  });
  useEffect(() => () => {
    void queryClient.cancelQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
    void queryClient.cancelQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
    queryClient.removeQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
    queryClient.removeQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
  }, [queryClient]);

  const controls = useListBankVaultWalletControls({
    query: {
      queryKey: getListBankVaultWalletControlsQueryKey(),
      enabled: !!sessionToken && !!status.data?.subscriptionActive,
      retry: false,
    },
    request: sessionToken ? { headers: { 'X-Globus-Vault-Session': sessionToken } } : undefined,
  });
  const emailPreferences = useGetBankVaultEmailPreferences({
    query: {
      queryKey: getGetBankVaultEmailPreferencesQueryKey(),
      enabled: !!sessionToken && !!status.data?.subscriptionActive,
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
  useEffect(() => {
    if (!emailPreferences.data) return;
    setBannerTheme(emailPreferences.data.bannerTheme);
    setBannerHeadline(emailPreferences.data.bannerHeadline);
    setIncludeSupportLink(emailPreferences.data.includeSupportLink);
  }, [emailPreferences.data]);
  useEffect(() => {
    if (!sessionToken || !expiresAt) return;
    const remaining = Date.parse(expiresAt) - Date.now();
    if (remaining <= 0) {
      queryClient.removeQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
      queryClient.removeQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
      setSessionToken('');
      setExpiresAt('');
      return;
    }
    const timeout = window.setTimeout(() => {
      void queryClient.cancelQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
      void queryClient.cancelQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
      queryClient.removeQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
      queryClient.removeQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
      setSessionToken('');
      setExpiresAt('');
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
      queryClient.removeQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
      queryClient.removeQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
      setSessionToken('');
      setExpiresAt('');
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
        setMessage('Vault passcode set. Unlock to request access or use approved controls.');
      } else {
        const result = await unlock.mutateAsync({ data: { passcode } });
        setSessionToken(result.sessionToken);
        setExpiresAt(result.expiresAt);
        setPasscode('');
        await queryClient.invalidateQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
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
      void queryClient.cancelQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
      void queryClient.cancelQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
      queryClient.removeQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
      queryClient.removeQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
      setMessage('Vault passcode updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vault passcode could not be updated.');
    }
  };
  const lockVault = () => {
    void queryClient.cancelQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
    void queryClient.cancelQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
    queryClient.removeQueries({ queryKey: getListBankVaultWalletControlsQueryKey() });
    queryClient.removeQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
    setSessionToken('');
    setExpiresAt('');
    setPasscode('');
    setNewPasscode('');
  };
  const submitSubscriptionRequest = async () => {
    setError('');
    setMessage('');
    try {
      await requestSubscription.mutateAsync();
      await queryClient.invalidateQueries({ queryKey: getGetBankVaultStatusQueryKey() });
      setMessage('Access request sent for administrator review. No payment was collected.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The access request could not be submitted.');
    }
  };
  const submitEmailPreferences = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      await saveEmailPreferences.mutateAsync({
        data: {
          bannerTheme,
          bannerHeadline: bannerHeadline.trim(),
          includeSupportLink,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getGetBankVaultEmailPreferencesQueryKey() });
      setMessage('Transfer email banner preferences saved for future alerts.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The email preferences could not be saved.');
    }
  };
  const changeControl = async (control: BankVaultWalletControl, input: Partial<BankVaultWalletControl>) => {
    if (!sessionToken || busyWallet) return;
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
          ) : !status.data?.subscriptionActive ? (
            <div className="mt-4 rounded-xl border border-[#e8e1cc] bg-[#fbf8ef] p-4" data-testid="vault-subscription-access">
              <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8a784c]">Vault access · {status.data?.subscriptionStatus || 'inactive'}</p>
              <p className="mt-2 max-w-2xl text-[10px] leading-5 text-[#786e55]">
                {status.data?.subscriptionStatus === 'pending'
                  ? 'Your access request is waiting for administrator review.'
                  : status.data?.subscriptionStatus === 'rejected'
                    ? 'Your last request was declined. You may submit a new request for review.'
                    : status.data?.subscriptionStatus === 'expired'
                      ? 'Vault access has expired. Request administrator approval to restore access.'
                      : 'Passcode confirmed. Request administrator approval to use the Private Vault. This app does not collect subscription payments.'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={status.data?.subscriptionStatus === 'pending' || requestSubscription.isPending}
                  onClick={() => void submitSubscriptionRequest()}
                  data-testid="button-vault-subscribe"
                  className="h-9 rounded-lg bg-[#173858] px-4 text-[10px] font-bold text-white disabled:opacity-50"
                >
                  {requestSubscription.isPending ? 'Sending request…' : status.data?.subscriptionStatus === 'pending' ? 'Request pending' : 'Request subscription'}
                </button>
                <button
                  type="button"
                  onClick={lockVault}
                  data-testid="button-vault-lock-before-access"
                  className="h-9 rounded-lg border border-[#d4e1e4] bg-white px-4 text-[10px] font-bold text-[#466577]"
                >
                  Lock vault
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#d9e8e9] bg-[#f3f8f8] px-3 py-2">
                <p className="text-[10px] font-semibold text-[#426e70]" data-testid="status-vault-unlocked">Vault unlocked{expiresAt ? ` · expires ${new Date(expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}</p>
                <button type="button" disabled={updatePasscode.isPending || updateControl.isPending} data-testid="button-vault-lock" onClick={lockVault} className="rounded-md border border-[#d4e1e4] bg-white px-3 py-1.5 text-[9px] font-bold text-[#466577] disabled:opacity-50">Lock vault</button>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-[.75fr_1.25fr]">
                <form onSubmit={changeVaultPasscode} className="rounded-xl border border-[#e7ecef] p-3" data-testid="form-vault-change-passcode">
                  <h3 className="text-[10px] font-bold text-[#344b64]">Change passcode</h3>
                  <label className="mt-2 block text-[9px] font-semibold text-[#667a8d]">New four-digit passcode
                    <input required pattern="[0-9]{4}" inputMode="numeric" autoComplete="new-password" maxLength={4} value={newPasscode} onChange={event => setNewPasscode(event.target.value.replace(/\D/g, '').slice(0, 4))} className={`${fieldClass} mt-1`} data-testid="input-vault-new-passcode" />
                  </label>
                  <button type="submit" disabled={loading || newPasscode.length !== 4} data-testid="button-vault-change-passcode" className="mt-2 h-8 rounded-lg border border-[#dfe6eb] px-3 text-[9px] font-bold text-[#405a73] disabled:opacity-50">{updatePasscode.isPending ? 'Updating…' : 'Update passcode'}</button>
                </form>
                <div className="rounded-xl border border-[#e7ecef] p-3">
                  <div className="flex items-center justify-between gap-2"><h3 className="text-[10px] font-bold text-[#344b64]">Wallet policies</h3><button type="button" onClick={() => void controls.refetch()} data-testid="button-refresh-wallet-controls" className="text-[9px] font-bold text-[#397b80]">Refresh</button></div>
                  <p className="mt-1 text-[9px] leading-4 text-[#8190a0]">Policy choices apply to future requests only. Existing transactions keep their recorded status.</p>
                  {controls.isLoading ? <div className="mt-2 h-10 animate-pulse rounded-lg bg-[#f0f4f6]" /> : controls.isError ? <p role="alert" className="mt-2 text-[9px] text-[#a24940]">Wallet controls could not be loaded. Refresh to try again.</p> : controls.data?.length ? (
                    <div className="mt-2 space-y-2">{controls.data.map(control => <article key={control.walletId} data-testid={`vault-wallet-control-${control.walletId}`} className="rounded-lg bg-[#f8fafb] p-2.5">
                      <div className="flex items-center justify-between gap-2"><strong className="text-[10px] text-[#324962]">{control.currency} wallet</strong><label className="flex items-center gap-1.5 text-[8px] text-[#64798d]"><input type="checkbox" checked={control.transfersEnabled} disabled={busyWallet === control.walletId} onChange={event => void changeControl(control, { transfersEnabled: event.target.checked })} data-testid={`toggle-vault-transfers-${control.walletId}`} />Transfers</label></div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <label className="flex items-center gap-1.5 text-[8px] text-[#64798d]"><input type="checkbox" checked={control.depositsEnabled} disabled={busyWallet === control.walletId} onChange={event => void changeControl(control, { depositsEnabled: event.target.checked })} data-testid={`toggle-vault-deposits-${control.walletId}`} />Deposits</label>
                        <label className="flex items-center gap-1.5 text-[8px] text-[#64798d]"><input type="checkbox" checked={control.withdrawalsEnabled} disabled={busyWallet === control.walletId} onChange={event => void changeControl(control, { withdrawalsEnabled: event.target.checked })} data-testid={`toggle-vault-withdrawals-${control.walletId}`} />Withdrawals</label>
                      </div>
                      <label className="mt-2 flex items-center gap-2 text-[8px] font-semibold text-[#64798d]">Future transfer requests
                        <select value={control.futureTransferMode} disabled={busyWallet === control.walletId} onChange={event => void changeControl(control, { futureTransferMode: event.target.value as BankVaultWalletControl['futureTransferMode'] })} className="h-7 flex-1 rounded-md border border-[#dfe6eb] bg-white px-2 text-[9px]" data-testid={`select-vault-future-transfer-mode-${control.walletId}`}>
                          <option value="successful">Successful after ledger posting</option><option value="pending">Pending administrator review</option><option value="failed">Fail without posting</option>
                        </select>
                      </label>
                      {busyWallet === control.walletId && <p role="status" className="mt-1 text-[8px] text-[#55868b]">Saving wallet policy…</p>}
                    </article>)}</div>
                  ) : <p className="mt-2 rounded-lg border border-dashed border-[#dfe6eb] p-3 text-center text-[9px] text-[#8492a1]">No wallet controls are available.</p>}
                </div>
              </div>
              <details className="mt-3 rounded-xl border border-[#e7ecef] bg-[#fbfcfd] p-3" data-testid="vault-email-banner-settings">
                <summary className="cursor-pointer text-[10px] font-bold text-[#344b64]">Transaction email banner</summary>
                <p className="mt-2 text-[9px] leading-4 text-[#8190a0]">Customize the banner for future transfer alerts. Globus branding stays in place; only approved colors and a short headline can be changed.</p>
                {emailPreferences.isLoading ? <div className="mt-2 h-8 animate-pulse rounded-lg bg-[#f0f4f6]" /> : emailPreferences.isError ? <p role="alert" className="mt-2 text-[9px] text-[#a24940]">Email banner settings could not be loaded.</p> : <form onSubmit={submitEmailPreferences} className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-[9px] font-semibold text-[#5c7085]">Banner color
                    <select value={bannerTheme} onChange={event => setBannerTheme(event.target.value as BankVaultEmailPreferences['bannerTheme'])} className={`${fieldClass} mt-1`} data-testid="select-vault-email-banner-theme">
                      <option value="navy">Globus navy</option><option value="teal">Globus teal</option><option value="gold">Globus gold</option>
                    </select>
                  </label>
                  <label className="text-[9px] font-semibold text-[#5c7085]">Banner headline
                    <input required maxLength={60} value={bannerHeadline} onChange={event => setBannerHeadline(event.target.value)} className={`${fieldClass} mt-1`} data-testid="input-vault-email-banner-headline" />
                  </label>
                  <label className="flex items-start gap-2 text-[9px] leading-4 text-[#64798d] sm:col-span-2">
                    <input type="checkbox" checked={includeSupportLink} onChange={event => setIncludeSupportLink(event.target.checked)} className="mt-0.5 accent-[#438481]" data-testid="toggle-vault-email-support-link" />
                    <span>I confirm that future recipient alert emails may include the Globus Contact page link.</span>
                  </label>
                  <button type="submit" disabled={saveEmailPreferences.isPending || !bannerHeadline.trim()} data-testid="button-save-vault-email-banner" className="h-8 justify-self-start rounded-lg bg-[#173858] px-3 text-[9px] font-bold text-white disabled:opacity-50 sm:col-span-2">{saveEmailPreferences.isPending ? 'Saving…' : 'Save email design'}</button>
                </form>}
              </details>
            </div>
          )}
      {(error || updateControl.isError) && <p role="alert" data-testid="status-vault-error" className="mt-3 rounded-lg bg-[#fff1ef] px-3 py-2 text-[9px] text-[#a24940]">{error || 'A wallet policy could not be saved.'}</p>}
      {message && <p role="status" data-testid="status-vault-message" className="mt-3 rounded-lg bg-[#f0f8f4] px-3 py-2 text-[9px] text-[#41755f]">{message}</p>}
    </section>
  );
}
