import { LoginPanel } from "@/components/login-panel";

export default function LoginPage() {
  return (
    <LoginPanel
      expectedRole="WORKSPACE_USER"
      eyebrow="Tenant Portal"
      title="Workspace Login"
      subtitle="Sign in to manage assigned links, choose page presets, and review traffic results."
      buttonLabel="Sign in to Workspace"
      successPath="/dashboard"
    />
  );
}
