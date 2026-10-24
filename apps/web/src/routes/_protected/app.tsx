import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { siteConfig } from "@/config/site";
import type { ClipItem, ProcessingStatus } from "@/features/studio/types";
import {
  StudioControlPanel,
  type DynamicPresetItem,
  type PipelineMode,
} from "@/features/studio/components/StudioControlPanel";
import { ClipCard } from "@/features/studio/components/ClipCard";
import { VideoModal } from "@/features/studio/components/VideoModal";
import { ProcessingProgressBar } from "@/features/studio/components/ProcessingProgressBar";
import { EmptyClipsState } from "@/features/studio/components/EmptyClipsState";
import { Sparkles, Download, Layers, BookmarkPlus, X, Loader2, Trash2 } from "lucide-react";
import { API_URL } from "@/lib/env";

export const Route = createFileRoute("/_protected/app")({
  head: () => ({ meta: [{ title: `Studio Potong Video | ${siteConfig.name}` }] }),
  component: StudioPotongVideoPage,
});

const defaultPresetsList: DynamicPresetItem[] = [
  {
    id: "renx-viral-clipper",
    name: "Renx Viral Clipper (1-Word Pop + Glow Hook)",
    badge: "Viral Clipper",
    layoutArchitecture: "IN_SCENE_KINETIC_CLIPPER",
    subtitleBehavior: "SINGLE_WORD_POP",
    hookTypographyStyle: "GLOWING_STACKED_IMPACT",
    styleVariant: 0,
    accentColor: "#FF6B00",
    enableTopMotion: false,
  },
  { id: "viral-motion", name: "Viral Motion" },
  { id: "netflix-cinematic", name: "Netflix Cinematic" },
  { id: "aesthetic-soft-film", name: "Aesthetic Soft Film" },
  { id: "theo-podcast", name: "THEO Podcast Dark" },
];

const CLIPS_SESSION_STORAGE_KEY = "dior_studio_generated_clips_session";
const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000; // 24 Jam auto-delete

interface StoredClipsSession {
  clips: ClipItem[];
  status: ProcessingStatus;
  statusMessage: string;
  savedAt: number;
}

function StudioPotongVideoPage() {
  // ZERO SAMPLE / CLEAN INITIAL STATE
  const [inputMode, setInputMode] = useState<"youtube" | "upload">("youtube");
  const [youtubeUrl, setYoutubeUrl] = useState<string>("");
  const [uploadedVideoFile, setUploadedVideoFile] = useState<File | null>(null);

  // Kolom 1: Output Target
  const [clipCount, setClipCount] = useState<number>(5);
  const [targetDuration, setTargetDuration] = useState<number>(45);

  // Kolom 2: Editing Pipeline
  const [pipelineMode, setPipelineMode] = useState<PipelineMode>("netflix_editorial");

  // Kolom 3: Style & Typography
  const [presets, setPresets] = useState<DynamicPresetItem[]>(defaultPresetsList);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("viral-motion");
  const [subtitleFont, setSubtitleFont] = useState<string>("Montserrat ExtraBold");

  // Kolom 4: Reference & Polish
  const [refFileName, setRefFileName] = useState<string>("");
  const [isCloningStyle, setIsCloningStyle] = useState<boolean>(false);
  const [tempCloneBlueprint, setTempCloneBlueprint] = useState<any | null>(null);
  const [enableHook, setEnableHook] = useState<boolean>(true);
  const [enablePolish, setEnablePolish] = useState<boolean>(true);
  const [enableCloneTopMotion, setEnableCloneTopMotion] = useState<boolean>(false);
  const [enableCloneBottomMotion, setEnableCloneBottomMotion] = useState<boolean>(false);

  // Fase 1: Custom Background Music (BGM) & Auto-Ducking
  const [uploadedBgmFile, setUploadedBgmFile] = useState<File | null>(null);
  const [enableBgmDucking, setEnableBgmDucking] = useState<boolean>(true);
  const [bgmBaseVolume, setBgmBaseVolume] = useState<number>(0.15);

  // Processing telemetry
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [processingPercent, setProcessingPercent] = useState<number>(0);
  const [processingStep, setProcessingStep] = useState<1 | 2 | 3>(1);
  const [currentClipIndex, setCurrentClipIndex] = useState<number | undefined>(undefined);
  const [totalClipsCount, setTotalClipsCount] = useState<number | undefined>(undefined);

  // Clean empty array - NO DUMMY SAMPLES!
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [selectedClip, setSelectedClip] = useState<ClipItem | null>(null);
  const [activePlayingClipId, setActivePlayingClipId] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [restylingClipId, setRestylingClipId] = useState<string | null>(null);

  // Modal Simpan Gaya Klip ke Preset State
  const [clipToSaveAsPreset, setClipToSaveAsPreset] = useState<ClipItem | null>(null);
  const [customPresetName, setCustomPresetName] = useState<string>("");
  const [isSavingPresetModal, setIsSavingPresetModal] = useState<boolean>(false);

  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeJobIdRef = useRef<string | null>(null);

  const fetchPresets = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/presets`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        setPresets(json.data);
      }
    } catch {}
  }, []);

  const persistClipsSession = (updatedClips: ClipItem[], customMessage?: string) => {
    if (updatedClips.length === 0) {
      localStorage.removeItem(CLIPS_SESSION_STORAGE_KEY);
      return;
    }
    try {
      const session: StoredClipsSession = {
        clips: updatedClips,
        status: "completed",
        statusMessage: customMessage || `Selesai! Berhasil memotong ${updatedClips.length} klip video 9:16.`,
        savedAt: Date.now(),
      };
      localStorage.setItem(CLIPS_SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {}
  };

  // Fetch dynamic presets from /api/presets, restore saved clips (<24h), & check sessionStorage
  useEffect(() => {
    fetchPresets();

    // 1. Restore previous generated clips session (<24 hours)
    try {
      const rawSession = localStorage.getItem(CLIPS_SESSION_STORAGE_KEY);
      if (rawSession) {
        const parsed: StoredClipsSession = JSON.parse(rawSession);
        const ageMs = Date.now() - (parsed.savedAt || 0);
        if (ageMs > MAX_SESSION_AGE_MS) {
          // More than 24h -> purge both locally and on server
          localStorage.removeItem(CLIPS_SESSION_STORAGE_KEY);
          fetch(`${API_URL}/api/clips/all`, { method: "DELETE" }).catch(() => {});
        } else if (Array.isArray(parsed.clips) && parsed.clips.length > 0) {
          setClips(parsed.clips);
          setStatus("completed");
          setStatusMessage(parsed.statusMessage || `Memuat ${parsed.clips.length} klip video 9:16 tersimpan.`);
        }
      }
    } catch {}

    // Periodic check to auto-delete clips if page is left open for >24h
    const cleanupInterval = setInterval(() => {
      try {
        const raw = localStorage.getItem(CLIPS_SESSION_STORAGE_KEY);
        if (raw) {
          const parsed: StoredClipsSession = JSON.parse(raw);
          if (Date.now() - (parsed.savedAt || 0) > MAX_SESSION_AGE_MS) {
            localStorage.removeItem(CLIPS_SESSION_STORAGE_KEY);
            setClips([]);
            setStatus("idle");
            setStatusMessage("");
            fetch(`${API_URL}/api/clips/all`, { method: "DELETE" }).catch(() => {});
            setNoticeMessage("Klip video otomatis dibersihkan karena telah melewati batas simpan 24 jam.");
            setTimeout(() => setNoticeMessage(null), 4000);
          }
        }
      } catch {}
    }, 5 * 60 * 1000);

    // 2. Reconnect to background render job if user switched tabs or refreshed
    try {
      const activeJobRaw = localStorage.getItem("dior_active_render_job");
      if (activeJobRaw) {
        const activeJob = JSON.parse(activeJobRaw);
        const elapsed = Date.now() - (activeJob.startTime || 0);
        // Valid for up to 20 minutes
        if (activeJob.jobId && elapsed < 20 * 60 * 1000) {
          activeJobIdRef.current = activeJob.jobId;
          setStatus("analyzing");
          setStatusMessage("Menyambung kembali ke proses pemotongan video yang sedang berjalan...");
          if (activeJob.clipCount) setTotalClipsCount(activeJob.clipCount);

          if (progressTimerRef.current) clearInterval(progressTimerRef.current);
          progressTimerRef.current = setInterval(async () => {
            try {
              const res = await fetch(`${API_URL}/api/process-video/progress?jobId=${activeJob.jobId}`);
              if (res.ok) {
                const json = await res.json();
                if (json.success && json.data) {
                  const p = json.data;
                  if (typeof p.percent === "number") setProcessingPercent(p.percent);
                  if (p.step) setProcessingStep(p.step as 1 | 2 | 3);
                  if (p.message) setStatusMessage(p.message);
                  if (typeof p.currentClipIndex === "number") setCurrentClipIndex(p.currentClipIndex);
                  if (typeof p.totalClips === "number") setTotalClipsCount(p.totalClips);

                  if (p.status === "completed") {
                    if (progressTimerRef.current) {
                      clearInterval(progressTimerRef.current);
                      progressTimerRef.current = null;
                    }
                    activeJobIdRef.current = null;
                    localStorage.removeItem("dior_active_render_job");

                    const incomingClips = p.result?.clips || [];
                    if (Array.isArray(incomingClips) && incomingClips.length > 0) {
                      const targetDur = activeJob.targetDuration || 45;
                      const presetLabel = activeJob.selectedPresetId || "Viral Motion";
                      const mappedIncoming: ClipItem[] = incomingClips.map((c: any, index: number) => ({
                        id: c.id || `clip-${Date.now()}-${index + 1}`,
                        title: c.title || `Klip Viral #${index + 1}`,
                        duration: `${c.duration || targetDur}s`,
                        viralScore: String(c.viralScore || 95),
                        rank: c.rank || index + 1,
                        highlightMoment: c.hookDescription || c.viralReason || "Hook 3 detik pertama memikat.",
                        preset: c.presetName || presetLabel,
                        presetId: c.presetId || activeJob.selectedPresetId,
                        imageSrc: p.result?.thumbnail || "/images/video_preview.jpg",
                        videoUrl: c.videoUrl,
                        downloadUrl: c.downloadUrl,
                        bottomScoreText: `Skor ${c.viralScore}/100`,
                        bottomPresetText: c.presetName || presetLabel,
                      }));

                      // APPEND to previous clips (newest on top, deduplicated by id)
                      setClips((prevClips) => {
                        const existingIds = new Set(mappedIncoming.map((m) => m.id));
                        const combined = [...mappedIncoming, ...prevClips.filter((pc) => !existingIds.has(pc.id))];
                        persistClipsSession(combined);
                        return combined;
                      });
                    } else {
                      // Fallback: Read updated clips from session
                      try {
                        const updatedSession = localStorage.getItem(CLIPS_SESSION_STORAGE_KEY);
                        if (updatedSession) {
                          const parsedSession = JSON.parse(updatedSession);
                          if (Array.isArray(parsedSession.clips)) {
                            setClips(parsedSession.clips);
                          }
                        }
                      } catch {}
                    }

                    setProcessingPercent(100);
                    setProcessingStep(3);
                    setStatus("completed");
                    setStatusMessage(p.message || "Proses pemotongan video selesai!");
                  } else if (p.status === "error") {
                    if (progressTimerRef.current) {
                      clearInterval(progressTimerRef.current);
                      progressTimerRef.current = null;
                    }
                    activeJobIdRef.current = null;
                    localStorage.removeItem("dior_active_render_job");
                    setStatus("error");
                    setErrorMessage(p.error || "Gagal memproses klip.");
                  }
                }
              }
            } catch {}
          }, 1000);
        } else {
          localStorage.removeItem("dior_active_render_job");
        }
      }
    } catch {}

    // Check if active temporary clone exists
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/clone-style/active`);
        const json = await res.json();
        if (json.success && json.data) {
          setTempCloneBlueprint(json.data);
          setPipelineMode("clone_only");
        }
      } catch {}
    })();

    // Auto-fill preset if redirected from Presets Management page
    const appliedPresetRaw = sessionStorage.getItem("dior_applied_preset");
    if (appliedPresetRaw) {
      try {
        const p = JSON.parse(appliedPresetRaw);
        if (p?.id) {
          setSelectedPresetId(p.id);
          if (p.subtitleStyle?.fontName) {
            setSubtitleFont(p.subtitleStyle.fontName);
          }
          if (p.pipelineMode) {
            setPipelineMode(p.pipelineMode);
          }
          if (typeof p.enableHook === "boolean") {
            setEnableHook(p.enableHook);
          }
          if (typeof p.enablePolish === "boolean") {
            setEnablePolish(p.enablePolish);
          }
          setNoticeMessage(`Preset "${p.name}" berhasil diterapkan ke Dashboard!`);
          setTimeout(() => setNoticeMessage(null), 3500);
        }
      } catch {}
      sessionStorage.removeItem("dior_applied_preset");
      sessionStorage.removeItem("dior_selected_preset_id");
    } else {
      const savedPreset = sessionStorage.getItem("dior_selected_preset_id");
      if (savedPreset) {
        setSelectedPresetId(savedPreset);
        sessionStorage.removeItem("dior_selected_preset_id");
      }
    }

    return () => {
      clearInterval(cleanupInterval);
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    };
  }, []);

  const handleTogglePlayInline = (clipId: string) => {
    setActivePlayingClipId((prev) => (prev === clipId ? null : clipId));
  };

  const handleSelectClip = (clip: ClipItem) => {
    setActivePlayingClipId(null);
    document.querySelectorAll("video").forEach((vid) => {
      try {
        vid.pause();
      } catch {}
    });
    setSelectedClip(clip);
  };

  const handleDownloadNotice = (msg: string) => {
    setNoticeMessage(msg);
    setTimeout(() => setNoticeMessage(null), 3000);
  };

  // Reset form action
  const handleReset = async () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    activeJobIdRef.current = null;
    localStorage.removeItem("dior_active_render_job");

    setYoutubeUrl("");
    setUploadedVideoFile(null);
    setInputMode("youtube");
    setClipCount(5);
    setTargetDuration(45);
    setPipelineMode("netflix_editorial");
    setSelectedPresetId("viral-motion");
    setSubtitleFont("Montserrat ExtraBold");
    setEnableHook(true);
    setEnablePolish(true);
    setEnableCloneTopMotion(false);
    setEnableCloneBottomMotion(false);
    setUploadedBgmFile(null);
    setEnableBgmDucking(true);
    setBgmBaseVolume(0.15);
    setClips([]);
    setStatus("idle");
    setStatusMessage("");
    setErrorMessage(null);
    setProcessingPercent(0);
    setProcessingStep(1);
    setCurrentClipIndex(undefined);
    setTotalClipsCount(undefined);
    setRefFileName("");
    setActivePlayingClipId(null);
    setSelectedClip(null);
    localStorage.removeItem(CLIPS_SESSION_STORAGE_KEY);

    try {
      await fetch(`${API_URL}/api/reset`, { method: "POST" });
    } catch {}

    setNoticeMessage("Tampilan dan antrean berhasil dikosongkan (Empty State Bersih).");
    setTimeout(() => setNoticeMessage(null), 3000);
  };

  // Delete all generated clips permanently from server & local state
  const handleDeleteAllClips = async () => {
    if (clips.length === 0) return;
    const confirmed = window.confirm(
      "Apakah Anda yakin ingin menghapus semua hasil klip video ini secara permanen dari server?"
    );
    if (!confirmed) return;

    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    activeJobIdRef.current = null;
    localStorage.removeItem("dior_active_render_job");

    setClips([]);
    setStatus("idle");
    setStatusMessage("");
    setSelectedClip(null);
    setActivePlayingClipId(null);
    setProcessingStep(1);
    setCurrentClipIndex(undefined);
    setTotalClipsCount(undefined);
    localStorage.removeItem(CLIPS_SESSION_STORAGE_KEY);

    try {
      await fetch(`${API_URL}/api/clips/all`, { method: "DELETE" });
      setNoticeMessage("Semua klip video dan file render berhasil dihapus permanen.");
    } catch {
      setNoticeMessage("Semua klip telah dibersihkan dari dashboard.");
    } finally {
      setTimeout(() => setNoticeMessage(null), 3500);
    }
  };

  // Upload reference video for AI style cloner (Temp Session, No Auto-Save to Presets)
  const handleUploadReferenceVideo = async (file: File) => {
    setIsCloningStyle(true);
    setRefFileName(file.name);
    setNoticeMessage("Menganalisis gaya video dengan Universal Gemini Style Cloner...");

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        try {
          const res = await fetch(`${API_URL}/api/clone-style`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              videoBase64: base64Data,
              presetName: `Cloned (${file.name.slice(0, 15)})`,
            }),
          });
          const json = await res.json();
          if (json.success && json.data) {
            setTempCloneBlueprint(json.data);
            setPipelineMode("clone_only");
            setNoticeMessage("Mode Clone Aktif: Siap Diterapkan ke Video!");
          } else {
            setNoticeMessage(json.message || "Gagal menganalisis gaya video.");
          }
        } catch {
          setNoticeMessage("Gagal menghubungi server untuk clone style.");
        } finally {
          setIsCloningStyle(false);
          setTimeout(() => setNoticeMessage(null), 3500);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setIsCloningStyle(false);
    }
  };

  // Cancel active temporary clone session
  const handleCancelClone = async () => {
    try {
      await fetch(`${API_URL}/api/clone-style/active`, { method: "DELETE" });
    } catch {}
    setTempCloneBlueprint(null);
    setRefFileName("");
    setPipelineMode("netflix_editorial");
    setNoticeMessage("Mode Clone dinonaktifkan. Kembali ke mode Reguler.");
    setTimeout(() => setNoticeMessage(null), 3000);
  };

  const handleOpenSavePresetModal = (clip: ClipItem) => {
    setClipToSaveAsPreset(clip);
    const cleanClipTitle = clip.title.replace(/[^a-zA-Z0-9\s]/g, "").slice(0, 24).trim();
    setCustomPresetName(`Gaya ${cleanClipTitle || "Klip Viral"}`);
  };

  const handleSaveClipAsPreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPresetName.trim() || !clipToSaveAsPreset) return;

    setIsSavingPresetModal(true);
    try {
      let res: Response;
      if (tempCloneBlueprint) {
        res = await fetch(`${API_URL}/api/presets/save-from-blueprint`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            presetName: customPresetName.trim(),
            blueprint: tempCloneBlueprint,
          }),
        });
      } else {
        const timestamp = Date.now();
        const safeId = `custom-clip-${timestamp}`;
        const payload = {
          id: safeId,
          name: customPresetName.trim(),
          description: `Preset hasil ekspor gaya dari klip "${clipToSaveAsPreset.title}"`,
          format: "9:16",
          width: 1080,
          height: 1920,
          pipelineMode,
          colorGrading: "eq=contrast=1.12:brightness=-0.03:saturation=0.88",
          transition: "fade",
          subtitleStyle: {
            fontName: subtitleFont,
            fontSize: 26,
            primaryColor: "&H00FFFFFF",
            highlightColor: "#E50914",
            outlineColor: "&H00000000",
            outlineWidth: 3,
            alignment: 2,
            marginV: 370,
            bold: true,
            animation: "bounce-popup",
            bounceScale: 1.15,
            showSpeakerTag: false,
          },
          motionGraphic: {
            progressBar: false,
            punchZoom: true,
            punchZoomScale: 1.15,
          },
          accentColor: "#E50914",
          enableHook,
          enableTopMotion: true,
          enablePolish,
          badge: "Auto-Cut",
          isCustom: true,
        };

        res = await fetch(`${API_URL}/api/presets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();
      if (json.success && json.data) {
        setPresets((prev) => [json.data, ...prev.filter((p) => p.id !== json.data.id)]);
        setSelectedPresetId(json.data.id);
        setNoticeMessage(`Preset "${json.data.name}" berhasil disimpan ke server!`);
        setTimeout(() => setNoticeMessage(null), 3500);
        setClipToSaveAsPreset(null);
      } else {
        alert(json.message || "Gagal menyimpan preset.");
      }
    } catch (err: any) {
      alert(err?.message || "Terjadi kesalahan saat menyimpan preset.");
    } finally {
      setIsSavingPresetModal(false);
    }
  };

  // Re-Style individual clip on the fly
  const handleReStyle = async (clipId: string, targetPresetId: string) => {
    setRestylingClipId(clipId);
    const targetPreset = presets.find((p) => p.id === targetPresetId);
    const presetLabel = targetPreset?.name || targetPresetId;
    setNoticeMessage(`Menerapkan gaya "${presetLabel}" pada klip...`);

    try {
      const res = await fetch(`${API_URL}/api/pipeline/re-style`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clipId,
          presetId: targetPresetId,
          enableMotionGraphic: pipelineMode === "netflix_editorial" || pipelineMode === "clone_only",
          fontFamily: subtitleFont,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal mengubah gaya klip.");
      }

      const updated = data.data;
      const cacheBuster = `?t=${Date.now()}`;
      const newVideoUrl = updated.videoUrl ? `${updated.videoUrl}${cacheBuster}` : undefined;
      const newDownloadUrl = updated.downloadUrl ? `${updated.downloadUrl}${cacheBuster}` : undefined;

      setClips((prevClips) => {
        const next = prevClips.map((c) => {
          if (c.id === clipId) {
            return {
              ...c,
              preset: updated.presetName || presetLabel,
              presetId: targetPresetId,
              bottomPresetText: updated.presetName || presetLabel,
              videoUrl: newVideoUrl || c.videoUrl,
              videoSrc: newVideoUrl || c.videoSrc,
              downloadUrl: newDownloadUrl || c.downloadUrl,
            };
          }
          return c;
        });
        persistClipsSession(next);
        return next;
      });

      setNoticeMessage(`Gaya klip berhasil diubah ke "${updated.presetName || presetLabel}"!`);
    } catch (err: any) {
      setNoticeMessage(`Gagal mengubah gaya: ${err.message}`);
    } finally {
      setRestylingClipId(null);
      setTimeout(() => setNoticeMessage(null), 3500);
    }
  };

  // Helper to sanitize error messages: eliminate raw HTML and show user-friendly message for Cloudflare 524/timeouts/Google errors
  const sanitizeErrorMessage = (raw: string | undefined | null): string => {
    if (!raw) return "Terjadi kesalahan saat memproses klip.";

    const lower = raw.toLowerCase();
    if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
      return "Koneksi upload ke server terputus karena proses file video besar membutuhkan waktu. Silakan klik Auto-Cut kembali, pipeline kini sudah dioptimalkan jauh lebih cepat.";
    }

    if (
      raw.includes("GoogleGenerativeAI") ||
      raw.includes("generativelanguage.googleapis.com") ||
      raw.includes("GoogleAIFileManager") ||
      raw.includes("GOOGLE_FILE") ||
      raw.includes("GEMINI_API_KEY")
    ) {
      return "Gagal memproses audio, periksa koneksi atau API Key";
    }

    if (
      raw.includes("524") ||
      raw.includes("Cloudflare") ||
      raw.includes("A timeout occurred") ||
      raw.includes("TRANSCRIPTION_BUSY") ||
      raw.includes("GROQ_TIMEOUT")
    ) {
      return "Server transkripsi sibuk atau file audio terlalu panjang, silakan coba beberapa saat lagi.";
    }

    let clean = raw.replace(/<[^>]*>?/gm, " ").replace(/\s+/g, " ").trim();

    if (
      clean.includes("524") ||
      clean.includes("Cloudflare") ||
      clean.includes("A timeout occurred") ||
      clean.toLowerCase().includes("cloudflare")
    ) {
      return "Server transkripsi sibuk atau file audio terlalu panjang, silakan coba beberapa saat lagi.";
    }

    if (
      clean.includes("GoogleGenerativeAI") ||
      clean.includes("fetch failed") ||
      clean.includes("generativelanguage") ||
      clean.includes("GoogleAIFileManager")
    ) {
      return "Gagal memproses audio, periksa koneksi atau API Key";
    }

    return clean.length > 250 ? `${clean.slice(0, 250)}...` : clean;
  };

  // Real One-Click Pipeline Generation (Dual Input: YouTube URL or Video File Upload)
  const handleGenerate = async () => {
    if (inputMode === "youtube") {
      const trimmedUrl = youtubeUrl.trim();
      if (!trimmedUrl) {
        setErrorMessage("Silakan tempel link video YouTube terlebih dahulu.");
        return;
      }
    } else {
      if (!uploadedVideoFile) {
        setErrorMessage("Silakan pilih atau seret file video (MP4/MOV) terlebih dahulu.");
        return;
      }
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    activeJobIdRef.current = jobId;

    setErrorMessage(null);
    setStatus("downloading");
    setProcessingStep(1);
    setProcessingPercent(10);
    setCurrentClipIndex(undefined);
    setTotalClipsCount(clipCount);
    setStatusMessage(
      inputMode === "upload"
        ? "Langkah 1/3: Mengunggah file video & mengekstrak audio lokal..."
        : "Langkah 1/3: Mengunduh audio YouTube dengan yt-dlp..."
    );

    try {
      localStorage.setItem(
        "dior_active_render_job",
        JSON.stringify({
          jobId,
          inputMode,
          clipCount,
          targetDuration,
          pipelineMode,
          selectedPresetId,
          startTime: Date.now(),
        })
      );
    } catch {}

    // Real-time backend progress polling
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
    }
    progressTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/process-video/progress?jobId=${jobId}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            const p = json.data;
            if (typeof p.percent === "number") setProcessingPercent(p.percent);
            if (p.step) setProcessingStep(p.step as 1 | 2 | 3);
            if (p.message) setStatusMessage(p.message);
            if (typeof p.currentClipIndex === "number") setCurrentClipIndex(p.currentClipIndex);
            if (typeof p.totalClips === "number") setTotalClipsCount(p.totalClips);
            if (p.step === 1) setStatus("downloading");
            else if (p.step === 2 || p.step === 3) setStatus("analyzing");
          }
        }
      } catch {}
    }, 1000);

    try {
      let response: Response;

      // Upload file musik latar kustom (BGM) jika ada
      let uploadedBgmPathToUse: string | undefined = undefined;
      if (uploadedBgmFile) {
        setStatusMessage("Mengunggah musik latar kustom (BGM)...");
        const bgmFormData = new FormData();
        bgmFormData.append("bgm", uploadedBgmFile);
        try {
          const bgmRes = await fetch(`${API_URL}/api/process-video/upload-bgm`, {
            method: "POST",
            body: bgmFormData,
          });
          if (bgmRes.ok) {
            const bgmData = await bgmRes.json().catch(() => ({}));
            if (bgmData.success && bgmData.bgmAudioPath) {
              uploadedBgmPathToUse = bgmData.bgmAudioPath;
            }
          }
        } catch (bgmErr) {
          console.warn("[BGM] Gagal upload BGM terpisah, fallback otomatis:", bgmErr);
        }
      }

      if (inputMode === "upload" && uploadedVideoFile) {
        let uploadIdToUse: string | null = null;

        // Jika ukuran file > 20MB, potong menjadi pecahan 20MB per request
        // untuk melewati batasan Nginx Codespaces 100MB (Bebas Error 413)
        if (uploadedVideoFile.size > 20 * 1024 * 1024) {
          const CHUNK_SIZE = 20 * 1024 * 1024; // 20 MB
          const totalChunks = Math.ceil(uploadedVideoFile.size / CHUNK_SIZE);
          const uploadId = `upl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

          for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, uploadedVideoFile.size);
            const chunkBlob = uploadedVideoFile.slice(start, end);

            const chunkFormData = new FormData();
            chunkFormData.append("uploadId", uploadId);
            chunkFormData.append("chunkIndex", String(i));
            chunkFormData.append("totalChunks", String(totalChunks));
            chunkFormData.append("originalFileName", uploadedVideoFile.name);
            chunkFormData.append("chunk", chunkBlob, uploadedVideoFile.name);

            const pct = Math.round(((i + 1) / totalChunks) * 100);
            setStatusMessage(`Mengunggah video ke cloud (${pct}% - Bagian ${i + 1}/${totalChunks})...`);

            const chunkRes = await fetch(`${API_URL}/api/process-video/upload-chunk`, {
              method: "POST",
              body: chunkFormData,
            });

            if (!chunkRes.ok) {
              const errData = await chunkRes.json().catch(() => ({}));
              throw new Error(errData.message || `Gagal mengunggah potongan video ke-${i + 1} (Status ${chunkRes.status})`);
            }
          }

          uploadIdToUse = uploadId;
        }

        if (uploadIdToUse) {
          // File video besar sudah selesai diunggah via chunk, kirim perintah potong via JSON
          setStatusMessage("File video lengkap terunggah! Memulai pipeline clipping...");
          response = await fetch(`${API_URL}/api/process-video`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jobId,
              uploadId: uploadIdToUse,
              originalFileName: uploadedVideoFile.name,
              bgmAudioPath: uploadedBgmPathToUse,
              enableBgmDucking,
              bgmBaseVolume,
              duckingDepthDb: -20,
              clipCount,
              maxClips: clipCount,
              targetDuration,
              clipDuration: targetDuration,
              pipelineMode,
              presetId: selectedPresetId,
              subtitleFont,
              fontFamily: subtitleFont,
              enableHook,
              enableCinematicHook: enableHook,
              enablePolish,
              colorPolish: enablePolish,
              enableCloneTopMotion,
              enableCloneBottomMotion,
              useTempCloneBlueprint: Boolean(tempCloneBlueprint) || pipelineMode === "clone_only",
              tempCloneBlueprint: tempCloneBlueprint || undefined,
            }),
          });
        } else {
          // File video kecil (<= 20MB) dikirim langsung via FormData
          const formData = new FormData();
          formData.append("jobId", jobId);
          formData.append("video", uploadedVideoFile);
          if (uploadedBgmPathToUse) {
            formData.append("bgmAudioPath", uploadedBgmPathToUse);
          } else if (uploadedBgmFile) {
            formData.append("bgmAudio", uploadedBgmFile);
          }
          formData.append("enableBgmDucking", String(enableBgmDucking));
          formData.append("bgmBaseVolume", String(bgmBaseVolume));
          formData.append("duckingDepthDb", "-20");
          formData.append("clipCount", String(clipCount));
          formData.append("maxClips", String(clipCount));
          formData.append("targetDuration", String(targetDuration));
          formData.append("clipDuration", String(targetDuration));
          formData.append("pipelineMode", pipelineMode);
          formData.append("presetId", selectedPresetId);
          formData.append("subtitleFont", subtitleFont);
          formData.append("fontFamily", subtitleFont);
          formData.append("enableHook", String(enableHook));
          formData.append("enableCinematicHook", String(enableHook));
          formData.append("enablePolish", String(enablePolish));
          formData.append("colorPolish", String(enablePolish));
          formData.append("enableCloneTopMotion", String(enableCloneTopMotion));
          formData.append("enableCloneBottomMotion", String(enableCloneBottomMotion));
          if (tempCloneBlueprint) {
            formData.append("useTempCloneBlueprint", "true");
            formData.append("tempCloneBlueprint", JSON.stringify(tempCloneBlueprint));
          }

          response = await fetch(`${API_URL}/api/process-video`, {
            method: "POST",
            body: formData,
          });
        }
      } else {
        response = await fetch(`${API_URL}/api/process-video`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId,
            youtubeUrl: youtubeUrl.trim(),
            bgmAudioPath: uploadedBgmPathToUse,
            enableBgmDucking,
            bgmBaseVolume,
            duckingDepthDb: -20,
            clipCount,
            maxClips: clipCount,
            targetDuration,
            clipDuration: targetDuration,
            pipelineMode,
            presetId: selectedPresetId,
            subtitleFont,
            fontFamily: subtitleFont,
            enableHook,
            enableCinematicHook: enableHook,
            enablePolish,
            colorPolish: enablePolish,
            enableCloneTopMotion,
            enableCloneBottomMotion,
            useTempCloneBlueprint: Boolean(tempCloneBlueprint) || pipelineMode === "clone_only",
            tempCloneBlueprint: tempCloneBlueprint || undefined,
          }),
        });
      }

      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      activeJobIdRef.current = null;
      localStorage.removeItem("dior_active_render_job");

      let result: any = null;
      try {
        result = await response.json();
      } catch {
        const text = await response.text().catch(() => "");
        if (
          response.status === 524 ||
          response.status === 504 ||
          text.includes("524") ||
          text.includes("Cloudflare") ||
          text.includes("<!DOCTYPE") ||
          text.includes("<html")
        ) {
          throw new Error("Server transkripsi sibuk atau file audio terlalu panjang, silakan coba beberapa saat lagi.");
        }
        throw new Error(
          response.status === 404
            ? "Layanan API tidak ditemukan pada port 4000."
            : `Gagal membaca respons server (Status ${response.status})`
        );
      }

      if (!response.ok || !result.success) {
        setStatus("error");
        setErrorMessage(sanitizeErrorMessage(result.message || "Gagal memproses klip video."));
        setProcessingPercent(0);
        return;
      }

      setProcessingPercent(100);
      setProcessingStep(3);
      setStatus("completed");
      setStatusMessage(`Selesai! Berhasil memotong ${result.data?.clips?.length || 0} klip video 9:16.`);

      // Map backend clips to frontend ClipItem shape
      const mappedClips: ClipItem[] = (result.data?.clips || []).map((c: any, index: number) => ({
        id: c.id || `clip-${index + 1}`,
        title: c.title || `Klip Viral #${index + 1}`,
        duration: `${c.duration || targetDuration}s`,
        viralScore: String(c.viralScore || 95),
        rank: c.rank || index + 1,
        highlightMoment: c.hookDescription || c.viralReason || "Hook 3 detik pertama memikat.",
        preset: c.presetName || "Viral Motion",
        presetId: c.presetId || selectedPresetId,
        imageSrc: result.data.thumbnail || "/images/video_preview.jpg",
        videoUrl: c.videoUrl,
        downloadUrl: c.downloadUrl,
        bottomScoreText: `Skor ${c.viralScore}/100`,
        bottomPresetText: c.presetName || "Viral Motion",
      }));

      // APPEND newly generated clips to existing clips (newest on top, deduplicated by id)
      setClips((prevClips) => {
        const existingIds = new Set(mappedClips.map((m) => m.id));
        const combined = [...mappedClips, ...prevClips.filter((pc) => !existingIds.has(pc.id))];
        persistClipsSession(combined);
        return combined;
      });
    } catch (err: any) {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      activeJobIdRef.current = null;
      localStorage.removeItem("dior_active_render_job");
      setStatus("error");
      setErrorMessage(sanitizeErrorMessage(err?.message || "Terjadi kesalahan saat memproses klip."));
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
        inputMode={inputMode}
        setInputMode={setInputMode}
        youtubeUrl={youtubeUrl}
        setYoutubeUrl={setYoutubeUrl}
        uploadedVideoFile={uploadedVideoFile}
        setUploadedVideoFile={setUploadedVideoFile}
        clipCount={clipCount}
        setClipCount={setClipCount}
        targetDuration={targetDuration}
        setTargetDuration={setTargetDuration}
        pipelineMode={pipelineMode}
        setPipelineMode={setPipelineMode}
        presets={presets}
        selectedPresetId={selectedPresetId}
        setSelectedPresetId={setSelectedPresetId}
        subtitleFont={subtitleFont}
        setSubtitleFont={setSubtitleFont}
        refFileName={refFileName}
        setRefFileName={setRefFileName}
        onUploadReferenceVideo={handleUploadReferenceVideo}
        isCloningStyle={isCloningStyle}
        hasActiveClone={Boolean(tempCloneBlueprint)}
        onCancelClone={handleCancelClone}
        tempCloneSummary={tempCloneBlueprint?.detected_style_summary}
        enableHook={enableHook}
        setEnableHook={setEnableHook}
        enablePolish={enablePolish}
        setEnablePolish={setEnablePolish}
        enableCloneTopMotion={enableCloneTopMotion}
        setEnableCloneTopMotion={setEnableCloneTopMotion}
        enableCloneBottomMotion={enableCloneBottomMotion}
        setEnableCloneBottomMotion={setEnableCloneBottomMotion}
        uploadedBgmFile={uploadedBgmFile}
        setUploadedBgmFile={setUploadedBgmFile}
        enableBgmDucking={enableBgmDucking}
        setEnableBgmDucking={setEnableBgmDucking}
        bgmBaseVolume={bgmBaseVolume}
        setBgmBaseVolume={setBgmBaseVolume}
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
          step={processingStep}
          currentClipIndex={currentClipIndex}
          totalClips={totalClipsCount || clipCount}
          clippingLimit={clipCount}
          duration={targetDuration}
          onCancel={handleReset}
        />
      )}

      {/* Section Header: All Generated Clips */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#1b343b] pb-3 gap-3">
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
                ? `${clips.length} klip vertikal 9:16 tersimpan (otomatis dihapus jika >24 jam)`
                : "Hasil klip video vertikal berpotensi viral"}
            </p>
          </div>
        </div>

        {clips.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDeleteAllClips}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/40 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-rose-100 text-xs font-semibold shadow-sm transition active:scale-95 cursor-pointer"
              title="Hapus semua klip dan file video dari server secara permanen"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Semua Klip</span>
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 rounded-xl border border-[#23454d] bg-[#14282e] hover:bg-[#1a343b] text-xs text-[#8da5ab] hover:text-white transition cursor-pointer"
            >
              Reset Form
            </button>
          </div>
        )}
      </div>

      {/* Grid Hasil Klip: EMPTY STATE or REAL CLIPS (4 Kolom Vertikal 9:16) */}
      {clips.length === 0 && !isProcessing ? (
        <EmptyClipsState />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {clips.map((clip) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              isModalOpen={selectedClip !== null}
              isPlayingInline={selectedClip === null && activePlayingClipId === clip.id}
              onTogglePlayInline={handleTogglePlayInline}
              onSelectClip={handleSelectClip}
              onDownloadNotice={handleDownloadNotice}
              availablePresets={presets}
              onReStyle={handleReStyle}
              isRestyling={restylingClipId === clip.id}
              onSaveToPreset={handleOpenSavePresetModal}
            />
          ))}
        </div>
      )}

      {/* Video Modal Preview */}
      {selectedClip && (
        <VideoModal
          clip={selectedClip}
          onClose={() => {
            document.querySelectorAll("video").forEach((vid) => {
              try {
                vid.pause();
                vid.currentTime = 0;
              } catch {}
            });
            setSelectedClip(null);
          }}
          onDownloadNotice={handleDownloadNotice}
          onSaveToPreset={handleOpenSavePresetModal}
        />
      )}

      {/* Modal Simpan Gaya Klip ke Preset */}
      {clipToSaveAsPreset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-[#09171b] border border-[#1e3c43] shadow-2xl p-5 flex flex-col gap-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#183940]">
              <div className="flex items-center gap-2">
                <BookmarkPlus className="w-4 h-4 text-[#2cd3c6]" />
                <h3 className="text-sm font-bold text-white">Simpan Gaya ke Preset</h3>
              </div>
              <button
                type="button"
                onClick={() => setClipToSaveAsPreset(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveClipAsPreset} className="space-y-4">
              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Nama Template Preset
                </label>
                <input
                  type="text"
                  required
                  value={customPresetName}
                  onChange={(e) => setCustomPresetName(e.target.value)}
                  placeholder="Contoh: Gaya Podcast Investigasi"
                  className="w-full px-3 py-2 rounded-xl bg-[#071316] border border-[#1b3c43] text-white focus:outline-none focus:border-[#2cd3c6]"
                />
              </div>

              {/* Detail konfigurasi editing yang disimpan */}
              <div className="p-3 rounded-xl bg-[#071316] border border-[#142d33] space-y-1.5 text-[11px] text-[#7e9ca2]">
                <div className="flex items-center justify-between">
                  <span>Pipeline Mode:</span>
                  <span className="text-[#2cd3c6] font-medium">{pipelineMode}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Font Subtitle:</span>
                  <span className="text-white font-medium">{subtitleFont}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Cold-Open Hook:</span>
                  <span className="text-white">{enableHook ? "Aktif (4.5s)" : "Nonaktif"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Polish & SFX:</span>
                  <span className="text-white">{enablePolish ? "Aktif" : "Nonaktif"}</span>
                </div>
                {tempCloneBlueprint && (
                  <div className="flex items-center justify-between text-[#2cd3c6] pt-1 border-t border-[#142d33]">
                    <span>Universal Clone:</span>
                    <span className="font-semibold truncate max-w-[200px]" title={tempCloneBlueprint.detected_style_summary}>
                      {tempCloneBlueprint.detected_style_summary}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#183940]">
                <button
                  type="button"
                  onClick={() => setClipToSaveAsPreset(null)}
                  className="px-3.5 py-2 rounded-xl bg-[#14282e] hover:bg-[#1a343b] text-gray-300 font-semibold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingPresetModal}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#1a858c] to-[#2cd3c6] text-white font-bold flex items-center gap-1.5 hover:brightness-110 active:scale-95 transition disabled:opacity-50 cursor-pointer shadow-md"
                >
                  {isSavingPresetModal ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <BookmarkPlus className="w-3.5 h-3.5" />
                  )}
                  <span>Simpan Preset</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
