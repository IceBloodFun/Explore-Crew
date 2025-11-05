import React, { useEffect, useState } from "react";
import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { Home, Map, Heart, Users, User as UserIcon, Plus } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import UserAvatar from "@/components/common/UserAvatar";

const navItems = [
  { to: "/feed", name: "Feed", icon: Home },
  { to: "/mapview", name: "Map", icon: Map },
  { to: "/wishlist", name: "Wishlist", icon: Heart },
  { to: "/friends", name: "Friends", icon: Users },
  { to: "/profile", name: "Profile", icon: UserIcon },
];

export default function Layout() {
  const location = useLocation();
  const [me, setMe] = useState(null);
  const [profile, setProfile] = useState(null);

  // Charge l'utilisateur et son profil (avatar_url)
  useEffect(() => {
    let sub;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setMe(user || null);

      if (user) {
        // Assure qu'une ligne existe dans profiles (si besoin)
        await supabase.from("profiles").upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });
        const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        setProfile(data || null);
      } else {
        setProfile(null);
      }

      sub = supabase.auth.onAuthStateChange(async (_event, session) => {
        const u = session?.user ?? null;
        setMe(u);
        if (u) {
          const { data: p } = await supabase.from("profiles").select("*").eq("id", u.id).single();
          setProfile(p || null);
        } else {
          setProfile(null);
        }
      });
    })();

    return () => {
      if (sub && typeof sub.subscription?.unsubscribe === "function") {
        sub.subscription.unsubscribe();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-cyan-50">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/feed" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">EC</span>
            </div>
            <span className="font-bold text-xl text-slate-800">Explore Crew</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ to, name, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    isActive ? "bg-cyan-500 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium">{name}</span>
              </NavLink>
            ))}
          </nav>

          {/* Actions (desktop) */}
          <div className="hidden md:flex items-center gap-3">
            {/* Add Event */}
            <Link to="/addevent">
              <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-600 text-white rounded-lg hover:shadow-lg transition-all">
                <Plus className="w-4 h-4" />
                <span className="font-medium">Add Event</span>
              </button>
            </Link>

            {/* Avatar (lien vers profil) */}
            {me ? (
              <Link to="/profile" title={me.email} className="ml-1">
                <UserAvatar user={profile || { email: me.email }} size="sm" className="ring-1 ring-slate-200" />
              </Link>
            ) : (
              <Link to="/login" className="ml-1">
                <button className="h-10 px-4 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">
                  Sign in
                </button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="pt-16 pb-20 md:pb-8 min-h-screen max-w-7xl mx-auto w-full">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map(({ to, name, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all ${
                  // pour que l’onglet Profile soit actif aussi quand on est sur /profile/...
                  isActive || (to === "/profile" && location.pathname.startsWith("/profile"))
                    ? "text-cyan-600"
                    : "text-slate-500"
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{name}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Floating Add (mobile) */}
      <Link to="/addevent" className="md:hidden">
        <button className="fixed bottom-20 right-4 z-50 w-14 h-14 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-full shadow-xl flex items-center justify-center hover:scale-110 transition-transform">
          <Plus className="w-6 h-6" />
        </button>
      </Link>
    </div>
  );
}
