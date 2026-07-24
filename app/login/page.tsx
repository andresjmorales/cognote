import { requiresBetaCode } from "@/lib/entitlements";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = { title: "Login — CogNote" };

export default function LoginPage() {
  return <LoginForm betaRequired={requiresBetaCode()} />;
}
