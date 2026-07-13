"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerSchema, type RegisterInput } from "@/lib/validation/auth";
import { registerUser } from "@/actions/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  async function onSubmit(values: RegisterInput) {
    setSubmitting(true);
    try {
      const res = await registerUser(values);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const signInRes = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      });

      if (signInRes?.error) {
        toast.success("Аккаунт создан. Войдите в систему.");
        router.push("/login");
      } else {
        toast.success("Добро пожаловать!");
        router.push("/account");
        router.refresh();
      }
    } catch {
      toast.error("Не удалось завершить регистрацию. Повторите попытку.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 pt-12">
      <h1 className="text-2xl font-bold tracking-tight">Регистрация</h1>
      <p className="mt-1 text-sm text-muted-foreground">Создайте аккаунт, чтобы отслеживать заказы.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hidden"
          {...register("website")}
        />
        <div className="space-y-2">
          <Label htmlFor="name">Имя</Label>
          <Input id="name" autoComplete="name" {...register("name")} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Телефон</Label>
          <Input id="phone" type="tel" autoComplete="tel" placeholder="+7 900 000-00-00" {...register("phone")} />
          {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Пароль</Label>
          <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>
        <label className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <input type="checkbox" {...register("privacyAccepted")} className="mt-0.5 size-4 shrink-0 accent-primary" />
          <span>
            Я соглашаюсь с обработкой персональных данных согласно{" "}
            <Link href="/privacy" target="_blank" className="underline underline-offset-2">политике конфиденциальности</Link>.
          </span>
        </label>
        {errors.privacyAccepted && <p className="text-xs text-destructive">{errors.privacyAccepted.message}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? <Loader2 className="size-5 animate-spin" /> : "Создать аккаунт"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="font-medium text-foreground hover:underline">
          Войти
        </Link>
      </p>
    </div>
  );
}
