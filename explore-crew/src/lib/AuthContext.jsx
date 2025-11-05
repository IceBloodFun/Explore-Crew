// src/lib/AuthContext.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AuthCtx } from "./auth";

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      const { data: { session: sess } } = await supabase.auth.getSession();
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      setSession(sess || null);
      setUser(user || null);
      setLoading(false);
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, sess) => {
        setSession(sess || null);
        setUser(sess?.user || null);
      }
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthCtx.Provider value={{ session, user, loading }}>
      {children}
    </AuthCtx.Provider>
  );
}
