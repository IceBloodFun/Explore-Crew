import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import Button from "@/components/ui/button";
import { LogIn } from "lucide-react";

export default function Login() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        const back = params.get("from") || "/feed";
        navigate(back, { replace: true });
      }
    });
  }, [navigate, params]);

  const handleGoogleLogin = async () => {
    const back = params.get("from") || "/feed";
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + back },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-500 to-teal-600">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-[90%] max-w-md text-center">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Explore Crew</h1>
        <p className="text-slate-600 mb-8">Connect with your crew ✨</p>
        <Button onClick={handleGoogleLogin} className="w-full h-12 bg-red-500 hover:bg-red-600 text-white flex items-center justify-center gap-2">
          <LogIn className="w-5 h-5" />
          Sign in with Google
        </Button>
      </div>
    </div>
  );
}
