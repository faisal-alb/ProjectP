import { OperatorFlow } from "@/components/onboarding/OperatorFlow";

export const metadata = {
  title: "Set up your network | GridFlex",
};

// No signed-in redirect here: saving sets the account cookie, and the page
// must stay put so the "network is ready" screen can show before the dashboard.
export default function OperatorOnboardingPage() {
  return <OperatorFlow />;
}
