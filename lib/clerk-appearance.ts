// Clerk UI theming shared by the sign-in/sign-up pages — matches the site's
// forest-green/red/yellow anime-poster brand (see app/layout.tsx's embedded
// CSS) rather than Clerk's default blue.
export const clerkAppearance = {
  layout: {
    socialButtonsPlacement: 'top' as const,
  },
  variables: {
    colorBackground: '#071b13',
    colorInputBackground: '#0e2a1c',
    colorInputText: '#fff5e8',
    colorText: '#fff5e8',
    colorTextSecondary: '#b7c9bd',
    colorPrimary: '#ffcc4d',
    colorDanger: '#ff3865',
    colorNeutral: '#fff5e8',
    borderRadius: '999px',
    fontFamily: 'Aberta, Arial, sans-serif',
    fontFamilyButtons: 'Aberta, Arial, sans-serif',
    fontSize: '14px',
  },
  elements: {
    card: {
      background: 'transparent',
      border: 'none',
      boxShadow: 'none',
      width: '100%',
    },
    formButtonPrimary: {
      background: '#ffcc4d',
      color: '#071b13',
      borderRadius: '999px',
      letterSpacing: '0.08em',
      fontSize: '12px',
      fontWeight: 800,
      textTransform: 'uppercase' as const,
      boxShadow: 'none',
      '&:hover': { background: '#ff3865', color: '#ffffff' },
    },
    formFieldInput: {
      background: '#0e2a1c',
      border: '1px solid rgba(255,245,232,.25)',
      color: '#fff5e8',
      borderRadius: '12px',
      '&:focus': { borderColor: '#ffcc4d', boxShadow: 'none' },
    },
    formFieldLabel: {
      color: '#b7c9bd',
      letterSpacing: '0.08em',
      textTransform: 'uppercase' as const,
      fontSize: '11px',
    },
    socialButtonsBlockButton: {
      border: '1px solid rgba(255,245,232,.35)',
      color: '#fff5e8',
      borderRadius: '999px',
    },
    footerActionLink: { color: '#ffcc4d', fontWeight: 700 },
    identityPreviewEditButton: { color: '#ffcc4d' },
    badge: { display: 'none' },
  },
};
