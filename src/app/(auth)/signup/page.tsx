"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { signupAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignUpPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      setError(null);
      const res = await signupAction(fd);
      if (res.ok) {
        toast.success("Аккаунт создан");
        router.push("/");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6"
      >
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Регистрация</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Создайте аккаунт за 10 секунд.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Имя</Label>
          <Input id="name" name="name" type="text" autoComplete="name" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Пароль</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={6}
            required
          />
        </div>

        {error && <p className="text-sm text-[var(--color-destructive)]">{error}</p>}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Создаём…" : "Создать аккаунт"}
        </Button>

        <p className="text-sm text-[var(--color-muted-foreground)] text-center">
          Уже есть аккаунт?{" "}
          <Link href="/signin" className="text-[var(--color-primary)] underline">
            Войти
          </Link>
        </p>
      </form>
    </div>
  );
}
