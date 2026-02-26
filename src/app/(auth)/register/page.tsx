"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/providers/ToastProvider";
import { normalizePhone, validateRegisterInput } from "@/lib/validations";

interface RegisterResponse {
  error?: string;
  errors?: string[];
  message?: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const { showErrorToast, showToast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePhoneChange = (value: string) => {
    setPhone(normalizePhone(value));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const validationResult = validateRegisterInput({ name, phone, password });
    if (!validationResult.isValid) {
      setErrorMessage(validationResult.errors[0]);
      return;
    }

    if (password !== passwordConfirm) {
      setErrorMessage("비밀번호와 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validationResult.data),
      });

      const data = (await response.json()) as RegisterResponse;

      if (!response.ok) {
        const message = data.error ?? "회원가입 처리 중 오류가 발생했습니다.";
        setErrorMessage(message);
        showErrorToast(message);
        return;
      }

      const success = "회원가입이 완료되었습니다. 로그인 페이지로 이동합니다.";
      setSuccessMessage(success);
      showToast(success, "success");
      setTimeout(() => {
        router.push("/login");
      }, 800);
    } catch {
      const message = "회원가입 처리 중 오류가 발생했습니다.";
      setErrorMessage(message);
      showErrorToast(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">회원가입</CardTitle>
          <p className="text-sm text-slate-500">
            한글 이름과 연락처를 입력하고 계정을 생성하세요.
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="name">이름</Label>
              <Input
                id="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="홍길동"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">연락처</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(event) => handlePhoneChange(event.target.value)}
                placeholder="010-1234-5678"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="8자 이상 입력"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="passwordConfirm">비밀번호 확인</Label>
              <Input
                id="passwordConfirm"
                type="password"
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                placeholder="비밀번호를 다시 입력"
                required
              />
            </div>

            {errorMessage ? (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{errorMessage}</p>
            ) : null}

            {successMessage ? (
              <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {successMessage}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "가입 처리 중..." : "회원가입"}
            </Button>
          </form>

          <p className="mt-4 text-sm text-slate-600">
            이미 계정이 있으신가요?{" "}
            <Link href="/login" className="font-medium text-slate-900 underline">
              로그인
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
