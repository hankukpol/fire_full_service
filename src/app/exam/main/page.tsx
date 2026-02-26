import { getServerSession } from "next-auth";
import ExamFunctionArea from "@/components/landing/ExamFunctionArea";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSiteSettingsUncached } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

async function getHasSubmission(userId: number): Promise<boolean> {
  const activeExam = await prisma.exam.findFirst({
    where: { isActive: true },
    orderBy: [{ examDate: "desc" }, { id: "desc" }],
    select: { id: true },
  });

  const submissionCount = await prisma.submission.count({
    where: activeExam
      ? {
          userId,
          examId: activeExam.id,
        }
      : {
          userId,
        },
  });

  return submissionCount > 0;
}

export default async function ExamMainPage() {
  const session = await getServerSession(authOptions);
  const userId = Number(session?.user?.id ?? 0);
  const isAuthenticated = Number.isInteger(userId) && userId > 0;
  const isAdmin = session?.user?.role === "ADMIN";
  const hasSubmission = isAuthenticated ? await getHasSubmission(userId) : false;
  const settings = await getSiteSettingsUncached();
  const finalPredictionEnabled = Boolean(settings["site.finalPredictionEnabled"] ?? false);
  const commentsEnabled = Boolean(settings["site.commentsEnabled"] ?? true);

  return (
    <ExamFunctionArea
      isAuthenticated={isAuthenticated}
      hasSubmission={hasSubmission}
      isAdmin={isAdmin}
      finalPredictionEnabled={finalPredictionEnabled}
      commentsEnabled={commentsEnabled}
    />
  );
}
