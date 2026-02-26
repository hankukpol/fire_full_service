import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function ExamLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/exam/main");
  }

  const userId = Number(session.user.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    redirect("/login?callbackUrl=/exam/main");
  }

  return (
    <main className="pb-10">
      <div className="mx-auto w-full max-w-7xl px-4 py-6">{children}</div>
    </main>
  );
}
