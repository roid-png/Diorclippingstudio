import { z } from "zod";

/**
 * [FASE 2: UNIVERSAL STYLE BLUEPRINT SCHEMA - STRICT RUNTIME VALIDATION]
 * Skema data parametrik universal 100% bebas dari template statis / hardcode kreator.
 */
export const UniversalStyleBlueprintSchema = z.object({
  blueprint_id: z.string(),
  blueprint_version: z.string().default("2.4.0"),
  source_metadata: z.object({
    detected_archetype: z.enum([
      "VIRAL_CREATOR_TIKTOK",
      "PODCAST_DOCUMENTARY",
      "SPLIT_INFOGRAPHIC",
      "MINIMALIST_CINEMA",
    ]),
    detected_summary: z.string(),
    pacing_speed: z.enum(["FAST_DYNAMIC", "BALANCED", "SLOW_METHODICAL"]),
    average_cut_duration_sec: z.number().min(0.5).max(10.0),
  }),

  canvas_and_framing: z.object({
    render_resolution: z.object({
      width: z.number().default(1080),
      height: z.number().default(1920),
    }),
    framing_mode: z.enum([
      "BLACK_LETTERBOX_FEATHER",
      "FULL_9_16_SPEAKER_TRACK",
      "DUAL_LAYER_BLUR",
      "SPLIT_STACK_VERTICAL",
    ]),
    inner_video_container: z.object({
      aspect_ratio: z.string().default("4:3"),
      width_px: z.number(),
      height_px: z.number(),
      pos_x_ratio: z.number().min(0).max(1),
      pos_y_ratio: z.number().min(0).max(1),
      corner_radius_px: z.number().default(0),
      border_stroke_px: z.number().default(0),
      border_stroke_hex: z.string().default("#000000"),
    }),
    backdrop_composition: z.object({
      type: z.enum(["PURE_SOLID_COLOR", "GAUSSIAN_BLUR", "DYNAMIC_GRADIENT"]),
      solid_hex: z.string().default("#000000"),
      blur_backdrop_sigma: z.number().default(0),
      dim_overlay_opacity: z.number().min(0).max(1).default(0),
      edge_feather_mask: z.object({
        enabled: z.boolean(),
        top_feather_px: z.number(),
        bottom_feather_px: z.number(),
        gradient_curve: z.string().default("CUBIC_SMOOTH"),
      }),
      bottom_ambient_vignette: z.object({
        enabled: z.boolean(),
        start_y_ratio: z.number().min(0).max(1),
        opacity: z.number().min(0).max(1),
        tint_hex: z.string().default("#000000"),
      }),
    }),
  }),

  camera_choreography: z.object({
    tracking_engine: z.enum([
      "ACTIVE_SPEAKER_AUDIO_VISUAL",
      "STATIC_LOCKED",
      "MANUAL_KEYFRAMES",
    ]),
    headroom_offset_ratio: z.number().default(0.12),
    two_shot_framing_fallback: z.string().default("LETTERBOX_FIT_BOTH"),
    switching_rules: z.object({
      minimum_hold_duration_sec: z.number().default(2.5),
      interruption_switch_threshold_db: z.number().default(-16.0),
      deadzone_pixel_jitter_margin: z.number().default(45),
    }),
    pan_physics: z.object({
      transition_type: z.enum(["SMOOTH_KEYFRAME_LERP", "HARD_CUT", "SMOOTH_ZOOM"]),
      pan_duration_sec: z.number().min(0.1).max(1.5),
      easing_curve: z.string().default("cubic-bezier(0.25, 1, 0.5, 1)"),
      punch_zoom_on_keyword: z.object({
        enabled: z.boolean(),
        scale_factor: z.number().min(1.0).max(1.2),
        hold_duration_sec: z.number(),
      }),
      idle_camera_drift: z.object({
        enabled: z.boolean(),
        type: z.string(),
        start_scale: z.number(),
        end_scale: z.number(),
      }),
    }),
  }),

  opening_hook_engine: z.object({
    enabled: z.boolean(),
    active_zone_start_sec: z.number().default(0.0),
    active_zone_end_sec: z.number().default(6.0),
    hook_presentation_style: z.enum([
      "IN_SCENE_BLUR_KINETIC",
      "TOP_HEADER_CARD",
      "NONE",
    ]),
    layout_geometry: z.object({
      anchor_x: z.number().min(0).max(1),
      anchor_y: z.number().min(0).max(1),
      alignment: z.enum(["center", "left", "right"]),
      max_text_width_ratio: z.number(),
    }),
    scene_dimmer_during_hook: z.object({
      dim_background_opacity: z.number().min(0).max(1),
      blur_background_sigma: z.number().default(0),
    }),
    line_1_setup: z.object({
      casing: z.enum(["lowercase", "UPPERCASE", "Capitalize"]),
      font_family: z.string(),
      font_weight: z.string(),
      font_size_px: z.number(),
      letter_spacing_px: z.number(),
      color_hex: z.string(),
      stroke_width_px: z.number().default(0),
      stroke_hex: z.string().default("#000000"),
      shadow: z.object({
        blur_px: z.number(),
        offset_x: z.number(),
        offset_y: z.number(),
        color_hex: z.string(),
      }),
    }),
    line_2_punchword: z.object({
      casing: z.enum(["lowercase", "UPPERCASE", "Capitalize"]),
      font_family: z.string(),
      font_weight: z.string(),
      font_size_px: z.number(),
      letter_spacing_px: z.number(),
      color_hex: z.string(),
      render_passes: z.object({
        pass_1_directional_blur: z.object({
          blur_radius_px: z.number(),
          opacity: z.number(),
          tint_hex: z.string(),
        }),
        pass_2_bloom_glow: z.object({
          glow_radius_px: z.number(),
          opacity: z.number(),
          tint_hex: z.string(),
        }),
        pass_3_sharp_core: z.object({
          stroke_width_px: z.number(),
          stroke_hex: z.string(),
          fill_hex: z.string(),
        }),
      }),
      entry_animation: z.object({
        type: z.string(),
        duration_ms: z.number(),
        initial_scale: z.number(),
        overshoot_scale: z.number(),
        settle_scale: z.number(),
      }),
    }),
    sequential_beats: z.object({
      enabled: z.boolean(),
      max_words_per_beat: z.number(),
      beat_rhythm: z.string(),
    }),
  }),

  body_subtitle_engine: z.object({
    mute_during_hook: z.boolean().default(true),
    start_timestamp_sec: z.number(),
    display_cadence: z.enum([
      "SINGLE_WORD_POP",
      "TWO_WORD_PUNCH",
      "PHRASE_KARAOKE_PILL",
      "CLEAN_SENTENCE",
    ]),
    max_words_per_event: z.number().min(1).max(6),
    spatial_placement: z.object({
      alignment: z.enum(["CENTER_BOTTOM", "CENTER_MIDDLE", "TOP_BANNER"]),
      pos_x_ratio: z.number().min(0).max(1),
      pos_y_ratio: z.number().min(0).max(1),
      margin_vertical_px: z.number(),
    }),
    typography: z.object({
      font_family: z.string(),
      font_size_px: z.number(),
      line_height_multiplier: z.number(),
      letter_spacing_px: z.number(),
      casing: z.enum(["UPPERCASE", "lowercase", "Capitalize"]),
    }),
    color_and_highlights: z.object({
      base_text_hex: z.string(),
      highlight_mode: z.enum(["NONE", "TEXT_COLOR", "BACKGROUND_PILL"]),
      highlight_text_hex: z.string(),
      highlight_box_pill: z.object({
        enabled: z.boolean(),
        bg_hex: z.string(),
        padding_x_px: z.number(),
        padding_y_px: z.number(),
        border_radius_px: z.number(),
      }),
    }),
    stroke_and_shadow: z.object({
      outline_thickness_px: z.number(),
      outline_color_hex: z.string(),
      shadow_depth_px: z.number(),
      shadow_blur_px: z.number(),
      shadow_color_hex: z.string(),
    }),
    motion_physics: z.object({
      entry_transition: z.enum(["POP_SCALE_SNAP", "SMOOTH_FADE", "HARD_CUT"]),
      scale_start: z.number(),
      scale_peak: z.number(),
      duration_frames: z.number(),
      zero_collision_clamping: z.boolean().default(true),
    }),
  }),

  upper_context_graphics: z.object({
    enabled: z.boolean().default(false),
    archetype: z.enum([
      "NONE",
      "FLOATING_GLASS_STEPS",
      "BIG_METRIC_COUNTER",
      "VERSUS_SPLIT",
    ]),
    container_pos_y_px: z.number().default(140),
    accent_theme_hex: z.string().default("#14B8A6"),
  }),

  color_science_and_atmosphere: z.object({
    color_grading: z.object({
      brightness_lift: z.number(),
      contrast_multiplier: z.number(),
      saturation_multiplier: z.number(),
      temperature_tint: z.string(),
      crush_shadows: z.boolean().default(false),
    }),
    texture_overlays: z.object({
      film_grain_intensity: z.number().min(0).max(1),
      cinema_scratches: z.boolean(),
      glow_bleed_intensity: z.number().min(0).max(1),
    }),
  }),

  audio_sfx_cues: z.object({
    hook_sfx_trigger: z.object({
      enabled: z.boolean(),
      sfx_type: z.string(),
      volume_db: z.number(),
      timestamp_offset_ms: z.number(),
    }),
    beat_transition_sfx: z.object({
      enabled: z.boolean(),
      sfx_type: z.string(),
      volume_db: z.number(),
    }),
    bg_music_ducking: z.object({
      enabled: z.boolean(),
      ducking_depth_db: z.number(),
      release_time_ms: z.number(),
    }),
  }),
});

export type UniversalStyleBlueprint = z.infer<typeof UniversalStyleBlueprintSchema>;

/**
 * Default fallback factory if Gemini extraction returns a partial or empty object.
 */
export function getDefaultUniversalBlueprint(
  sessionId = `temp_clone_session_${Date.now()}`
): UniversalStyleBlueprint {
  return {
    blueprint_id: sessionId,
    blueprint_version: "2.4.0",
    source_metadata: {
      detected_archetype: "VIRAL_CREATOR_TIKTOK",
      detected_summary:
        "High-retention kinetic editing with blurred stacked punchword, letterbox feathering, and reactive camera tracking.",
      pacing_speed: "FAST_DYNAMIC",
      average_cut_duration_sec: 2.4,
    },
    canvas_and_framing: {
      render_resolution: { width: 1080, height: 1920 },
      framing_mode: "BLACK_LETTERBOX_FEATHER",
      inner_video_container: {
        aspect_ratio: "4:3",
        width_px: 1080,
        height_px: 810,
        pos_x_ratio: 0.5,
        pos_y_ratio: 0.48,
        corner_radius_px: 0,
        border_stroke_px: 0,
        border_stroke_hex: "#000000",
      },
      backdrop_composition: {
        type: "PURE_SOLID_COLOR",
        solid_hex: "#000000",
        blur_backdrop_sigma: 0,
        dim_overlay_opacity: 0.0,
        edge_feather_mask: {
          enabled: true,
          top_feather_px: 55,
          bottom_feather_px: 75,
          gradient_curve: "CUBIC_SMOOTH",
        },
        bottom_ambient_vignette: {
          enabled: true,
          start_y_ratio: 0.65,
          opacity: 0.85,
          tint_hex: "#000000",
        },
      },
    },
    camera_choreography: {
      tracking_engine: "ACTIVE_SPEAKER_AUDIO_VISUAL",
      headroom_offset_ratio: 0.12,
      two_shot_framing_fallback: "LETTERBOX_FIT_BOTH",
      switching_rules: {
        minimum_hold_duration_sec: 2.5,
        interruption_switch_threshold_db: -16.0,
        deadzone_pixel_jitter_margin: 45,
      },
      pan_physics: {
        transition_type: "SMOOTH_KEYFRAME_LERP",
        pan_duration_sec: 0.42,
        easing_curve: "cubic-bezier(0.25, 1, 0.5, 1)",
        punch_zoom_on_keyword: {
          enabled: true,
          scale_factor: 1.05,
          hold_duration_sec: 0.6,
        },
        idle_camera_drift: {
          enabled: true,
          type: "SLOW_KEN_BURNS_ZOOM_IN",
          start_scale: 1.0,
          end_scale: 1.03,
        },
      },
    },
    opening_hook_engine: {
      enabled: true,
      active_zone_start_sec: 0.0,
      active_zone_end_sec: 6.2,
      hook_presentation_style: "IN_SCENE_BLUR_KINETIC",
      layout_geometry: {
        anchor_x: 0.5,
        anchor_y: 0.52,
        alignment: "center",
        max_text_width_ratio: 0.88,
      },
      scene_dimmer_during_hook: {
        dim_background_opacity: 0.38,
        blur_background_sigma: 0,
      },
      line_1_setup: {
        casing: "lowercase",
        font_family: "Plus Jakarta Sans",
        font_weight: "ExtraBold",
        font_size_px: 48,
        letter_spacing_px: -0.5,
        color_hex: "#FFFFFF",
        stroke_width_px: 0,
        stroke_hex: "#000000",
        shadow: {
          blur_px: 14,
          offset_x: 0,
          offset_y: 3,
          color_hex: "rgba(0,0,0,0.85)",
        },
      },
      line_2_punchword: {
        casing: "UPPERCASE",
        font_family: "Poppins Black",
        font_weight: "Black",
        font_size_px: 94,
        letter_spacing_px: 1.5,
        color_hex: "#FF7A00",
        render_passes: {
          pass_1_directional_blur: {
            blur_radius_px: 18,
            opacity: 0.8,
            tint_hex: "#FF7A00",
          },
          pass_2_bloom_glow: {
            glow_radius_px: 8,
            opacity: 0.95,
            tint_hex: "#FFA040",
          },
          pass_3_sharp_core: {
            stroke_width_px: 2.0,
            stroke_hex: "#000000",
            fill_hex: "#FF7A00",
          },
        },
        entry_animation: {
          type: "POP_SCALE_AND_BLUR_IN",
          duration_ms: 140,
          initial_scale: 0.82,
          overshoot_scale: 1.06,
          settle_scale: 1.0,
        },
      },
      sequential_beats: {
        enabled: true,
        max_words_per_beat: 2,
        beat_rhythm: "AUDIO_SYLLABLE_SYNC",
      },
    },
    body_subtitle_engine: {
      mute_during_hook: true,
      start_timestamp_sec: 6.2,
      display_cadence: "SINGLE_WORD_POP",
      max_words_per_event: 1,
      spatial_placement: {
        alignment: "CENTER_BOTTOM",
        pos_x_ratio: 0.5,
        pos_y_ratio: 0.74,
        margin_vertical_px: 120,
      },
      typography: {
        font_family: "Montserrat ExtraBold",
        font_size_px: 64,
        line_height_multiplier: 1.2,
        letter_spacing_px: 0.8,
        casing: "UPPERCASE",
      },
      color_and_highlights: {
        base_text_hex: "#FFFFFF",
        highlight_mode: "NONE",
        highlight_text_hex: "#FFFFFF",
        highlight_box_pill: {
          enabled: false,
          bg_hex: "rgba(255, 122, 0, 0.95)",
          padding_x_px: 18,
          padding_y_px: 8,
          border_radius_px: 12,
        },
      },
      stroke_and_shadow: {
        outline_thickness_px: 3.8,
        outline_color_hex: "#000000",
        shadow_depth_px: 4.5,
        shadow_blur_px: 8.0,
        shadow_color_hex: "rgba(0,0,0,0.90)",
      },
      motion_physics: {
        entry_transition: "POP_SCALE_SNAP",
        scale_start: 0.88,
        scale_peak: 1.04,
        duration_frames: 4,
        zero_collision_clamping: true,
      },
    },
    upper_context_graphics: {
      enabled: false,
      archetype: "NONE",
      container_pos_y_px: 140,
      accent_theme_hex: "#14B8A6",
    },
    color_science_and_atmosphere: {
      color_grading: {
        brightness_lift: 0.02,
        contrast_multiplier: 1.04,
        saturation_multiplier: 1.06,
        temperature_tint: "SLIGHT_WARM",
        crush_shadows: false,
      },
      texture_overlays: {
        film_grain_intensity: 0.0,
        cinema_scratches: false,
        glow_bleed_intensity: 0.12,
      },
    },
    audio_sfx_cues: {
      hook_sfx_trigger: {
        enabled: true,
        sfx_type: "SUB_BASS_BOOM_WHOOSH",
        volume_db: -6.0,
        timestamp_offset_ms: -80,
      },
      beat_transition_sfx: {
        enabled: true,
        sfx_type: "CLEAN_CLICK_THUD",
        volume_db: -12.0,
      },
      bg_music_ducking: {
        enabled: true,
        ducking_depth_db: -18.0,
        release_time_ms: 350,
      },
    },
  };
}

/**
 * [FASE 4: HOLISTIC DNA SCHEMA - COMPREHENSIVE STYLE BLUEPRINT PRESET]
 * Menyimpan DNA editing secara menyeluruh (framing kanvas, kurva kamera, gaya hook kinetik,
 * subtitle, color grade, tekstur film, hingga parameter ducking audio).
 */
export const HolisticDnaSchema = z.object({
  framing: z.object({
    mode: z.enum([
      "LETTERBOX_FEATHER_CINEMATIC",
      "DYNAMIC_9_16_SPEAKER_TRACK",
      "DUAL_LAYER_BLUR_ACCENT",
      "SPLIT_SCREEN_VERTICAL",
    ]).default("LETTERBOX_FEATHER_CINEMATIC"),
    aspect_ratio: z.string().default("16:9"),
    pos_y_ratio: z.number().default(0.48),
    feather_px: z.number().default(35),
    backdrop_hex: z.string().default("#000000"),
  }),
  camera: z.object({
    tracking_mode: z.string().default("ACTIVE_SPEAKER_AUDIO_VISUAL"),
    pan_duration_sec: z.number().default(0.45),
    easing_curve: z.string().default("cubic-bezier(0.25, 1, 0.5, 1)"),
    idle_drift_zoom: z.number().default(1.03),
  }),
  hook_typography: z.object({
    enabled: z.boolean().default(true),
    presentation_style: z.string().default("IN_SCENE_BLUR_KINETIC"),
    font_family: z.string().default("League Spartan"),
    font_weight: z.string().default("900"),
    accent_color_hex: z.string().default("#FF7A00"),
    render_mode: z.string().default("MULTI_PASS_GLOW"),
    duration_sec: z.number().default(4.5),
  }),
  subtitles: z.object({
    display_cadence: z.string().default("SINGLE_WORD_POP"),
    font_family: z.string().default("Montserrat ExtraBold"),
    font_size_px: z.number().default(54),
    base_color_hex: z.string().default("#FFFFFF"),
    highlight_color_hex: z.string().default("#FF7A00"),
    outline_width_px: z.number().default(3.5),
    outline_color_hex: z.string().default("#000000"),
    margin_vertical_px: z.number().default(380),
    motion: z.string().default("POP_SCALE_SNAP"),
    progress_bar: z.boolean().default(true),
  }),
  color_grading: z.object({
    preset_name: z.string().default("Moody Warm Film"),
    contrast: z.number().default(1.08),
    brightness: z.number().default(-0.01),
    saturation: z.number().default(1.10),
    gamma_r: z.number().default(1.02),
    gamma_b: z.number().default(0.97),
    film_grain_intensity: z.number().default(0.08),
  }),
  audio: z.object({
    bgm_base_volume: z.number().default(0.15),
    ducking_depth_db: z.number().default(-20),
    hook_delay_sec: z.number().default(4.5),
  }),
});

export type HolisticDna = z.infer<typeof HolisticDnaSchema>;


