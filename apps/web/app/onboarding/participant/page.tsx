import { ParticipantFlow } from "@/components/onboarding/ParticipantFlow";

export const metadata = {
  title: "Set up your energy — GridFlex",
};

// No signed-in redirect here: saving sets the account cookie, and the page
// must stay put so the "You're ready" screen can show before the dashboard.
export default function ParticipantOnboardingPage() {
  return <ParticipantFlow />;
}
