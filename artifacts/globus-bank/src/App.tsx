import { useEffect, useRef, type ReactNode } from 'react';
import { ClerkProvider, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { BankShell } from '@/components/bank-shell';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthFrame, ClerkSignInForm, ClerkSignUpForm, EmailRecoverySignInForm } from '@/components/auth-pages';
import { PwaInstallPrompt } from '@/components/pwa-install-prompt';
import NotFound from '@/pages/not-found';
import {
  DashboardPage,
  DisclosurePage,
  HomePage,
  InternationalTransferPage,
  ProviderRequestPage,
  ReceivePage,
  SettingsPage,
  TransactionsPage,
  WalletsPage,
} from '@/pages/bank-pages';
import { AdminWorkspace } from '@/pages/admin-workspace';
import {
  Redirect,
  Route,
  Switch,
  Link,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/globus-wordmark.png`,
  },
  variables: {
    colorPrimary: '#173b62',
    colorForeground: '#203851',
    colorMutedForeground: '#728296',
    colorDanger: '#b64d45',
    colorBackground: '#ffffff',
    colorInput: '#fbfcfd',
    colorInputForeground: '#30465f',
    colorNeutral: '#dfe6ec',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '0.8rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-transparent rounded-none w-full max-w-[440px] overflow-hidden border-0 shadow-none',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none !p-0',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    header: 'hidden',
    headerTitle: 'font-semibold tracking-tight text-[#18324f]',
    headerSubtitle: 'text-[#718196]',
    formFieldLabel: 'font-semibold text-[#435971]',
    footerActionLink: 'font-semibold text-[#357b83]',
    footerActionText: 'text-[#718196]',
    dividerText: 'text-[#8290a0]',
    identityPreviewEditButton: 'text-[#357b83]',
    formFieldSuccessText: 'text-[#397a62]',
    alertText: 'text-[#a24940]',
    logoBox: 'mb-3',
    logoImage: 'h-auto max-h-12 max-w-[180px]',
    socialButtonsBlock: 'hidden',
    dividerRow: 'hidden',
    socialButtonsBlockButton: 'hidden',
    formButtonPrimary: 'bg-[#173b62] hover:bg-[#214c76] text-white',
    formFieldInput: 'border-[#dfe6ec] bg-[#fbfcfd] text-[#30465f]',
    footerAction: 'text-[#718196]',
    dividerLine: 'bg-[#e4e9ed]',
    alert: 'border-[#efd8d3] bg-[#fff7f5]',
    otpCodeFieldInput: 'border-[#dfe6ec] text-[#30465f]',
    formFieldRow: 'gap-1',
    main: 'gap-5',
  },
};

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <HomePage />
      </Show>
    </>
  );
}

function ProtectedPage({ children }: { children: ReactNode }) {
  return (
    <>
      <Show when="signed-in">
        <BankShell>{children}</BankShell>
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function ProtectedAdminPage() {
  return (
    <>
      <Show when="signed-in">
        <AdminWorkspace />
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function SignInPage() {
  return (
    <AuthFrame mode="sign-in">
      <ClerkSignInForm />
    </AuthFrame>
  );
}

function EmailRecoveryPage() {
  return (
    <AuthFrame mode="sign-in">
      <EmailRecoverySignInForm />
    </AuthFrame>
  );
}

function SignUpPage() {
  return (
    <AuthFrame mode="sign-up">
      <ClerkSignUpForm />
    </AuthFrame>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const currentClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        currentClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, currentClient]);

  return null;
}

function ClerkRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: 'Welcome back',
            subtitle: 'Sign in to access your Globus workspace',
          },
        },
        signUp: {
          start: {
            title: 'Set up your account',
            subtitle: 'Create a secure account to explore Globus',
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <ClerkQueryClientCacheInvalidator />
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/sign-in/email" component={EmailRecoveryPage} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/dashboard"><ProtectedPage><DashboardPage /></ProtectedPage></Route>
        <Route path="/wallets"><ProtectedPage><WalletsPage /></ProtectedPage></Route>
        <Route path="/transactions"><ProtectedPage><TransactionsPage /></ProtectedPage></Route>
        <Route path="/send"><Redirect to="/international-transfer" /></Route>
        <Route path="/international-transfer"><ProtectedPage><InternationalTransferPage /></ProtectedPage></Route>
        <Route path="/add-money"><ProtectedPage><ProviderRequestPage type="deposit" /></ProtectedPage></Route>
        <Route path="/withdraw"><ProtectedPage><ProviderRequestPage type="withdrawal" /></ProtectedPage></Route>
        <Route path="/receive"><ProtectedPage><ReceivePage /></ProtectedPage></Route>
        <Route path="/settings"><ProtectedPage><SettingsPage /></ProtectedPage></Route>
        <Route path="/admin/users/:userId"><ProtectedAdminPage /></Route>
        <Route path="/admin/users"><ProtectedAdminPage /></Route>
        <Route path="/admin/accounts"><ProtectedAdminPage /></Route>
        <Route path="/admin/transactions"><ProtectedAdminPage /></Route>
        <Route path="/admin/funding"><ProtectedAdminPage /></Route>
        <Route path="/admin/wallets"><ProtectedAdminPage /></Route>
        <Route path="/admin/restrictions"><ProtectedAdminPage /></Route>
        <Route path="/admin/audit"><ProtectedAdminPage /></Route>
        <Route path="/admin/settings"><ProtectedAdminPage /></Route>
        <Route path="/admin/logout"><ProtectedAdminPage /></Route>
        <Route path="/admin"><ProtectedAdminPage /></Route>
        <Route path="/about"><DisclosurePage path="/about" /></Route>
        <Route path="/help"><DisclosurePage path="/help" /></Route>
        <Route path="/fees"><DisclosurePage path="/fees" /></Route>
        <Route path="/privacy"><DisclosurePage path="/privacy" /></Route>
        <Route path="/terms"><DisclosurePage path="/terms" /></Route>
        <Route path="/contact"><DisclosurePage path="/contact" /></Route>
        <Route component={NotFound} />
      </Switch>
      <PwaInstallPrompt />
    </ClerkProvider>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={basePath}>
          <RoutedErrorBoundary>
            <ClerkRoutes />
          </RoutedErrorBoundary>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
