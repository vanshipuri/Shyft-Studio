"use client";
export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-100 via-brand-50 to-brand-200 px-6 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-amber-soft/60 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full bg-rose-soft/60 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md bg-white/85 backdrop-blur-xl rounded-3xl shadow-2xl shadow-brand-950/10 border border-white/50 p-7 sm:p-10 md:p-12 anim-fade-up">
        <div className="mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-900 to-brand-700 text-white flex items-center justify-center shadow-lg shadow-brand-900/10 mb-5">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21a9 9 0 0 0 9-9c0-4.97-4.03-9-9-9s-9 4.03-9 9 4.03 9 9 9z"/><path d="M12 7v5l3 3"/></svg>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink-900 leading-tight">Shyft Studio</h1>
          <p className="text-brand-600 mt-2 text-base">Internal platform for sales & production.</p>
        </div>

        <form action="/api/auth/login" method="POST" className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-brand-700 mb-1.5">Work email</label>
            <input id="email" name="email" type="email" required autoComplete="email" placeholder="sam@shyft.studio" className="w-full rounded-xl border border-brand-300 bg-white/70 px-4 py-3 text-ink-900 placeholder:text-brand-400 focus:outline-none focus:ring-2 focus:ring-amber/50 focus:border-amber transition shadow-sm" />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-brand-700 mb-1.5">Password</label>
            <input id="password" name="password" type="password" required autoComplete="current-password" placeholder="••••••••" className="w-full rounded-xl border border-brand-300 bg-white/70 px-4 py-3 text-ink-900 placeholder:text-brand-400 focus:outline-none focus:ring-2 focus:ring-amber/50 focus:border-amber transition shadow-sm" />
          </div>
          <button type="submit" className="w-full rounded-xl bg-gradient-to-tr from-brand-900 to-brand-800 text-white font-bold py-3.5 shadow-xl shadow-brand-900/20 hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition duration-200">Sign in</button>
        </form>

        <div className="mt-8 pt-6 border-t border-brand-200/60">
          <p className="text-xs font-semibold text-brand-500 uppercase tracking-wider mb-3">Demo accounts</p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <button type="button" onClick={() => { const e = document.getElementById("email") as HTMLInputElement; const p = document.getElementById("password") as HTMLInputElement; if(e && p){ e.value = "samyak@shyft.studio"; p.value = "password123"; } }} className="text-center px-2 py-2.5 rounded-xl bg-brand-50 border border-brand-200 hover:border-amber hover:bg-amber-soft hover:-translate-y-0.5 active:translate-y-0 transition-all text-brand-700 font-bold truncate" title="samyak@shyft.studio">👑 Owner</button>
            <button type="button" onClick={() => { const e = document.getElementById("email") as HTMLInputElement; const p = document.getElementById("password") as HTMLInputElement; if(e && p){ e.value = "abhishek@shyft.studio"; p.value = "password123"; } }} className="text-center px-2 py-2.5 rounded-xl bg-brand-50 border border-brand-200 hover:border-amber hover:bg-amber-soft hover:-translate-y-0.5 active:translate-y-0 transition-all text-brand-700 font-bold truncate" title="abhishek@shyft.studio">💼 Sales</button>
            <button type="button" onClick={() => { const e = document.getElementById("email") as HTMLInputElement; const p = document.getElementById("password") as HTMLInputElement; if(e && p){ e.value = "siddhant@shyft.studio"; p.value = "password123"; } }} className="text-center px-2 py-2.5 rounded-xl bg-brand-50 border border-brand-200 hover:border-amber hover:bg-amber-soft hover:-translate-y-0.5 active:translate-y-0 transition-all text-brand-700 font-bold truncate" title="siddhant@shyft.studio">⚙️ Production</button>
          </div>
          <p className="text-xs text-brand-400 mt-2">Password is <code className="text-brand-600 font-medium">password123</code> for all.</p>
        </div>
      </div>
    </main>
  );
}
