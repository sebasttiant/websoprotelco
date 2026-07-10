import { SignInForm } from "./sign-in-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-6 px-6 py-16">
      <h1 className="text-2xl font-bold text-slate-950">Sign in</h1>
      <SignInForm />
    </main>
  );
}
