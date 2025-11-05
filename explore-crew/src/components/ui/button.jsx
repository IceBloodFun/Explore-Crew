import React from "react";

/**
 * Bouton minimal, stylé Tailwind, compatible avec className externe.
 * Variants: default | outline | ghost
 * Sizes: sm | md | lg | icon
 */
const variants = {
  default:
    "inline-flex items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors",
  outline:
    "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 transition-colors",
  ghost:
    "inline-flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 transition-colors",
};

const sizes = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4",
  lg: "h-12 px-6 text-base",
  icon: "h-10 w-10 p-0",
};

const Button = React.forwardRef(
  ({ variant = "default", size = "md", className = "", ...props }, ref) => (
    <button
      ref={ref}
      className={`${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  )
);

Button.displayName = "Button";
export { Button };
export default Button;
