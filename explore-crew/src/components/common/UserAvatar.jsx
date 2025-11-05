import React from "react";

export default function UserAvatar({ user, size = "md", className = "" }) {
  const sizes = {
    xs: "w-6 h-6 text-xs",
    sm: "w-8 h-8 text-sm",
    md: "w-10 h-10 text-base",
    lg: "w-12 h-12 text-lg",
    xl: "w-16 h-16 text-xl",
    "2xl": "w-24 h-24 text-3xl",
  };

  if (user?.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user?.username || user?.full_name || user?.email || "User"}
        className={`${sizes[size]} rounded-full object-cover ${className}`}
      />
    );
  }

  const initial = (user?.username || user?.full_name || user?.email || "?")[0].toUpperCase();
  return (
    <div className={`${sizes[size]} rounded-full bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center text-white font-semibold ${className}`}>
      {initial}
    </div>
  );
}
