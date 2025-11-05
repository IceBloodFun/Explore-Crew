import React from "react";

const Input = React.forwardRef(({ className = "", ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={[
        "block w-full rounded-lg border border-slate-300 bg-white",
        "px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm",
        "focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent",
        className,
      ].join(" ")}
      {...props}
    />
  );
});

Input.displayName = "Input";
export { Input };
export default Input;
