import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Admin sign in · FPT Hoa Lac Campus Map" },
      { name: "description", content: "Sign in to manage buildings, paths and the map of FPT Hoa Lac campus." },
      { property: "og:title", content: "Admin sign in · FPT Hoa Lac Campus Map" },
      { property: "og:description", content: "Campus map content management sign in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const done = async () => { await supabase.rpc("claim_first_admin"); nav({ to: "/" }); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg("");
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) setMsg(error.message); else await done();
    } else {
      const { error } = await supabase.auth.signUp({ email, password: pw, options: { emailRedirectTo: window.location.origin } });
      setMsg(error ? error.message : "Kiểm tra email để xác nhận tài khoản. / Check your email to confirm.");
    }
    setBusy(false);
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r && "error" in r && r.error) setMsg(String(r.error)); else await done();
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-map-ground p-4 font-sans">
      <form onSubmit={submit} className="glass w-full max-w-sm space-y-3 rounded-3xl p-6">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary font-extrabold text-primary-foreground">F</span>
          <div><div className="font-bold">Campus CMS</div><div className="text-xs text-muted-foreground">Quản trị bản đồ FPT Hòa Lạc</div></div>
        </div>
        <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10 w-full rounded-xl border bg-card px-3 text-sm" />
        <input required type="password" minLength={6} placeholder="Mật khẩu / Password" value={pw} onChange={(e) => setPw(e.target.value)} className="h-10 w-full rounded-xl border bg-card px-3 text-sm" />
        <button disabled={busy} className="h-10 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground">{mode === "in" ? "Đăng nhập" : "Tạo tài khoản"}</button>
        <button type="button" onClick={google} className="h-10 w-full rounded-xl border bg-card text-sm font-semibold">Tiếp tục với Google</button>
        {msg && <p className="text-xs text-primary">{msg}</p>}
        <div className="flex justify-between text-xs text-muted-foreground">
          <button type="button" className="underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>{mode === "in" ? "Chưa có tài khoản?" : "Đã có tài khoản?"}</button>
          <Link to="/" className="underline">← Bản đồ</Link>
        </div>
        <p className="text-[11px] text-muted-foreground">The first account to sign in becomes the campus admin.</p>
      </form>
    </div>
  );
}
