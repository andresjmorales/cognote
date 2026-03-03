import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { AccountSettings } from "@/components/teacher/AccountSettings";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: teacher } = await supabase
    .from("teachers")
    .select("display_name, email, created_at")
    .eq("id", user.id)
    .single();

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Account Settings</h1>

      <Card padding="sm" className="mb-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs text-muted">Email</div>
            <div className="font-medium">{teacher?.email ?? user.email}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Member Since</div>
            <div className="font-medium">
              {new Date(teacher?.created_at ?? user.created_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
          </div>
        </div>
      </Card>

      <AccountSettings initialName={teacher?.display_name ?? ""} />
    </div>
  );
}
