import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between p-10 text-white"
           style={{ background: "linear-gradient(135deg, var(--color-navy) 0%, var(--color-navy-700) 60%, var(--color-teal-700) 100%)" }}>
        <Link href="/" className="text-2xl font-extrabold tracking-tight">Cethos<span className="text-[color:var(--color-teal-light)]">.</span></Link>
        <div>
          <h1 className="text-4xl font-extrabold leading-tight max-w-md">Where translators do their best work.</h1>
          <p className="mt-4 text-base text-white/75 max-w-md">
            Translation memory, terminology, MT, and QA — in one editor. Built for projects that ship.
          </p>
        </div>
        <p className="text-xs text-white/50">© {new Date().getFullYear()} Cethos. All rights reserved.</p>
      </div>

      {/* Form panel */}
      <div className="flex flex-col items-center justify-center p-6 lg:p-10 bg-[color:var(--color-bg-app)]">
        <div className="w-full max-w-[420px]">{children}</div>
      </div>
    </div>
  );
}
