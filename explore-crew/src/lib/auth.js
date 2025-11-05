import { createContext, useContext } from "react";

export const AuthCtx = createContext({
  session: null,
  user: null,
  loading: true,
});

export function useAuth() {
  return useContext(AuthCtx);
}
