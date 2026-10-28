import { useAuth } from "../context/AuthContext.jsx";
import { userKey } from "../utils/auth.js";
import useLocalStorage from "./useLocalStorage.js";

// useLocalStorage scoped to the signed-in user. Providers using it are remounted per user, so the key never changes under them.
export default function useUserStorage(key, initialValue) {
  const { user } = useAuth();
  return useLocalStorage(userKey(key, user.id), initialValue);
}
