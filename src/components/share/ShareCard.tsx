import React from "react";

interface ShareCardProps {
  examTitle: string;
  userName: string;
  examTypeLabel: string;
  regionName: string;
  finalScore: number;
  rank: number | null;
  totalParticipants: number | null;
  rankingBasisLabel?: string | null;
  predictionGrade?: string | null;
}

export default function ShareCard({
  examTitle,
  userName,
  examTypeLabel,
  regionName,
  finalScore,
  rank,
  totalParticipants,
  rankingBasisLabel,
  predictionGrade,
}: ShareCardProps) {
  return (
    <div
      style={{
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background:
          "linear-gradient(145deg, #0b1f62 0%, #112b8a 35%, #1f4fa8 100%)",
        color: "#ffffff",
        padding: "56px",
        fontFamily: "Noto Sans KR, sans-serif",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 34, fontWeight: 800 }}>소방 합격예측 공유</div>
        <div style={{ fontSize: 20, opacity: 0.9 }}>{examTitle}</div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: "24px",
        }}
      >
        <div
          style={{
            flex: 1,
            borderRadius: "20px",
            background: "rgba(255,255,255,0.12)",
            padding: "28px",
            fontSize: 28,
            fontWeight: 700,
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
          }}
        >
          {`${userName}님의 결과`}
        </div>
        <div
          style={{
            flex: 1,
            borderRadius: "20px",
            background: "rgba(255,255,255,0.15)",
            padding: "28px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            fontSize: 26,
            fontWeight: 600,
          }}
        >
          <div>{`유형: ${examTypeLabel}`}</div>
          <div>{`지역: ${regionName}`}</div>
          <div>{`최종점수: ${finalScore.toFixed(2)}점`}</div>
          <div>
            {`석차: ${
              rank && totalParticipants
                ? `${rank.toLocaleString("ko-KR")} / ${totalParticipants.toLocaleString("ko-KR")}`
                : "-"
            }`}
          </div>
          <div>{`순위 기준: ${rankingBasisLabel ?? "-"}`}</div>
          <div>{`합격예측: ${predictionGrade ?? "-"}`}</div>
        </div>
      </div>

      <div style={{ fontSize: 22, opacity: 0.9 }}>내 점수를 공유하고 합격 가능성을 비교해보세요.</div>
    </div>
  );
}
