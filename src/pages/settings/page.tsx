import { useEffect, useState } from "react";
import { Sun, Moon, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { useTheme } from "next-themes";

export default function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [notifications, setNotifications] = useState<boolean>(() => {
    const v = localStorage.getItem("app_notifications");
    return v ? v === "true" : true;
  });

  useEffect(() => {
    localStorage.setItem("app_notifications", String(notifications));
  }, [notifications]);

  return (
    <div className="flex h-full flex-col overflow-auto bg-background">
      <div className="border-b border-border px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Moon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground">
              Personalize your experience
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-4 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Dark mode</p>
                <p className="text-sm text-muted-foreground">Switch between light and dark themes</p>
              </div>
              <div className="flex items-center gap-3">
                {resolvedTheme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                <Switch
                  checked={(theme ?? resolvedTheme) === "dark"}
                  onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Enable notifications</p>
                <p className="text-sm text-muted-foreground">Receive status alerts and updates</p>
              </div>
              <div className="flex items-center gap-3">
                <Bell className="h-4 w-4" />
                <Switch
                  checked={notifications}
                  onCheckedChange={(checked) => setNotifications(checked)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
