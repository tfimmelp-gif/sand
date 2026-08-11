import { LoginPanel } from "@/components/login-panel";

export default function AdminLoginPage() {
  return (
    <LoginPanel
      expectedRole="SUPER_ADMIN"
      eyebrow="Admin Console"
      title="Super Admin Login"
      subtitle="Sign in to provision tenants, manage domains, assign links, and edit index.html preset folders."
      buttonLabel="Sign in to Admin"
      successPath="/admin/users"
    />
  );
}
