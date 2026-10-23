import { Navigate } from "react-router-dom";
import { useProfile } from "../context/ProfileContext.jsx";

export default function HomePage() {
  const { profile } = useProfile();
  return <Navigate to={profile ? "/dashboard" : "/wizard"} replace />;
}
