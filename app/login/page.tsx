import { Suspense } from 'react';
import AuthForm from '@/components/auth/AuthForm';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A] px-4 py-12">
      <Suspense fallback={null}>
        <AuthForm />
      </Suspense>
    </div>
  );
}
