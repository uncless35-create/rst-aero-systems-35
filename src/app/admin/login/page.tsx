"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";

export default function AdminLoginPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(values: LoginInput) {
    setSubmitting(true);
    const res = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });

    if (res?.error) {
      setSubmitting(false);
      toast.error("Неверный email или пароль");
      return;
    }

    // Проверяем роль
    const session = await fetch("/api/auth/session").then((r) => r.json());
    setSubmitting(false);
    if (session?.user?.role !== "ADMIN") {
      toast.error("Доступ только для администратора");
      return;
    }
    router.push("/admin/dashboard");
    router.refresh();
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-surface px-4">
      <div className="w-full max-w-sm rounded-3xl bg-background p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground">
            <ShieldCheck className="size-6" />
          </div>
          <h1 className="mt-4 text-xl font-bold tracking-tight">Админ-панель</h1>
          <p className="mt-1 text-sm text-muted-foreground">RST AERO SYSTEMS</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" {...register("email")} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Пароль</Label>
            <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            {submitting ? <Loader2 className="size-5 animate-spin" /> : "Войти"}
          </Button>
        </form>
      </div>
    </div>
  );
}
