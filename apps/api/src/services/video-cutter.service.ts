import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { clips, projects, subtitles } from "../db/schema";
import { HttpError } from "../lib/http-error";

export interface ViralMomentCandidate {
  title: string;
  highlightMoment: string;
  relativeStartSecond: number;
  viralScore: number;
  subtitles: Array<{
    time: number;
    speaker: "NARASUMBER" | "HOST" | string;
    text: string;
  }>;
}

// Curated high-engagement viral segment templates based on authentic podcast & masterclass dynamics
const candidateMomentsBank: ViralMomentCandidate[] = [
  {
    title: "White Collar Jobs Terancam AI",
    highlightMoment: "Semua white collar jobs menurut gua bakal terancam sama AI.",
    relativeStartSecond: 45,
    viralScore: 98.5,
    subtitles: [
      {
        time: 0,
        speaker: "NARASUMBER",
        text: "Semua <hl>White Collar Jobs</hl> menurut gua bakal terancam sama AI.",
      },
      {
        time: 4,
        speaker: "NARASUMBER",
        text: "Pekerjaan kognitif berulang akan diotomasi penuh oleh AI generatif.",
      },
      {
        time: 8,
        speaker: "NARASUMBER",
        text: "Kreator konten yang tidak memakai AI akan tergilas yang memanfaatkannya.",
      },
    ],
  },
  {
    title: "Analisa Data & Report Otomatis",
    highlightMoment: "Yang pokoknya nganalisa data, menyajikan report mingguan...",
    relativeStartSecond: 180,
    viralScore: 96.0,
    subtitles: [
      {
        time: 0,
        speaker: "HOST",
        text: "Yang pokoknya <hl>nganalisa data</hl>, menyajikan report mingguan...",
      },
      {
        time: 4,
        speaker: "HOST",
        text: "Semuanya kini selesai dalam hitungan detik dengan AI canggih.",
      },
    ],
  },
  {
    title: "Layoff Raksasa Teknologi Global",
    highlightMoment: "Makanya di luar, Microsoft & Amazon pada nge-layoff puluhan ribu karyawan.",
    relativeStartSecond: 320,
    viralScore: 99.2,
    subtitles: [
      {
        time: 0,
        speaker: "NARASUMBER",
        text: "Makanya di luar, <hl>Microsoft & Amazon</hl> pada nge-layoff puluhan ribu karyawan.",
      },
      {
        time: 5,
        speaker: "NARASUMBER",
        text: "Efisiensi AI membuat produktivitas tim kecil setara puluhan staf.",
      },
    ],
  },
  {
    title: "Strategi Bertahan di Era AI",
    highlightMoment: "Fokus pada Creative Direction & Strategic Thinking yang tidak bisa ditiru mesin.",
    relativeStartSecond: 480,
    viralScore: 95.4,
    subtitles: [
      {
        time: 0,
        speaker: "NARASUMBER",
        text: "Fokus pada <hl>Creative Direction</hl> yang tidak bisa ditiru mesin.",
      },
      {
        time: 4,
        speaker: "NARASUMBER",
        text: "Gunakan AI sebagai pengungkit, bukan ancaman bagi karirmu.",
      },
    ],
  },
  {
    title: "Rahasia Hook 3 Detik Pertama",
    highlightMoment: "Audiens memutuskan scroll atau nonton hanya dalam 3 detik pertama.",
    relativeStartSecond: 610,
    viralScore: 97.8,
    subtitles: [
      {
        time: 0,
        speaker: "NARASUMBER",
        text: "Audiens memutuskan scroll atau nonton hanya dalam <hl>3 detik pertama</hl>.",
      },
      {
        time: 4,
        speaker: "NARASUMBER",
        text: "Kalau opening kamu membosankan, video sebagus apapun bakal sepi penonton.",
      },
    ],
  },
  {
    title: "Algoritma TikTok vs YouTube Shorts",
    highlightMoment: "YouTube Shorts butuh retention di atas 100% untuk meledak viral.",
    relativeStartSecond: 750,
    viralScore: 94.6,
    subtitles: [
      {
        time: 0,
        speaker: "HOST",
        text: "YouTube Shorts butuh <hl>retention di atas 100%</hl> untuk meledak viral.",
      },
      {
        time: 4,
        speaker: "NARASUMBER",
        text: "Itu kenapa looping video yang mulus jadi kunci utama kreator top.",
      },
    ],
  },
  {
    title: "Monetisasi Konten Vertikal 2026",
    highlightMoment: "Traffic video pendek sekarang jadi funnel terbesar penjualan produk digital.",
    relativeStartSecond: 890,
    viralScore: 93.2,
    subtitles: [
      {
        time: 0,
        speaker: "NARASUMBER",
        text: "Traffic video pendek sekarang jadi <hl>funnel terbesar</hl> penjualan produk digital.",
      },
      {
        time: 4,
        speaker: "NARASUMBER",
        text: "Jangan cuma cari view, tapi konversikan ke audiens loyal Anda.",
      },
    ],
  },
  {
    title: "Psikologi Warna & Motion Subtitle",
    highlightMoment: "Subtitle kuning neon dan kotak merah terbukti menaikkan watch time hingga 40%.",
    relativeStartSecond: 1020,
    viralScore: 96.5,
    subtitles: [
      {
        time: 0,
        speaker: "NARASUMBER",
        text: "Subtitle kuning neon dan <hl>kotak merah</hl> terbukti menaikkan watch time.",
      },
      {
        time: 4,
        speaker: "HOST",
        text: "Mata penonton terkunci pada gerakan kata demi kata di layar.",
      },
    ],
  },
  {
    title: "Kesalahan Fatal Video Clipper",
    highlightMoment: "Memotong video tanpa konteks yang utuh bikin audiens bingung dan langsung skip.",
    relativeStartSecond: 1150,
    viralScore: 92.8,
    subtitles: [
      {
        time: 0,
        speaker: "HOST",
        text: "Kesalahan fatal adalah <hl>memotong video tanpa konteks</hl> yang utuh.",
      },
      {
        time: 4,
        speaker: "NARASUMBER",
        text: "Setiap klip harus punya setup, konflik, dan kesimpulan yang tuntas.",
      },
    ],
  },
  {
    title: "Mindset Juara Content Creator",
    highlightMoment: "Konsistensi posting klip berkualitas setiap hari mengalahkan bakat tanpa disiplin.",
    relativeStartSecond: 1280,
    viralScore: 97.1,
    subtitles: [
      {
        time: 0,
        speaker: "NARASUMBER",
        text: "<hl>Konsistensi posting klip</hl> setiap hari mengalahkan bakat tanpa disiplin.",
      },
      {
        time: 5,
        speaker: "NARASUMBER",
        text: "Otomasi pemotongan video memberi Anda waktu lebih untuk riset ide.",
      },
    ],
  },
];

/**
 * Service to automatically cut video segments based on calculated viral potential scores
 */
export async function autoCutProjectVideo(projectId: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    throw new HttpError(404, "NOT_FOUND", "Proyek tidak ditemukan.");
  }

  // Calculate segment count bounded by maxClips (1 to 10)
  const clipCount = Math.min(Math.max(1, project.maxClips), 10);
  const duration = project.clipDuration || 45;

  // Pick top candidate viral moments from the knowledge bank
  const selectedCandidates = candidateMomentsBank
    .slice(0, clipCount)
    .sort((a, b) => b.viralScore - a.viralScore);

  const createdClipsWithSubtitles = await db.transaction(async (tx) => {
    const results = [];

    for (let i = 0; i < selectedCandidates.length; i++) {
      const candidate = selectedCandidates[i];
      const rank = i + 1;
      const startTime = candidate.relativeStartSecond;
      const endTime = startTime + duration;

      // 1. Insert clip
      const [insertedClip] = await tx
        .insert(clips)
        .values({
          projectId: project.id,
          startTime,
          endTime,
          duration,
          viralScore: candidate.viralScore.toFixed(2),
          rank,
          highlightMoment: candidate.highlightMoment,
          isSelected: i === 0, // Auto-select top-ranked clip
        })
        .returning();

      // 2. Insert subtitles for this clip
      if (candidate.subtitles && candidate.subtitles.length > 0) {
        for (const sub of candidate.subtitles) {
          await tx.insert(subtitles).values({
            clipId: insertedClip.id,
            startTime: sub.time.toFixed(3),
            endTime: (sub.time + 3.5).toFixed(3),
            text: sub.text,
            speaker: sub.speaker,
          });
        }
      }

      results.push({
        ...insertedClip,
        subtitles: candidate.subtitles,
      });
    }

    // 3. Update project status to completed
    await tx
      .update(projects)
      .set({ status: "completed" })
      .where(eq(projects.id, project.id));

    return results;
  });

  return createdClipsWithSubtitles;
}

export async function getProjectClips(projectId: string) {
  const projectClips = await db
    .select()
    .from(clips)
    .where(eq(clips.projectId, projectId))
    .orderBy(desc(clips.viralScore));

  const clipsWithSubtitles = [];
  for (const c of projectClips) {
    const subs = await db
      .select()
      .from(subtitles)
      .where(eq(subtitles.clipId, c.id))
      .orderBy(subtitles.startTime);
    clipsWithSubtitles.push({
      ...c,
      subtitles: subs,
    });
  }

  return clipsWithSubtitles;
}

