"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/db";
import { signIn, signOut } from "@/lib/auth";

const signupSchema = z.object({
  email: z.string().email("Введите корректный email"),
  name: z.string().trim().max(60).optional().or(z.literal("")),
  password: z.string().min(6, "Пароль минимум 6 символов").max(200),
});

export type AuthResult = { ok: true } | { ok: false; error: string };

export async function signupAction(formData: FormData): Promise<AuthResult> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name") ?? "",
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }
  const { email, name, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "Пользователь с таким email уже существует" };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { email, name: name || null, passwordHash },
  });

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (err) {
    if (err instanceof AuthError) {
      return { ok: false, error: "Не удалось войти после регистрации" };
    }
    throw err;
  }

  return { ok: true };
}

const signinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function signinAction(formData: FormData): Promise<AuthResult> {
  const parsed = signinSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Введите email и пароль" };
  }
  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { ok: false, error: "Неверный email или пароль" };
    }
    throw err;
  }
  return { ok: true };
}

export async function signoutAction(): Promise<void> {
  await signOut({ redirectTo: "/signin" });
}
