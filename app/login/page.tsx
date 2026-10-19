import { connection } from "next/server";
import { getDeploymentMode, requiresBetaCode } from "@/lib/entitlements";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = { title: "Login — CogNote" };

export default async function LoginPage() {
  // Rendered per request: the beta gate is read from the running environment,
  // and a page prerendered at build time would freeze the build's value (a
  // prebuilt Docker image has none) out of step with the signup API.
  await connection();
  const hosted = getDeploymentMode() === "hosted";
  return (
    <LoginForm
      betaRequired={requiresBetaCode()}
      showLegalLinks={hosted}
      isHosted={hosted}
    />
  );
}
