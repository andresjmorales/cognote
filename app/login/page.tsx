import { getDeploymentMode, requiresBetaCode } from "@/lib/entitlements";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = { title: "Login — CogNote" };

export default function LoginPage() {
  const hosted = getDeploymentMode() === "hosted";
  return (
    <LoginForm
      betaRequired={requiresBetaCode()}
      showLegalLinks={hosted}
      isHosted={hosted}
    />
  );
}
