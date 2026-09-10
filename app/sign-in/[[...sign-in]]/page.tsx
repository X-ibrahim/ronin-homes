import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div
      style={{
        minHeight: '100svh',
        display: 'grid',
        placeItems: 'center',
        padding: '40px 20px',
        background: '#071b13',
      }}
    >
      <SignIn />
    </div>
  );
}
