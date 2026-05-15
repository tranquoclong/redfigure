import { AuthBreadcrumb, AuthFormPanel } from './_components/auth-form-panel';
import { AuthSideArt } from './_components/auth-side-art';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-full px-4 py-12 lg:py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(900px 600px at 50% 20%, rgba(184,41,255,0.18), transparent 60%), radial-gradient(700px 500px at 80% 90%, rgba(0,240,255,0.10), transparent 60%)',
        }}
      />

      <div className="relative mx-auto max-w-[1100px]">
        <AuthBreadcrumb />
        <div className="grid items-stretch gap-6 lg:grid-cols-2">
          <AuthFormPanel>{children}</AuthFormPanel>
          <AuthSideArt />
        </div>
      </div>
    </div>
  );
}
