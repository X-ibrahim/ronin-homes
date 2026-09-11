import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
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
      <SignUp />
    </div>
  );
}
