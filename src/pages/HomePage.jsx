import { Navigate } from "react-router-dom";
import { useProfile } from "../context/ProfileContext.jsx";
import { entryRoute } from "../utils/appFlow.js";

export default function HomePage() {
  const { profile } = useProfile();
  return <Navigate to={entryRoute(profile)} replace />;
}
