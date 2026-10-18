import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useRef, useEffect } from "react";
import { siteConfig } from "@/config/site";
import { initialClips } from "@/features/studio/mock-data";
import type { ClipItem, ProcessingStatus, YouTubeVideoMetadata } from "@/features/studio/types";
import { StudioControlPanel } from "@/features/studio/components/StudioControlPanel";
import { ClipCard } from "@/features/studio/components/ClipCard";
import { VideoModal } from "@/features/studio/components/VideoModal";
import { ProcessingProgressBar } from "@/features/studio/components/ProcessingProgressBar";
import { EmptyClipsState } from "@/features/studio/components/EmptyClipsState";
import { ErrorClipsState } from "@/features/studio/components/ErrorClipsState";
import {
  fetchYouTubeMetadata,
  validateYouTubeUrl,
  sampleYouTubeVideos,
} from "@/features/studio/utils/youtube";

export const Route = createFileRoute("/_protected/app")({
  head: () => ({ meta: [{ title: `Studio Potong Video | ${siteConfig.name}` }] }),
  component: StudioPotongVideoPage,
});

function StudioPotongVideoPage() {
  const [youtubeUrl, setYoutubeUrl] = useState<string>(
    "https://www.youtube.com/watch?v=V0k9u"
  );

  // Initialize with confirmed metadata for default sample video
  const [videoMetadata, setVideoMetadata] = useState<YouTubeVideoMetadata | null>({
    ...sampleYouTubeVideos.V0k9u,
    url: "https://www.youtube.com/watch?v=V0k9u",
    isConfirmed: true,
  });

  const [isValidatingUrl, setIsValidatingUrl] = useState<boolean>(false);
  const [clippingLimit, setClippingLimit] = useState<number>(10);
  const [userQuota, setUserQuota] = useState<{ total: number; used: number }>({
    total: 50,
    used: 5,
  });
  const [duration, setDuration] = useState<number>(45);
  const [preset, setPreset] = useState<string>("ai-cloned");
  const [autoMotionGraphic, setAutoMotionGraphic] = useState<boolean>(true);
  const [refFileName, setRefFileName] = useState<string>("reference_style.mp4");

  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [processingPercent, setProcessingPercent] = useState<number>(0);

  const [clips, setClips] = useState<ClipItem[]>(initialClips);
  const [selectedClip, setSelectedClip] = useState<ClipItem | null>(null);
  const [activePlayingClipId, setActivePlayingClipId] = useState<string | null>(null);

  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
    };
  }, []);

  const handleTogglePlayInline = (clipId: string) => {
    setActivePlayingClipId((prev) => (prev === clipId ? null : clipId));
  };

  const handleValidateAndConfirm = useCallback(async (url: string) => {
    if (!url.trim()) {
      setErrorMessage("Silakan masukkan link video YouTube terlebih dahulu.");
      setVideoMetadata(null);
      return;
    }

    const validation = validateYouTubeUrl(url);
    if (!validation.isValid) {
      setErrorMessage(
        validation.error ||
          "Link YouTube tidak valid. Gunakan format seperti: https://www.youtube.com/watch?v=... atau https://youtu.be/..."
      );
      setVideoMetadata(null);
      return;
    }

    setErrorMessage(null);
    setIsValidatingUrl(true);

    try {
      const meta = await fetchYouTubeMetadata(url);
      setVideoMetadata(meta);
      setErrorMessage(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memverifikasi video YouTube.";
      setErrorMessage(msg);
      setVideoMetadata(null);
    } finally {
      setIsValidatingUrl(false);
    }
  }, []);

  const handleResetUrl = () => {
    setYoutubeUrl("");
    setVideoMetadata(null);
    setErrorMessage(null);
    setStatus("idle");
  };

  const handleLoadSampleVideo = () => {
    const sampleUrl = "https://www.youtube.com/watch?v=V0k9u";
    setYoutubeUrl(sampleUrl);
    setVideoMetadata({
      ...sampleYouTubeVideos.V0k9u,
      url: sampleUrl,
      isConfirmed: true,
    });
    setErrorMessage(null);
    setStatus("idle");
  };

  const handleCancelProcessing = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setStatus("idle");
    setProcessingPercent(0);
    setStatusMessage("Proses pemotongan video dibatalkan.");
  };

  const handleGenerate = () => {
    if (!youtubeUrl.trim()) {
      setErrorMessage("Silakan masukkan link video YouTube terlebih dahulu.");
      setStatus("error");
      return;
    }

    const validation = validateYouTubeUrl(youtubeUrl);
    if (!validation.isValid) {
      setErrorMessage(
        validation.error ||
          "Link YouTube tidak valid. Mohon periksa kembali link yang Anda masukkan."
      );
      setStatus("error");
      return;
    }

    const remainingQuota = userQuota.total - userQuota.used;
    if (clippingLimit > remainingQuota) {
      setErrorMessage(
        `Jumlah klip yang dipilih (${clippingLimit}) melebihi sisa kuota Anda (${remainingQuota} klip). Silakan kurangi limit klip.`
      );
      setStatus("error");
      return;
    }

    if (!videoMetadata) {
      handleValidateAndConfirm(youtubeUrl);
    }

    const videoTitle = videoMetadata?.title || "Video Sumber YouTube";

    setErrorMessage(null);
    setStatus("downloading");
    setProcessingPercent(15);
    setStatusMessage(`Langkah 1/3: Mengunduh audio & video "${videoTitle}"...`);

    // Stage 1 -> Stage 2
    setTimeout(() => {
      setStatus("analyzing");
      setProcessingPercent(55);
      setStatusMessage(
        `Langkah 2/3: Menganalisis momen puncak viral & sentimen pada "${videoTitle}"...`
      );

      // Stage 2 -> Stage 3
      setTimeout(() => {
        setProcessingPercent(88);
        setStatusMessage(
          `Langkah 3/3: Memotong ${clippingLimit} klip vertikal 9:16 & sinkronisasi subtitle...`
        );

        setTimeout(() => {
          setProcessingPercent(100);
          setStatus("completed");
          setStatusMessage(
            `Selesai! Berhasil memotong ${clippingLimit} klip berpotensi viral (${duration}s) dari "${videoTitle}". Kuota terpakai: ${clippingLimit}.`
          );

          // Deduct user quota
          setUserQuota((prev) => ({
            ...prev,
            used: Math.min(prev.total, prev.used + clippingLimit),
          }));

          // Generate dynamic mock clips based on clipping limit and duration
          const updated = initialClips.map((c, i) => ({
            ...c,
            duration: `${duration}s`,
            viralScore: `${Math.floor(92 + (i === 0 ? 7 : Math.random() * 6))}/100`,
          }));
          setClips(updated);
        }, 1200);
      }, 1400);
    }, 1200);
  };

  const isProcessing = status === "downloading" || status === "analyzing";

  return (
    <div className="w-full text-slate-100">
      {/* Top Breadcrumb & Status */}
      <div className="flex items-center justify-between py-2 px-1 mb-5">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[#6d868c] font-medium">Dashboard</span>
          <span className="text-[#3c565d]">/</span>
          <span className="text-white font-medium tracking-wide">
            Auto Video Clipper
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-full bg-[#136f7c]/50 text-[#2cd3c6] border border-[#2cd3c6]/30 font-medium">
            AI Video Clipper Pro
          </span>
        </div>
      </div>

      {/* Main Control Panel with YouTube Validation & Title Confirmation */}
      <StudioControlPanel
        youtubeUrl={youtubeUrl}
        setYoutubeUrl={(val) => {
          setYoutubeUrl(val);
          if (errorMessage) setErrorMessage(null);
        }}
        videoMetadata={videoMetadata}
        setVideoMetadata={setVideoMetadata}
        isValidatingUrl={isValidatingUrl}
        onValidateAndConfirm={handleValidateAndConfirm}
        clippingLimit={clippingLimit}
        setClippingLimit={setClippingLimit}
        totalQuota={userQuota.total}
        usedQuota={userQuota.used}
        duration={duration}
        setDuration={setDuration}
        preset={preset}
        setPreset={setPreset}
        autoMotionGraphic={autoMotionGraphic}
        setAutoMotionGraphic={setAutoMotionGraphic}
        refFileName={refFileName}
        setRefFileName={setRefFileName}
        status={status}
        statusMessage={statusMessage}
        onGenerate={handleGenerate}
        errorMessage={errorMessage}
      />

      {/* Multi-stage Progress Bar when actively processing */}
      {isProcessing && (
        <ProcessingProgressBar
          status={status}
          progressPercent={processingPercent}
          currentStepMessage={statusMessage}
          clippingLimit={clippingLimit}
          duration={duration}
          onCancel={handleCancelProcessing}
        />
      )}

      {/* Error State Banner */}
      {status === "error" && errorMessage && (
        <ErrorClipsState
          errorMessage={errorMessage}
          onRetry={handleGenerate}
          onReset={handleResetUrl}
        />
      )}

      {/* Empty State when no clips exist */}
      {clips.length === 0 && status !== "error" && !isProcessing && (
        <EmptyClipsState onLoadSample={handleLoadSampleVideo} />
      )}

      {/* Section: All Generated Clips */}
      {clips.length > 0 && (
        <section className="mt-2 flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
              <span>All Generated Clips</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#136f7c]/40 text-[#2cd3c6] border border-[#2cd3c6]/30 font-medium">
                {clips.length} Klip Siap
              </span>
            </h2>
            <span className="text-xs text-[#7d9399]">
              Urutan berdasarkan skor potensi viral tertinggi
            </span>
          </div>

          {/* 4-Columns Grid: Aspect 9:16 locked with rounded corners */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-4.5">
            {clips.map((clip) => (
              <ClipCard
                key={clip.id}
                clip={clip}
                isPlayingInline={activePlayingClipId === clip.id}
                onTogglePlayInline={handleTogglePlayInline}
                onSelectClip={(c) => setSelectedClip(c)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Video Preview Modal */}
      <VideoModal
        clip={selectedClip}
        onClose={() => setSelectedClip(null)}
      />
    </div>
  );
}
