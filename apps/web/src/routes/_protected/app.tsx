import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { siteConfig } from "@/config/site";
import type { ClipItem, ProcessingStatus } from "@/features/studio/types";
import { StudioControlPanel, type DynamicPresetItem } from "@/features/studio/components/StudioControlPanel";
import { ClipCard } from "@/features/studio/components/ClipCard";
import { VideoModal } from "@/features/studio/components/VideoModal";
import { ProcessingProgressBar } from "@/features/studio/components/ProcessingProgressBar";
import { EmptyClipsState } from "@/features/studio/components/EmptyClipsState";
import { Sparkles, Download, Layers } from "lucide-react";

export const Route = createFileRoute("/_protected/app")({
  head: () => ({ meta: [{ title: `Studio Potong Video | ${siteConfig.name}` }] }),
  component: StudioPotongVideoPage,
});

const defaultPresetsList: DynamicPresetItem[] = [
  { id: "viral-motion", name: "Viral Motion" },
  { id: "netflix-cinematic", name: "Netflix Cinematic" },
  { id: "aesthetic-soft-film", name: "Aesthetic Soft Film" },
  { id: "theo-podcast", name: "THEO Podcast Dark" },
];

function StudioPotongVideoPage() {
  // ZERO SAMPLE / CLEAN INITIAL STATE
  const [youtubeUrl, setYoutubeUrl] = useState<string>("");
  const [clippingLimit, setClippingLimit] = useState<number>(5);
  const [duration, setDuration] = useState<number>(45);

  const [presets, setPresets] = useState<DynamicPresetItem[]>(defaultPresetsList);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("viral-motion");
  const [enableMotionGraphic, setEnableMotionGraphic] = useState<boolean>(true);

  const [refFileName, setRefFileName] = useState<string>("");
  const [isCloningStyle, setIsCloningStyle] = useState<boolean>(false);

  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [processingPercent, setProcessingPercent] = useState<number>(0);

  // Clean empty array - NO DUMMY SAMPLES!
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [selectedClip, setSelectedClip] = useState<ClipItem | null>(null);
  const [activePlayingClipId, setActivePlayingClipId] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch dynamic presets from /api/presets
  useEffect(() => {
    fetch("/api/presets")
      .then((res) => res.json())
      .then((res) => {
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          setPresets(res.data);
        }
      })
      .catch(() => {});
  }, []);

  const handleTogglePlayInline = (clipId: string) => {
    setActivePlayingClipId((prev) => (prev === clipId ? null : clipId));
  };

  const handleDownloadNotice = (msg: string) => {
    setNoticeMessage(msg);
    setTimeout(() => setNoticeMessage(null), 3000);
  };

  // Reset / Bersihkan action
  const handleReset = async () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }

    setYoutubeUrl("");
    setClips([]);
    setStatus("idle");
    setStatusMessage("");
    setErrorMessage(null);
    setProcessingPercent(0);
    setRefFileName("");
    setActivePlayingClipId(null);
    setSelectedClip(null);

    try {
      await fetch("/api/reset", { method: "POST" });
    } catch {}

    setNoticeMessage("Tampilan dan antrean berhasil dikosongkan (Empty State Bersih).");
    setTimeout(() => setNoticeMessage(null), 3000);
  };

  // Upload reference video for AI style cloner
  const handleUploadReferenceVideo = async (file: File) => {
    setIsCloningStyle(true);
    setRefFileName(file.name);
    setNoticeMessage("Menganalisis gaya video dengan Gemini Multimodal...");

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        try {
          const res = await fetch("/api/clone-style", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              videoBase64: base64Data,
              presetName: `Cloned (${file.name.slice(0, 12)}) 🪄`,
            }),
          });
          const json = await res.json();
          if (json.success && json.data) {
            setPresets((prev) => [
              { id: json.data.id, name: json.data.name },
              ...prev.filter((p) => p.id !== json.data.id),
            ]);
            setSelectedPresetId(json.data.id);
            setNoticeMessage("Gaya video berhasil dikloning ke preset aktif!");
          }
        } catch {
          setNoticeMessage("Gagal menghubungi server untuk clone style.");
        } finally {
          setIsCloningStyle(false);
          setTimeout(() => setNoticeMessage(null), 3000);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setIsCloningStyle(false);
    }
  };

  // Real One-Click Pipeline Generation
  const handleGenerate = async () => {
    const trimmedUrl = youtubeUrl.trim();
    if (!trimmedUrl) {
      setErrorMessage("Silakan tempel link video YouTube terlebih dahulu.");
      return;
    }

    setErrorMessage(null);
    setStatus("downloading");
    setProcessingPercent(15);
    setStatusMessage("Langkah 1/3: Mengunduh audio YouTube dengan yt-dlp...");

    // Smooth simulated progress stepping while backend executes real pipeline
    let currentPct = 15;
    progressTimerRef.current = setInterval(() => {
      currentPct = Math.min(92, currentPct + 4);
      setProcessingPercent(currentPct);
      if (currentPct === 40) {
        setStatus("analyzing");
        setStatusMessage("Langkah 2/3: Mentranskripsi kata (Groq Whisper) & kurasi viral (Gemini 2.5 Flash)...");
      } else if (currentPct === 70) {
        setStatusMessage("Langkah 3/3: Merender video vertikal 9:16 & membakar subtitle (.ass) dengan FFmpeg...");
      }
    }, 1200);

    try {
      const response = await fetch("/api/pipeline/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          youtubeUrl: trimmedUrl,
          maxClips: clippingLimit,
          clipDuration: duration,
          presetId: selectedPresetId,
          enableMotionGraphic,
        }),
      });

      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }

      const result = await response.json();

      if (!response.ok || !result.success) {
        setStatus("error");
        setErrorMessage(result.message || "Gagal memproses klip video.");
        setProcessingPercent(0);
        return;
      }

      setProcessingPercent(100);
      setStatus("completed");
      setStatusMessage(`Selesai! Berhasil memotong ${result.data?.clips?.length || 0} klip video 9:16.`);

      // Map backend clips to frontend ClipItem shape
      const mappedClips: ClipItem[] = (result.data?.clips || []).map((c: any, index: number) => ({
        id: c.id || `clip-${index + 1}`,
        title: c.title || `Klip Viral #${index + 1}`,
        duration: `${c.duration || duration}s`,
        viralScore: String(c.viralScore || 95),
        rank: c.rank || index + 1,
        highlightMoment: c.hookDescription || c.viralReason || "Hook 3 detik pertama memikat.",
        preset: c.presetName || "Viral Motion",
        imageSrc: result.data.thumbnail || "/images/video_preview.jpg",
        videoUrl: c.videoUrl,
        downloadUrl: c.downloadUrl,
        bottomScoreText: `Skor ${c.viralScore}/100`,
        bottomPresetText: c.presetName || "Viral Motion",
      }));

      setClips(mappedClips);
    } catch (err: any) {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      setStatus("error");
      setErrorMessage(err?.message || "Terjadi kesalahan saat memproses klip.");
      setProcessingPercent(0);
    }
  };

  const isProcessing =
    status === "downloading" ||
    status === "analyzing";

  return (
    <div className="w-full flex flex-col gap-6 animate-fadeIn text-slate-100">
      {/* Toast Notification */}
      {noticeMessage && (
        <div className="fixed top-16 right-6 z-50 px-4 py-2.5 rounded-xl bg-[#0f2a30] border border-[#2cd3c6] text-teal-200 text-xs font-semibold shadow-[0_0_20px_rgba(44,211,198,0.35)] flex items-center gap-2 animate-fadeIn">
          <Sparkles className="w-4 h-4 text-[#2cd3c6] shrink-0" />
          <span>{noticeMessage}</span>
        </div>
      )}

      {/* Main Studio Control Panel */}
      <StudioControlPanel
        youtubeUrl={youtubeUrl}
        setYoutubeUrl={setYoutubeUrl}
        clippingLimit={clippingLimit}
        setClippingLimit={setClippingLimit}
        duration={duration}
        setDuration={setDuration}
        presets={presets}
        selectedPresetId={selectedPresetId}
        setSelectedPresetId={setSelectedPresetId}
        enableMotionGraphic={enableMotionGraphic}
        setEnableMotionGraphic={setEnableMotionGraphic}
        refFileName={refFileName}
        setRefFileName={setRefFileName}
        onUploadReferenceVideo={handleUploadReferenceVideo}
        isCloningStyle={isCloningStyle}
        status={status}
        statusMessage={statusMessage}
        onGenerate={handleGenerate}
        onReset={handleReset}
        errorMessage={errorMessage}
      />

      {/* Processing Progress Bar */}
      {isProcessing && (
        <ProcessingProgressBar
          status={status}
          progressPercent={processingPercent}
          currentStepMessage={statusMessage}
          clippingLimit={clippingLimit}
          duration={duration}
          onCancel={handleReset}
        />
      )}

      {/* Section Header: All Generated Clips */}
      <div className="flex items-center justify-between border-b border-[#1b343b] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#13434c] to-[#1e616d] flex items-center justify-center border border-[#2cd3c6]/40 text-[#2cd3c6]">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
              All Generated Clips
            </h2>
            <p className="text-xs text-[#7e9ca2]">
              {clips.length > 0
                ? `${clips.length} klip vertikal 9:16 siap diunduh`
                : "Hasil klip video vertikal berpotensi viral"}
            </p>
          </div>
        </div>

        {clips.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 rounded-xl border border-[#23454d] bg-[#14282e] hover:bg-[#1a343b] text-xs text-[#8da5ab] hover:text-white transition"
            >
              Bersihkan Tampilan
            </button>
          </div>
        )}
      </div>

      {/* Grid Hasil Klip: EMPTY STATE or REAL CLIPS */}
      {clips.length === 0 && !isProcessing ? (
        <EmptyClipsState />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {clips.map((clip) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              isPlayingInline={activePlayingClipId === clip.id}
              onTogglePlayInline={handleTogglePlayInline}
              onSelectClip={setSelectedClip}
              onDownloadNotice={handleDownloadNotice}
            />
          ))}
        </div>
      )}

      {/* Video Modal Preview */}
      {selectedClip && (
        <VideoModal
          clip={selectedClip}
          onClose={() => setSelectedClip(null)}
          onDownloadNotice={handleDownloadNotice}
        />
      )}
    </div>
  );
}
