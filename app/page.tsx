"use client";

import {
  AlertTriangle,
  Award,
  Backpack,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleHelp,
  CircleGauge,
  ClipboardCheck,
  Clock3,
  Footprints,
  Gamepad2,
  Gauge,
  Glasses,
  GraduationCap,
  Hand,
  Lightbulb,
  Map,
  Microscope,
  MousePointer2,
  Pause,
  Play,
  RotateCcw,
  ScanLine,
  Settings,
  ShieldCheck,
  Target,
  Volume2,
  Wrench,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WorkshopScene from "./workshop-scene";

type Tone = "info" | "success" | "warning";
type ItemKind = "epp" | "tool";
type StageGuide = {
  mode: string;
  time: string;
  title: string;
  brief: string;
  how: string;
  why: string;
  completed: string;
  next: string;
};
type GameEvent = {
  action_id: string;
  modulo: string;
  oa_ae: string;
  criterio: string;
  habilidad: string;
  concepto: string;
  evidencia: string;
  resultado: string;
  nivel_ayuda: number;
  timestamp: string;
};

const nav = [
  [Gamepad2, "Misión Laboral 3D"],
  [Award, "Mis logros"],
  [CircleGauge, "Mi progreso"],
] as const;

const items: Record<string, { name: string; kind: ItemKind; useful: boolean; description: string }> = {
  goggles: {
    name: "Lentes de seguridad",
    kind: "epp",
    useful: true,
    description: "Protegen tus ojos durante la inspección y las pruebas en el compartimiento del motor.",
  },
  gloves: {
    name: "Guantes de protección",
    kind: "epp",
    useful: true,
    description: "Permiten manipular conectores y elementos del motor con protección adecuada.",
  },
  compression_gauge: {
    name: "Compresímetro",
    kind: "tool",
    useful: true,
    description: "Mide la presión de compresión de cada cilindro para evaluar el sellado del motor.",
  },
  feeler_gauge: {
    name: "Juego de galgas",
    kind: "tool",
    useful: true,
    description: "Permite comprobar la holgura entre los componentes del tren de válvulas.",
  },
  torque_wrench: {
    name: "Llave dinamométrica",
    kind: "tool",
    useful: false,
    description: "Aplica un torque especificado; no reemplaza los instrumentos del diagnóstico inicial.",
  },
};

const targetLabels: Record<string, string> = {
  npc: "Hablar con Mateo",
  vehicle: "Inspeccionar el vehículo",
  goggles: "Revisar lentes de seguridad",
  gloves: "Revisar guantes de protección",
  compression_gauge: "Revisar compresímetro",
  feeler_gauge: "Revisar juego de galgas",
  torque_wrench: "Revisar llave dinamométrica",
  manual: "Consultar manual de servicio",
  compression_test: "Medir compresión de cilindros",
  valve_clearance: "Medir holgura de válvulas",
  injectors: "Intervenir sistema de inyección",
  head_gasket: "Desmontar culata",
  valve_adjustment: "Ajustar holgura de válvulas",
  ignition: "Accionar el encendido",
};

const objectives = [
  "Revisa la misión antes de comenzar.",
  "Habla con Mateo e inspecciona el vehículo.",
  "Equípate y selecciona los instrumentos pertinentes.",
  "Reúne tres evidencias mediante el manual y mediciones del motor.",
  "Interviene el componente coherente con las evidencias.",
  "Arranca el vehículo y comprueba nuevamente la compresión.",
];

const stepNames = ["Preparado", "Comprende y explora", "Reconoce y prepárate", "Investiga y relaciona", "Decide y actúa", "Comprueba y llega a la meta"];
const routeLabels = ["Contexto", "Equipo", "Evidencias", "Intervención", "Comprobación"];

const stageGuides: Record<number, StageGuide> = {
  1: {
    mode: "PRÁCTICA GUIADA",
    time: "0:00–1:30",
    title: "Comprende la situación",
    brief: "Dirígete a la bahía de diagnóstico y reúne información inicial antes de intervenir.",
    how: "Camina con WASD o los controles táctiles. Al acercarte, presiona E o el botón Interactuar.",
    why: "Un diagnóstico seguro comienza reuniendo información antes de utilizar instrumentos.",
    completed: "Inspeccionaste el vehículo y obtuviste el relato técnico de la falla.",
    next: "Preparar EPP e instrumentos",
  },
  2: {
    mode: "PRÁCTICA GUIADA",
    time: "1:30–3:00",
    title: "Prepara tu intervención",
    brief: "Dirígete a la zona de preparación e identifica el EPP y los instrumentos que necesitarás.",
    how: "Acércate a cada objeto, inspecciónalo y confirma si lo agregarás. Puedes devolver un instrumento desde el inventario.",
    why: "Seleccionar EPP y herramientas pertinentes evita riesgos y reduce intervenciones innecesarias.",
    completed: "Elegiste el EPP y los instrumentos adecuados para diagnosticar el estado del motor.",
    next: "Investigar y relacionar evidencias",
  },
  3: {
    mode: "PRÁCTICA CON APOYO",
    time: "3:00–6:00",
    title: "Construye el diagnóstico",
    brief: "Reúne tres evidencias y relaciónalas: información del sistema, especificación técnica y medición real.",
    how: "Recorre el taller y utiliza la documentación y los instrumentos que preparaste. Tú eliges el orden.",
    why: "Una conclusión técnica válida debe comparar datos reales con especificaciones y códigos de diagnóstico.",
    completed: "Relacionaste la especificación del fabricante con la compresión y la holgura medidas.",
    next: "Decidir e intervenir",
  },
  4: {
    mode: "PRÁCTICA AUTÓNOMA",
    time: "6:00–8:30",
    title: "Decide con evidencia",
    brief: "Analiza tus hallazgos y decide qué intervención está mejor justificada. Ya no se destacará una respuesta específica.",
    how: "Acércate a una ruta de intervención, selecciónala y confirma tu decisión antes de actuar.",
    why: "En el trabajo real, intervenir sin evidencia puede generar costos, riesgos y nuevas fallas.",
    completed: "Ajustaste la holgura de válvulas porque las mediciones justificaban esa intervención.",
    next: "Comprobar el resultado",
  },
  5: {
    mode: "PRÁCTICA AUTÓNOMA",
    time: "8:30–10:00",
    title: "Comprueba y cierra",
    brief: "Demuestra que la intervención resolvió la falla y verifica el sistema antes de cerrar la orden.",
    how: "Aplica el procedimiento aprendido. La ayuda sigue disponible, pero la secuencia debes decidirla tú.",
    why: "Una reparación solo se considera terminada cuando el resultado se comprueba con evidencia.",
    completed: "Confirmaste el funcionamiento estable y verificaste que la compresión se recuperara.",
    next: "Misión completada",
  },
};

function formatTime(total: number) {
  const minutes = Math.floor(total / 60).toString().padStart(2, "0");
  const seconds = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function synthSound(kind: "beep" | "warning" | "engine") {
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + (kind === "engine" ? 1.15 : 0.28));
  gain.connect(context.destination);
  const oscillator = context.createOscillator();
  oscillator.type = kind === "warning" ? "square" : "sawtooth";
  oscillator.frequency.setValueAtTime(kind === "engine" ? 70 : kind === "warning" ? 180 : 520, context.currentTime);
  if (kind === "engine") oscillator.frequency.exponentialRampToValueAtTime(155, context.currentTime + 1.05);
  oscillator.connect(gain);
  oscillator.start();
  oscillator.stop(context.currentTime + (kind === "engine" ? 1.2 : 0.3));
  oscillator.addEventListener("ended", () => void context.close());
}

function mentorHint(level: number, step: number) {
  const hints: Record<number, string[]> = {
    1: ["", "Empieza por una fuente visible de información y luego busca la segunda.", "Distingue entre protección personal e instrumentos de diagnóstico.", "Piensa qué dato te falta para comparar condición esperada y condición real.", "Vuelve a leer las tres evidencias antes de elegir una intervención.", "Pregúntate qué dos comprobaciones demuestran que la falla fue resuelta."],
    2: ["", "La condición del vehículo y el relato del técnico se complementan.", "Necesitas proteger ojos y manos, además de medir compresión y holguras.", "Un diagnóstico sólido compara dos mediciones con el manual del fabricante.", "Descarta las intervenciones que no expliquen simultáneamente la baja compresión y la holgura medida.", "Una prueba de funcionamiento no reemplaza la medición final."],
    3: ["", "Acércate primero al vehículo y luego a Mateo; ambos están en la bahía.", "Revisa el panel de EPP y selecciona instrumentos propios del ajuste de motores.", "Consulta el manual y mide la compresión y la holgura de válvulas.", "Corrige la condición medida antes de desmontar conjuntos mayores.", "Comprueba primero el funcionamiento y después repite la medición de compresión."],
    4: ["", "Inspecciona el vehículo y conversa con Mateo para cerrar esta etapa.", "Equípate con lentes y guantes; lleva compresímetro y juego de galgas.", "Obtén el valor mínimo de 10 bar, la compresión de 7,2 bar y una holgura de admisión de 0,05 mm.", "La holgura insuficiente puede impedir el cierre correcto de la válvula y reducir la compresión.", "Acciona el encendido y repite la prueba de compresión para cerrar la verificación."],
  };
  return hints[level]?.[step] || "Revisa el objetivo actual y las señales del entorno.";
}

export default function HomePage() {
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [checks, setChecks] = useState({ npc: false, vehicle: false });
  const [epp, setEpp] = useState<string[]>([]);
  const [tools, setTools] = useState<string[]>([]);
  const [evidence, setEvidence] = useState<string[]>([]);
  const [nearby, setNearby] = useState<string | null>(null);
  const [inspection, setInspection] = useState<string | null>(null);
  const [repaired, setRepaired] = useState(false);
  const [engineRunning, setEngineRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [helpLevel, setHelpLevel] = useState(0);
  const [maxHelpLevel, setMaxHelpLevel] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [stageComplete, setStageComplete] = useState<number | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [objectiveOpen, setObjectiveOpen] = useState(false);
  const [visibleHint, setVisibleHint] = useState<string | null>(null);
  const [pendingDecision, setPendingDecision] = useState<string | null>(null);
  const [decisionAttempts, setDecisionAttempts] = useState(0);
  const [preparationReviewOpen, setPreparationReviewOpen] = useState(false);
  const [analysisPause, setAnalysisPause] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [navigation, setNavigation] = useState<{ label: string; distance: number; angle: number } | null>(null);
  const [pulse, setPulse] = useState(0);
  const [resetToken, setResetToken] = useState(0);
  const [reflection, setReflection] = useState("");
  const [toast, setToast] = useState<{ title: string; body: string; tone: Tone } | null>(null);
  const telemetryRef = useRef<GameEvent[]>([]);
  const startedAtRef = useRef(0);
  const lastProgressRef = useRef(Date.now());
  const stepRef = useRef(step);
  const completedRef = useRef(completed);
  const helpLevelRef = useRef(helpLevel);
  stepRef.current = step;
  completedRef.current = completed;
  helpLevelRef.current = helpLevel;

  const record = useCallback((actionId: string, result: string, evidenceValue = "") => {
    const event: GameEvent = {
      action_id: actionId,
      modulo: "ME-MEAU-M05",
      oa_ae: "OA 4 · AE 1",
      criterio: actionId.includes("verify") ? "1.5" : actionId.includes("manual") ? "1.1" : "1.4",
      habilidad: actionId,
      concepto: "Diagnóstico y ajuste del motor según especificaciones del fabricante",
      evidencia: evidenceValue,
      resultado: result,
      nivel_ayuda: helpLevelRef.current,
      timestamp: new Date().toISOString(),
    };
    telemetryRef.current.push(event);
    try {
      localStorage.setItem("aula-tp-senal-perdida", JSON.stringify(telemetryRef.current));
    } catch {
      // The mission still works when storage is unavailable.
    }
  }, []);

  const showMessage = useCallback((title: string, body: string, tone: Tone = "info") => {
    setToast({ title, body, tone });
  }, []);

  const markProgress = useCallback(() => {
    lastProgressRef.current = Date.now();
    setHelpLevel(0);
    setVisibleHint(null);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (step === 0 || completed) return;
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      const idle = (Date.now() - lastProgressRef.current) / 1000;
      const thresholds = stepRef.current <= 2 ? [35, 65, 95, 125] : stepRef.current === 3 ? [50, 90, 135, 180] : [90, 150, 210, 270];
      const nextLevel = idle >= thresholds[3] ? 4 : idle >= thresholds[2] ? 3 : idle >= thresholds[1] ? 2 : idle >= thresholds[0] ? 1 : 0;
      if (nextLevel > helpLevelRef.current) {
        setHelpLevel(nextLevel);
        setMaxHelpLevel((current) => Math.max(current, nextLevel));
        showMessage(`Mentor TP · Ayuda ${nextLevel}/4`, mentorHint(nextLevel, stepRef.current), "info");
        record(`mentor_help_${nextLevel}`, "apoyo_entregado", `paso_${stepRef.current}`);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [completed, record, showMessage, step]);

  useEffect(() => {
    if (step === 1 && checks.npc && checks.vehicle && stageComplete !== 1) {
      setStageComplete(1);
      showMessage("Etapa completada", "Comprendiste la situación antes de intervenir.", "success");
      record("step_1_complete", "logrado", "contexto_completo");
    }
  }, [checks, record, showMessage, stageComplete, step]);

  useEffect(() => {
    if (step === 3 && evidence.length === 3 && stageComplete !== 3) {
      setStageComplete(3);
      showMessage("Etapa completada", "Ya puedes justificar una decisión técnica con evidencia.", "success");
      record("step_3_complete", "logrado", evidence.join(","));
    }
  }, [evidence, record, showMessage, stageComplete, step]);

  useEffect(() => {
    if (step === 4 && repaired && stageComplete !== 4) {
      setStageComplete(4);
      showMessage("Etapa completada", "La intervención coincide con la evidencia reunida.", "success");
      record("step_4_complete", "logrado", "holgura_valvulas_ajustada");
    }
  }, [record, repaired, showMessage, stageComplete, step]);

  const startMission = () => {
    startedAtRef.current = Date.now();
    lastProgressRef.current = Date.now();
    setStep(1);
    setBriefingOpen(true);
    setPulse((value) => value + 1);
    synthSound("beep");
    record("mission_start", "iniciado", "orden_de_trabajo");
  };

  const addEvidence = useCallback((id: string, title: string, body: string) => {
    setEvidence((current) => current.includes(id) ? current : [...current, id]);
    markProgress();
    showMessage(title, body, "success");
    synthSound("beep");
    record(`evidence_${id}`, "descubierta", id);
  }, [markProgress, record, showMessage]);

  const applyDecision = useCallback((id: string) => {
    setPendingDecision(null);
    if (id === "valve_adjustment") {
      setRepaired(true);
      markProgress();
      showMessage("Decisión verificada", "La holgura de admisión insuficiente explica la pérdida de compresión. Ajustarla según el manual corrige la causa medida.", "success");
      synthSound("beep");
      record("decision_valve_adjustment", "intervencion_correcta", "holgura_ajustada_0_20_mm");
      return;
    }

    const attempt = decisionAttempts + 1;
    setDecisionAttempts(attempt);
    setMistakes((value) => value + 1);
    const feedback = attempt === 1
      ? "Esta ruta no explica simultáneamente la compresión baja y la holgura medida. Compara ambos datos con el manual."
      : attempt === 2
        ? "No existe evidencia que justifique desmontar la culata o intervenir los inyectores. Concéntrate en el componente que no cumple su holgura."
        : "Antes de desmontar conjuntos mayores, ajusta la válvula de admisión del cilindro 4 a 0,20 mm según el manual.";
    setAnalysisPause(feedback);
    synthSound("warning");
    record(`decision_${id}`, "requiere_revision", `intento_${attempt}`);
  }, [decisionAttempts, markProgress, record, showMessage]);

  const handleInteract = useCallback((id: string) => {
    setPulse((value) => value + 1);
    if (stepRef.current === 1) {
      if (id === "npc") {
        setChecks((current) => ({ ...current, npc: true }));
        markProgress();
        showMessage("Mateo · Técnico", "El motor perdió potencia, presenta ralentí inestable y le cuesta encender en frío.", "info");
        record("talk_npc", "informacion_obtenida", "perdida_potencia_y_arranque_dificil");
      }
      if (id === "vehicle") {
        setChecks((current) => ({ ...current, vehicle: true }));
        markProgress();
        showMessage("Inspección inicial", "No hay fugas visibles. El motor enciende con dificultad y vibra en ralentí.", "info");
        record("inspect_vehicle", "informacion_obtenida", "ralenti_inestable_sin_fugas");
      }
      return;
    }
    if (stepRef.current === 2 && items[id]) {
      setInspection(id);
      record(`inspect_${id}`, "objeto_reconocido", items[id].name);
      return;
    }
    if (stepRef.current === 3) {
      if (id === "manual") {
        addEvidence("manual", "Evidencia 1 · Manual de servicio", "Compresión mínima: 10 bar. Holgura de admisión en frío: 0,20 ± 0,03 mm.");
      } else if (id === "compression_test") {
        addEvidence("compression", "Evidencia 2 · Prueba de compresión", "Cilindros 1–3: 10,7–10,9 bar. Cilindro 4: 7,2 bar, bajo el mínimo del fabricante.");
      } else if (id === "valve_clearance") {
        addEvidence("clearance", "Evidencia 3 · Medición de holgura", "Válvula de admisión del cilindro 4: 0,05 mm. La holgura es insuficiente.");
      }
      return;
    }
    if (stepRef.current === 4) {
      if (["injectors", "head_gasket", "valve_adjustment"].includes(id)) setPendingDecision(id);
      return;
    }
    if (stepRef.current === 5) {
      if (id === "ignition" && !engineRunning) {
        setEngineRunning(true);
        markProgress();
        showMessage("El motor enciende", "La intervención produjo un cambio real. Falta comprobar que el código no reaparezca.", "success");
        synthSound("engine");
        record("engine_start", "motor_operativo", "encendido_estable");
      } else if (id === "compression_test" && engineRunning) {
        setCompleted(true);
        markProgress();
        showMessage("Misión cumplida", "El cilindro 4 registra 10,8 bar y el motor mantiene un ralentí estable.", "success");
        synthSound("beep");
        record("verify_final", "mision_cumplida", "compresion_10_8_bar_y_ralenti_estable");
      }
    }
  }, [addEvidence, engineRunning, markProgress, record, showMessage]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (step > 0 && !completed && event.code === "Tab") {
        event.preventDefault();
        setObjectiveOpen(true);
        return;
      }
      if (step > 0 && !completed && event.code === "Escape") {
        event.preventDefault();
        if (paused) {
          setPaused(false);
        } else if (!inspection && !briefingOpen && !stageComplete && !helpOpen && !objectiveOpen && !pendingDecision && !preparationReviewOpen && !analysisPause) {
          setPaused(true);
        }
        return;
      }
      if (step > 0 && !completed && event.code === "Slash" && event.shiftKey) {
        event.preventDefault();
        setHelpOpen(true);
        return;
      }
      if (event.code === "KeyE" && !event.repeat && nearby && !paused && !inspection && !completed && !briefingOpen && !stageComplete && !helpOpen && !objectiveOpen && !pendingDecision && !preparationReviewOpen && !analysisPause) handleInteract(nearby);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [analysisPause, briefingOpen, completed, handleInteract, helpOpen, inspection, nearby, objectiveOpen, paused, pendingDecision, preparationReviewOpen, stageComplete, step]);

  const chooseItem = (take: boolean) => {
    if (!inspection) return;
    const item = items[inspection];
    if (take) {
      if (item.kind === "epp") {
        setEpp((current) => current.includes(inspection) ? current : [...current, inspection]);
        showMessage("EPP equipado", `${item.name} listo para usar.`, "success");
      } else if (tools.includes(inspection)) {
        showMessage("Ya está en tu equipo", item.name, "info");
      } else if (tools.length >= 2) {
        showMessage("Inventario completo", "Descarta un instrumento antes de agregar otro.", "warning");
        synthSound("warning");
        return;
      } else {
        setTools((current) => [...current, inspection]);
        showMessage("Instrumento seleccionado", `${item.name} quedó en tu inventario. Revisa el conjunto antes de confirmar la preparación.`, "info");
      }
      markProgress();
      synthSound("beep");
      record(`select_${inspection}`, "seleccionado", item.name);
    } else {
      record(`leave_${inspection}`, "descartado", item.name);
      showMessage("Objeto descartado", item.useful ? "Puedes volver por él si cambias de decisión." : "Buena decisión: conserva espacio para instrumentos pertinentes.", "info");
    }
    setInspection(null);
  };

  const dropTool = (id: string) => {
    if (step !== 2) return;
    setTools((current) => current.filter((tool) => tool !== id));
    showMessage("Instrumento devuelto", `${items[id].name} volvió a la zona de herramientas.`, "info");
    record(`drop_${id}`, "descartado", items[id].name);
  };

  const confirmPreparation = () => {
    const safe = ["goggles", "gloves"].every((id) => epp.includes(id));
    const diagnosticSet = tools.length === 2 && tools.every((id) => items[id].useful);
    setPreparationReviewOpen(false);
    if (safe && diagnosticSet) {
      setStageComplete(2);
      markProgress();
      showMessage("Preparación verificada", "El conjunto permite protegerte, leer el sistema y medir señales.", "success");
      record("step_2_complete", "logrado", "seleccion_confirmada");
      return;
    }
    setMistakes((value) => value + 1);
    setAnalysisPause("La selección aún no permite obtener toda la evidencia necesaria. Revisa qué funciones técnicas debes cubrir antes de continuar.");
    record("step_2_review", "requiere_revision", tools.join(","));
  };

  const requestHint = () => {
    const next = Math.min(4, helpLevel + 1);
    const hint = mentorHint(next, step);
    setHelpLevel(next);
    setMaxHelpLevel((current) => Math.max(current, next));
    setHintsUsed((current) => current + 1);
    setVisibleHint(hint);
    showMessage(`Mentor TP · Ayuda ${next}/4`, hint, "info");
    record(`mentor_help_${next}`, "apoyo_solicitado", `paso_${step}`);
  };

  const continueToNextStage = () => {
    if (!stageComplete || stageComplete >= 5) return;
    const next = stageComplete + 1;
    setStageComplete(null);
    setStep(next);
    setBriefingOpen(true);
    setHelpLevel(0);
    setVisibleHint(null);
    lastProgressRef.current = Date.now();
    record(`step_${next}_briefing`, "presentado", stageGuides[next].mode);
  };

  const restart = () => {
    setStep(0);
    setElapsed(0);
    setChecks({ npc: false, vehicle: false });
    setEpp([]);
    setTools([]);
    setEvidence([]);
    setNearby(null);
    setInspection(null);
    setRepaired(false);
    setEngineRunning(false);
    setCompleted(false);
    setMistakes(0);
    setHelpLevel(0);
    setMaxHelpLevel(0);
    setHintsUsed(0);
    setBriefingOpen(false);
    setStageComplete(null);
    setHelpOpen(false);
    setObjectiveOpen(false);
    setVisibleHint(null);
    setPendingDecision(null);
    setDecisionAttempts(0);
    setPreparationReviewOpen(false);
    setAnalysisPause(null);
    setPaused(false);
    setNavigation(null);
    setReflection("");
    telemetryRef.current = [];
    setResetToken((value) => value + 1);
  };

  const touchKey = (code: string, down: boolean) => {
    window.dispatchEvent(new KeyboardEvent(down ? "keydown" : "keyup", { code, bubbles: true }));
  };

  const score = useMemo(() => ({
    Seguridad: epp.length === 2 ? 100 : 55,
    Investigación: Math.round((evidence.length / 3) * 100),
    Decisión: Math.max(55, 100 - mistakes * 18),
    Procedimiento: repaired && engineRunning ? 100 : repaired ? 75 : 35,
    Autonomía: Math.max(40, 100 - maxHelpLevel * 12 - Math.min(hintsUsed, 4) * 3),
  }), [engineRunning, epp.length, evidence.length, hintsUsed, maxHelpLevel, mistakes, repaired]);

  const missionStarted = step > 0;
  const evidenceLabels = [
    ["manual", "Especificaciones del fabricante"],
    ["compression", "Compresión cilindro 4: 7,2 bar"],
    ["clearance", "Holgura admisión: 0,05 mm"],
  ];
  const currentInstruction = useMemo(() => {
    if (step === 1) return checks.vehicle || checks.npc ? "Completa el reconocimiento con otra fuente de información." : "Dirígete a la bahía y reúne el contexto de la falla.";
    if (step === 2) return "Inspecciona los elementos y prepara el conjunto que consideres necesario.";
    if (step === 3) return evidence.length === 0 ? "Obtén una primera evidencia técnica." : evidence.length < 3 ? "Relaciona el hallazgo y busca otra evidencia." : "Compara las tres evidencias reunidas.";
    if (step === 4) return "Elige la intervención mejor respaldada por las evidencias.";
    if (step === 5) return engineRunning ? "Repite la prueba de compresión y registra el resultado." : "Comprueba el funcionamiento del motor.";
    return objectives[0];
  }, [checks.npc, checks.vehicle, engineRunning, evidence.length, step]);

  const currentHow = useMemo(() => {
    if (step <= 2) return stageGuides[step]?.how || "Sigue la indicación visible.";
    if (step === 3) return "Recorre el taller y utiliza los recursos preparados. Tú decides el orden.";
    if (step === 4) return "Acércate a una ruta, selecciónala y confirma tu decisión.";
    return "Aplica la secuencia aprendida y usa Ayuda solo si la necesitas.";
  }, [step]);

  const mentorCopy = step <= 2
    ? ["Te oriento en el recorrido", "Siempre sabrás dónde ir y cómo interactuar; la selección técnica es tuya."]
    : step === 3
      ? ["Ahora relacionas la evidencia", "Tú eliges el recorrido; puedo darte pistas si las solicitas."]
      : ["Es tu turno de decidir", "La ayuda sigue disponible, pero la decisión técnica es tuya."];
  const completedTargets = useMemo(() => [
    checks.npc ? "npc" : "",
    checks.vehicle ? "vehicle" : "",
    ...epp,
    ...tools,
    evidence.includes("manual") ? "manual" : "",
    evidence.includes("compression") ? "compression_test" : "",
    evidence.includes("clearance") ? "valve_clearance" : "",
    repaired ? "valve_adjustment" : "",
    engineRunning ? "ignition" : "",
  ].filter(Boolean), [checks.npc, checks.vehicle, engineRunning, epp, evidence, repaired, tools]);
  const preparationFilled = epp.length === 2 && tools.length === 2;

  return (
    <main className="app-shell">
      <aside className="side-rail" aria-label="Navegación principal">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true"><GraduationCap size={27} /><Wrench size={15} /></div>
          <div><strong>Aula TP Chile</strong><span>Formación técnica con sentido</span></div>
        </div>
        <nav className="nav-stack">
          {nav.map(([Icon, label]) => (
            <button className={label === "Misión Laboral 3D" ? "nav-item active" : "nav-item"} key={label} type="button">
              <Icon size={20} /><span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="game-stage">
        <WorkshopScene
          active={missionStarted && !paused && !completed && !inspection && !briefingOpen && !stageComplete && !helpOpen && !objectiveOpen && !pendingDecision && !preparationReviewOpen && !analysisPause}
          currentStep={step}
          helpLevel={helpLevel}
          engineRunning={engineRunning}
          completedTargets={completedTargets}
          actionPulse={pulse}
          resetToken={resetToken}
          onNearbyChange={setNearby}
          onNavigationChange={setNavigation}
        />

        <header className="module-strip">
          <div className="module-icon"><Settings size={25} /></div>
          <div><span>MÓDULO 01</span><strong>Ajuste de motores</strong></div>
          <div className="module-course">Mecánica Automotriz · 3° Medio TP</div>
        </header>

        {!missionStarted ? (
          <section className="mission-card" aria-labelledby="mission-title">
            <div className="mission-card-top">
              <div className="target-disc"><Target size={31} /></div>
              <div><span>TU MISIÓN</span><h1 id="mission-title">Compresión perdida</h1></div>
            </div>
            <p>Eres parte del equipo técnico. El motor perdió potencia y presenta un ralentí inestable: mide sus condiciones mecánicas, compara con el manual y realiza el ajuste justificado.</p>
            <div className="mission-meta">
              <span><Clock3 size={18} /> Tiempo orientativo: 10 minutos</span>
              <span><CircleGauge size={18} /> El tiempo orienta; no provoca fracaso</span>
              <span><ShieldCheck size={18} /> OA 4 · AE 1 · Criterios 1.1, 1.4 y 1.5</span>
            </div>
            <div className="control-strip"><span><kbd>WASD</kbd> mover</span><span><kbd>E</kbd> interactuar</span><span><kbd>C</kbd> agacharse</span><span><kbd>ESC</kbd> pausa</span></div>
            <button className="start-button" type="button" onClick={startMission}>
              <Play size={22} fill="currentColor" /> INICIAR MISIÓN <ChevronRight size={24} />
            </button>
          </section>
        ) : (
          <section className="objective-card" aria-live="polite">
            <div className="objective-heading">
              <span>PASO {step}/5</span>
              <div className="objective-actions">
                <button type="button" className="hint-button" onClick={() => setObjectiveOpen(true)}><Target size={15} /> Objetivo</button>
                <button type="button" className="hint-button" onClick={() => setHelpOpen(true)}><CircleHelp size={16} /> Ayuda</button>
              </div>
            </div>
            <span className={`guidance-mode ${step <= 2 ? "guided" : step === 3 ? "supported" : "independent"}`}>{stageGuides[step].mode}</span>
            <strong>{currentInstruction}</strong>
            <p><b>Cómo:</b> {currentHow}</p>
            <div className="mission-route" aria-label={`Progreso: etapa ${step} de 5, ${step * 20}% completado`}>
              {routeLabels.map((label, index) => {
                const value = index + 1;
                return <span key={label} className={value < step ? "done" : value === step ? "current" : ""} title={label}>{value < step ? <Check size={12} /> : value}<small>{label}</small></span>;
              })}
            </div>
            {step === 2 && preparationFilled && <button type="button" className="review-selection" onClick={() => setPreparationReviewOpen(true)}><ClipboardCheck size={16} /> Revisar selección</button>}
          </section>
        )}

        {missionStarted && (
          <>
            <section className="equipment-panel">
              <div className="panel-title"><Backpack size={17} /><span>EQUIPO {tools.length}/2</span></div>
              <div className="slots">
                {[0, 1].map((slot) => {
                  const id = tools[slot];
                  return <button key={slot} type="button" disabled={!id || step !== 2} onClick={() => id && dropTool(id)} title={id && step === 2 ? "Devolver instrumento" : undefined} className={id ? "filled" : ""}>{id ? items[id].name : "Vacío"}</button>;
                })}
              </div>
              <div className="epp-row">
                <span className={epp.includes("goggles") ? "ready" : ""}><Glasses size={17} />{epp.includes("goggles") && <Check size={12} />}</span>
                <span className={epp.includes("gloves") ? "ready" : ""}><Hand size={17} />{epp.includes("gloves") && <Check size={12} />}</span>
              </div>
            </section>

            <section className="evidence-panel">
              <div className="panel-title"><Microscope size={17} /><span>EVIDENCIAS {evidence.length}/3</span></div>
              {evidenceLabels.map(([id, label]) => <div key={id} className={evidence.includes(id) ? "evidence found" : "evidence"}><span>{evidence.includes(id) ? <Check size={12} /> : "?"}</span>{evidence.includes(id) ? label : "Por descubrir"}</div>)}
            </section>
          </>
        )}

        {missionStarted && navigation && !completed && (
          <section className={`destination-card step-${step}`} aria-live="polite">
            <div className="destination-arrow" style={{ transform: `rotate(${navigation.angle}rad)` }}><ChevronUp size={22} /></div>
            <div><span>DESTINO</span><strong>{navigation.label}</strong><small>{navigation.distance <= 1 ? "Has llegado" : `${navigation.distance} m`}</small></div>
          </section>
        )}

        {missionStarted && nearby && !paused && !inspection && !completed && !briefingOpen && !stageComplete && !helpOpen && !objectiveOpen && !pendingDecision && !preparationReviewOpen && !analysisPause && (
          <button type="button" className="interaction-prompt" onClick={() => handleInteract(nearby)}>
            <kbd>E</kbd><span>{targetLabels[nearby]}</span>
          </button>
        )}

        {toast && (
          <output className={`game-toast ${toast.tone}`} aria-live="polite">
            {toast.tone === "success" ? <CheckCircle2 size={23} /> : toast.tone === "warning" ? <AlertTriangle size={23} /> : <Volume2 size={23} />}
            <div><strong>{toast.title}</strong><span>{toast.body}</span></div>
            <button type="button" onClick={() => setToast(null)} aria-label="Cerrar mensaje"><X size={17} /></button>
          </output>
        )}

        <section className="mentor-card">
          <div className="mentor-avatar">TP</div>
          <div><span>Mentor TP</span><strong>{missionStarted ? mentorCopy[0] : "Bienvenido al equipo"}</strong><p>{missionStarted ? mentorCopy[1] : "Revisa la misión y comienza cuando estés listo."}</p></div>
        </section>

        <div className="status-ribbon">
          <div><Target size={17} /><span>MISIÓN</span><strong>Recuperar la compresión</strong></div>
          <div><Map size={17} /><span>PROGRESO</span><strong>{step}/5 · {step * 20}% · {stepNames[step]}</strong></div>
          <div><Microscope size={17} /><span>EVIDENCIAS</span><strong>{evidence.length}/3</strong></div>
          <div><Clock3 size={17} /><span>TIEMPO</span><strong>{formatTime(elapsed)}</strong></div>
        </div>

        {missionStarted && briefingOpen && (
          <div className="modal-backdrop pedagogical-backdrop">
            <section className="guide-dialog" role="dialog" aria-modal="true" aria-labelledby="guide-title">
              <div className="guide-kicker"><span>{stageGuides[step].mode}</span><strong>ETAPA {step} DE 5 · {stageGuides[step].time}</strong></div>
              <h2 id="guide-title">{stageGuides[step].title}</h2>
              <div className="guide-block information"><span>¿QUÉ DEBES HACER?</span><p>{stageGuides[step].brief}</p></div>
              <div className="guide-block attention"><span>¿CÓMO DEBES HACERLO?</span><p>{stageGuides[step].how}</p></div>
              <p className="guide-why"><strong>¿Por qué?</strong> {stageGuides[step].why}</p>
              <button type="button" className="primary-action guide-start" onClick={() => {
                setBriefingOpen(false);
                markProgress();
                record(`step_${step}_instruction_acknowledged`, "comprendida", stageGuides[step].mode);
              }}>{step <= 2 ? "ENTENDIDO, COMENZAR" : "COMENZAR ETAPA"}<ChevronRight size={19} /></button>
            </section>
          </div>
        )}

        {paused && (
          <div className="modal-backdrop pause-backdrop">
            <section className="guide-dialog pause-dialog" role="dialog" aria-modal="true" aria-labelledby="pause-title">
              <div className="pause-icon"><Pause size={30} /></div>
              <span className="dialog-eyebrow">MISIÓN EN PAUSA</span>
              <h2 id="pause-title">Compresión perdida</h2>
              <p>Tu avance permanece guardado. Continúa cuando estés listo para retomar el diagnóstico.</p>
              <button type="button" className="primary-action guide-start" onClick={() => setPaused(false)}><Play size={18} fill="currentColor" /> CONTINUAR MISIÓN</button>
              <button type="button" className="secondary-action pause-restart" onClick={restart}><RotateCcw size={17} /> REINICIAR MISIÓN</button>
            </section>
          </div>
        )}

        {objectiveOpen && (
          <div className="modal-backdrop pedagogical-backdrop">
            <section className="guide-dialog compact-dialog" role="dialog" aria-modal="true" aria-labelledby="objective-title">
              <button type="button" className="dialog-close" onClick={() => setObjectiveOpen(false)} aria-label="Cerrar"><X size={18} /></button>
              <div className="item-icon"><Target size={30} /></div>
              <span className="dialog-eyebrow">OBJETIVO DE LA MISIÓN</span>
              <h2 id="objective-title">Diagnosticar y ajustar el motor</h2>
              <p>Completa el diagnóstico en orden: comprende la falla, prepara una intervención segura, reúne evidencia, decide con fundamento y comprueba el resultado.</p>
              <div className="objective-sequence">Observar <ChevronRight size={14} /> Analizar <ChevronRight size={14} /> Actuar <ChevronRight size={14} /> Verificar</div>
              <button type="button" className="primary-action guide-start" onClick={() => setObjectiveOpen(false)}>VOLVER A LA MISIÓN</button>
            </section>
          </div>
        )}

        {helpOpen && (
          <div className="modal-backdrop pedagogical-backdrop">
            <section className="guide-dialog compact-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title">
              <button type="button" className="dialog-close" onClick={() => setHelpOpen(false)} aria-label="Cerrar"><X size={18} /></button>
              <div className="guide-kicker"><span>{stageGuides[step].mode}</span><strong>AYUDA RECUPERABLE</strong></div>
              <h2 id="help-title">Qué hacer ahora</h2>
              <div className="guide-block information"><span>OBJETIVO ACTUAL</span><p>{currentInstruction}</p></div>
              <div className="guide-block attention"><span>CÓMO INTERACTUAR</span><p>{currentHow}</p></div>
              {visibleHint && <div className="guide-block hint-reveal"><span>PISTA {helpLevel}/4</span><p>{visibleHint}</p></div>}
              <div className="dialog-actions help-actions">
                <button type="button" className="secondary-action" onClick={() => setHelpOpen(false)}>Volver</button>
                <button type="button" className="primary-action" onClick={requestHint}><Lightbulb size={17} /> Necesito una pista</button>
              </div>
            </section>
          </div>
        )}

        {preparationReviewOpen && (
          <div className="modal-backdrop pedagogical-backdrop">
            <section className="guide-dialog compact-dialog" role="dialog" aria-modal="true" aria-labelledby="preparation-title">
              <button type="button" className="dialog-close" onClick={() => setPreparationReviewOpen(false)} aria-label="Cerrar"><X size={18} /></button>
              <div className="item-icon"><Backpack size={30} /></div>
              <span className="dialog-eyebrow">REVISAR SELECCIÓN</span>
              <h2 id="preparation-title">¿Tu preparación cubre todo lo necesario?</h2>
              <p>Comprueba que tu selección permita trabajar con seguridad, obtener información del sistema y realizar mediciones.</p>
              <div className="selection-review">
                {[...epp, ...tools].map((id) => <span key={id}>{items[id].name}</span>)}
              </div>
              <div className="dialog-actions">
                <button type="button" className="secondary-action" onClick={() => setPreparationReviewOpen(false)}>Seguir revisando</button>
                <button type="button" className="primary-action" onClick={confirmPreparation}>Confirmar preparación</button>
              </div>
            </section>
          </div>
        )}

        {analysisPause && (
          <div className="modal-backdrop pedagogical-backdrop">
            <section className="guide-dialog compact-dialog analysis-dialog" role="dialog" aria-modal="true" aria-labelledby="analysis-title">
              <div className="analysis-icon"><AlertTriangle size={29} /></div>
              <span className="dialog-eyebrow">REVISA EL PROCEDIMIENTO</span>
              <h2 id="analysis-title">Analiza antes de volver a intentar</h2>
              <p>{analysisPause}</p>
              <div className="dialog-actions help-actions">
                <button type="button" className="secondary-action" onClick={() => setAnalysisPause(null)}>Revisar procedimiento</button>
                <button type="button" className="primary-action" onClick={() => { setAnalysisPause(null); setHelpOpen(true); }}><Lightbulb size={17} /> Solicitar pista</button>
              </div>
            </section>
          </div>
        )}

        {stageComplete && (
          <div className="modal-backdrop pedagogical-backdrop">
            <section className="guide-dialog stage-complete-dialog" role="dialog" aria-modal="true" aria-labelledby="stage-complete-title">
              <div className="stage-check"><CheckCircle2 size={32} /></div>
              <span className="dialog-eyebrow">ETAPA {stageComplete} COMPLETADA</span>
              <h2 id="stage-complete-title">{stageGuides[stageComplete].title}</h2>
              <div className="guide-block success-block"><span>LO QUE ACABAS DE REALIZAR</span><p>{stageGuides[stageComplete].completed}</p></div>
              <p className="guide-why"><strong>¿Por qué era importante?</strong> {stageGuides[stageComplete].why}</p>
              <div className="next-stage"><span>SIGUIENTE ETAPA</span><strong>{stageGuides[stageComplete].next}</strong></div>
              <button type="button" className="primary-action guide-start" onClick={continueToNextStage}>CONTINUAR MISIÓN <ChevronRight size={19} /></button>
            </section>
          </div>
        )}

        {pendingDecision && (
          <div className="modal-backdrop pedagogical-backdrop">
            <section className="guide-dialog decision-dialog" role="dialog" aria-modal="true" aria-labelledby="decision-title">
              <div className="item-icon"><ClipboardCheck size={30} /></div>
              <span className="dialog-eyebrow">VERIFICA ANTES DE ACTUAR</span>
              <h2 id="decision-title">¿Confirmas esta intervención?</h2>
              <div className="selected-decision">{targetLabels[pendingDecision]}</div>
              <p>Antes de confirmar, comprueba que esta decisión explique simultáneamente la compresión de 7,2 bar y la holgura de admisión de 0,05 mm.</p>
              <div className="dialog-actions">
                <button type="button" className="secondary-action" onClick={() => setPendingDecision(null)}>Revisar evidencias</button>
                <button type="button" className="primary-action" onClick={() => applyDecision(pendingDecision)}>Confirmar decisión</button>
              </div>
            </section>
          </div>
        )}

        {inspection && (
          <div className="modal-backdrop" role="presentation">
            <section className="item-dialog" role="dialog" aria-modal="true" aria-labelledby="item-title">
              <button type="button" className="dialog-close" onClick={() => setInspection(null)} aria-label="Cerrar"><X size={18} /></button>
              <div className="item-icon">{items[inspection].kind === "epp" ? <ShieldCheck size={31} /> : <Wrench size={31} />}</div>
              <span>{items[inspection].kind === "epp" ? "EQUIPO DE PROTECCIÓN" : "HERRAMIENTA"}</span>
              <h2 id="item-title">{items[inspection].name}</h2>
              <p>{items[inspection].description}</p>
              <strong>Comprueba su función: ¿lo necesitas en esta etapa?</strong>
              <div className="dialog-actions">
                <button type="button" className="secondary-action" onClick={() => chooseItem(false)}>Dejar</button>
                <button type="button" className="primary-action" onClick={() => chooseItem(true)}>Confirmar selección</button>
              </div>
            </section>
          </div>
        )}

        {completed && (
          <div className="modal-backdrop completion-backdrop">
            <section className="completion-dialog" role="dialog" aria-modal="true" aria-labelledby="completion-title">
              <div className="completion-heading"><div><CheckCircle2 size={34} /></div><span>MISIÓN CUMPLIDA</span></div>
              <h2 id="completion-title">El vehículo vuelve a estar operativo</h2>
              <p>Identificaste, investigaste, decidiste, actuaste y comprobaste el resultado.</p>
              <div className="score-grid">
                {Object.entries(score).map(([label, value]) => (
                  <div className="score-row" key={label}><span>{label}</span><div><i style={{ width: `${value}%` }} /></div><strong>{value}%</strong></div>
                ))}
              </div>
              <div className="learning-summary">
                <strong>Procedimiento realizado</strong>
                <div className="completed-route">{routeLabels.map((label) => <span key={label}><Check size={12} />{label}</span>)}</div>
                <p><b>Informe técnico:</b> baja compresión en el cilindro 4 asociada a holgura insuficiente en la válvula de admisión. Se ajustó a 0,20 mm y la compresión final alcanzó 10,8 bar.</p>
                <p><b>Decisiones correctas:</b> reuniste evidencia antes de intervenir y verificaste el resultado.</p>
                <p><b>Aspectos que necesitaste revisar:</b> {mistakes || hintsUsed ? `${mistakes} decisiones revisadas y ${hintsUsed} pistas solicitadas.` : "completaste el procedimiento sin correcciones ni pistas."}</p>
                <p><b>Lo que aprendiste:</b> el diagnóstico del motor se fundamenta comparando el manual, las mediciones de sus componentes y su condición real.</p>
              </div>
              <label className="reflection-field">¿Qué decisión consideras más importante durante el procedimiento y por qué?
                <textarea value={reflection} onChange={(event) => setReflection(event.target.value)} placeholder="Escribe una reflexión breve..." />
              </label>
              <div className="professional-transfer"><strong>EN EL CONTEXTO REAL</strong><p>El orden, la seguridad y la verificación evitan reemplazos innecesarios y permiten entregar un vehículo técnicamente comprobado.</p></div>
              <div className="completion-meta"><Clock3 size={16} /> Tiempo: {formatTime(elapsed)} <span /> <Gauge size={16} /> Ayuda máxima: {maxHelpLevel}/4</div>
              <button type="button" className="restart-button" onClick={restart}><RotateCcw size={18} /> Volver a jugar</button>
            </section>
          </div>
        )}

        {missionStarted && !completed && (
          <div className="mobile-controls" aria-label="Controles táctiles">
            <div className="dpad">
              <button type="button" aria-label="Avanzar" onPointerDown={() => touchKey("KeyW", true)} onPointerUp={() => touchKey("KeyW", false)}><ChevronUp /></button>
              <button type="button" aria-label="Izquierda" onPointerDown={() => touchKey("KeyA", true)} onPointerUp={() => touchKey("KeyA", false)}><ChevronLeft /></button>
              <button type="button" aria-label="Retroceder" onPointerDown={() => touchKey("KeyS", true)} onPointerUp={() => touchKey("KeyS", false)}><ChevronDown /></button>
              <button type="button" aria-label="Derecha" onPointerDown={() => touchKey("KeyD", true)} onPointerUp={() => touchKey("KeyD", false)}><ChevronRight /></button>
            </div>
            <button type="button" className="touch-action" disabled={!nearby} onClick={() => nearby && handleInteract(nearby)}><Hand size={22} /><span>Interactuar</span></button>
          </div>
        )}

        {missionStarted && step <= 2 && <div className="desktop-controls"><Footprints size={15} /> WASD mover · Shift rápido · C/Ctrl agacharse · arrastrar para mirar · E interactuar · Esc pausa <MousePointer2 size={15} /></div>}
      </section>
    </main>
  );
}
