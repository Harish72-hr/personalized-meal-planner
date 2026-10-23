import { ArrowRight, Leaf } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useProfile } from "../../context/ProfileContext.jsx";

// Shown instead of the app when a saved profile no longer passes validation
// (for example, a profile saved before the input ranges were tightened).
export default function ProfileNeedsUpdate({ errors }) {
  const { profile, beginWizard } = useProfile();
  const navigate = useNavigate();
  return (
    <main className="profile-update">
      <section className="profile-update-card" aria-labelledby="profile-update-title">
        <span className="brand-mark"><Leaf size={18} /></span>
        <h1 id="profile-update-title">Your profile needs a quick update</h1>
        <p>We improved how daily targets are calculated. A few details need checking before we can show your plan:</p>
        <ul>{Object.entries(errors).map(([field, message]) => <li key={field}>{message}</li>)}</ul>
        <button className="button button-primary" type="button" onClick={() => { beginWizard(profile); navigate("/wizard"); }}>
          Update my profile <ArrowRight size={16} />
        </button>
      </section>
    </main>
  );
}
