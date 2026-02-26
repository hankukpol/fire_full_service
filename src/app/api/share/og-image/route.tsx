import { ImageResponse } from "next/og";
import ShareCard from "@/components/share/ShareCard";

export const runtime = "edge";

export const alt = "소방 합격예측 공유 카드";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

function toNumber(value: string | null, fallbackValue: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallbackValue;
  return parsed;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const examTitle = searchParams.get("examTitle") ?? "소방 합격예측";
  const userName = searchParams.get("userName") ?? "응시자";
  const examTypeLabel = searchParams.get("examTypeLabel") ?? "공채";
  const regionName = searchParams.get("regionName") ?? "지역 미지정";
  const finalScore = toNumber(searchParams.get("finalScore"), 0);
  const rankRaw = searchParams.get("rank");
  const totalParticipantsRaw = searchParams.get("totalParticipants");
  const rankingBasisLabel = searchParams.get("rankingBasisLabel");
  const predictionGrade = searchParams.get("predictionGrade");

  return new ImageResponse(
    (
      <ShareCard
        examTitle={examTitle}
        userName={userName}
        examTypeLabel={examTypeLabel}
        regionName={regionName}
        finalScore={finalScore}
        rank={rankRaw ? toNumber(rankRaw, 0) : null}
        totalParticipants={totalParticipantsRaw ? toNumber(totalParticipantsRaw, 0) : null}
        rankingBasisLabel={rankingBasisLabel}
        predictionGrade={predictionGrade}
      />
    ),
    {
      ...size,
    }
  );
}
