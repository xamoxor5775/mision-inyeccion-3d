"use client";

import {
  AlertTriangle,
  Award,
  Backpack,
  BookOpenCheck,
  Boxes,
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
  Home,
  Lightbulb,
  Map,
  Microscope,
  MousePointer2,
  Play,
  RotateCcw,
  ScanLine,
  Settings,
  ShieldCheck,
  Target,
  UserRound,
  UsersRound,
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
  [Home, "Inicio"],
  [Boxes, "Módulos"],
  [Map, "Estaciones"],
  [Gamepad2, "Misión Laboral 3D"],
  [BookOpenCheck, "Evaluación final"],
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
  scanner: {
    name: "Scanner OBD-II",
    kind: "tool",
    useful: true,
    description: "Lee códigos de diagnóstico y datos del sistema de control electrónico.",
  },
  multimeter: {
    name: "Multímetro digital",
    kind: "tool",
    useful: true,
    description: "Permite medir la señal eléctrica de sensores y comprobar el circuito.",
  },
  hammer: {
    name: "Martillo de goma",
    kind: "tool",
    useful: false,
    description: "Sirve para ajustes mecánicos suaves, pero no entrega información para este diagnóstico electrónico.",
  },
};

const targetLabels: Record<string, string> = {
  npc: "Hablar con Mateo",
  vehicle: "Inspeccionar el vehículo",
  goggles: "Revisar lentes de seguridad",
  gloves: "Revisar guantes de protección",
  scanner: "Revisar scanner OBD-II",
  multimeter: "Revisar multímetro",
  hammer: "Revisar martillo de goma",
  manual: "Consultar manual de servicio",
  obd: "Conectar scanner OBD-II",
  ckp_sensor: "Medir señal del sensor CKP",
  fuel_pump: "Intervenir bomba de combustible",
  ecu: "Intervenir unidad de control",
  ckp_connector: "Intervenir conector CKP",
  ignition: "Accionar el encendido",
};

const objectives = [
  "Revisa la misión antes de comenzar.",
  "Habla con Mateo e inspecciona el vehículo.",
  "Equípate y selecciona los instrumentos pertinentes.",
  "Reúne tres evidencias usando instrumentos y documentación.",
  "Interviene el componente coherente con las evidencias.",
  "Arranca el vehículo y comprueba el resultado con el scanner.",
];

const stepNames = ["Preparado", "Comprende y explora", "Reconoce y prepárate", "Investiga y relaciona", "Decide y actúa", "Comprueba y llega a la meta"];
const routeLabels = ["Contexto", "Equipo", "Evidencias", "Intervención", "Comprobación"];

const stageGuides: Record<number, StageGuide> = {
  1: {
    mode: "PRÁCTICA GUIADA",
    title: "Comprende la situación",
    brief: "Primero inspecciona el vehículo. Después conversa con Mateo para completar el contexto de la falla.",
    how: "Camina con WASD o los controles táctiles. Al acercarte, presiona E o el botón Interactuar.",
    why: "Un diagnóstico seguro comienza reuniendo información antes de utilizar instrumentos.",
    completed: "Inspeccionaste el vehículo y obtuviste el relato técnico de la falla.",
    next: "Preparar EPP e instrumentos",
  },
  2: {
    mode: "PRÁCTICA GUIADA",
    title: "Prepara tu intervención",
    brief: "Equípate con la protección necesaria y elige dos instrumentos capaces de producir evidencia electrónica.",
    how: "Acércate a cada objeto, inspecciónalo y confirma si lo agregarás. Puedes devolver un instrumento desde el inventario.",
    why: "Seleccionar EPP y herramientas pertinentes evita riesgos y reduce intervenciones innecesarias.",
    completed: "Elegiste el EPP y los instrumentos adecuados para un diagnóstico electrónico.",
    next: "Investigar y relacionar evidencias",
  },
  3: {
    mode: "PRÁCTICA CON APOYO",
    title: "Construye el diagnóstico",
    brief: "Reúne tres evidencias y relaciónalas: información del sistema, especificación técnica y medición real.",
    how: "Recorre el taller y utiliza la documentación y los instrumentos que preparaste. Tú eliges el orden.",
    why: "Una conclusión técnica válida debe comparar datos reales con especificaciones y códigos de diagnóstico.",
    completed: "Relacionaste el DTC P0335, el rango esperado y una señal CKP fuera de rango.",
    next: "Decidir e intervenir",
  },
  4: {
    mode: "PRÁCTICA AUTÓNOMA",
    title: "Decide con evidencia",
    brief: "Analiza tus hallazgos y decide qué intervención está mejor justificada. Ya no se destacará una respuesta específica.",
    how: "Acércate a una ruta de intervención, selecciónala y confirma tu decisión antes de actuar.",
    why: "En el trabajo real, intervenir sin evidencia puede generar costos, riesgos y nuevas fallas.",
    completed: "Interviniste el conector CKP porque la evidencia justificaba revisar su señal y continuidad.",
    next: "Comprobar el resultado",
  },
  5: {
    mode: "PRÁCTICA AUTÓNOMA",
    title: "Comprueba y cierra",
    brief: "Demuestra que la intervención resolvió la falla y verifica el sistema antes de cerrar la orden.",
    how: "Aplica el procedimiento aprendido. La ayuda sigue disponible, pero la secuencia debes decidirla tú.",
    why: "Una reparación solo se considera terminada cuando el resultado se comprueba con evidencia.",
    completed: "Confirmaste el encendido estable y verificaste que el DTC no reapareciera.",
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
    2: ["", "La condición del vehículo y el relato del técnico se complementan.", "Necesitas proteger ojos y manos, además de leer códigos y medir señales.", "Un diagnóstico sólido combina DTC, manual del fabricante y medición.", "Descarta las rutas que no explican una señal CKP de solo 0,08 V CA.", "Una comprobación funcional no reemplaza la verificación electrónica final."],
    3: ["", "Acércate primero al vehículo y luego a Mateo; ambos están en la bahía.", "Revisa el panel de EPP y las herramientas que producen datos eléctricos.", "Revisa la oficina técnica, el puerto OBD-II y el punto de medición CKP.", "Intervén el trayecto de la señal antes de considerar reemplazar módulos.", "Comprueba primero el funcionamiento y después revisa si reaparece el DTC."],
    4: ["", "Inspecciona el vehículo y conversa con Mateo para cerrar esta etapa.", "Equípate con lentes y guantes; lleva scanner OBD-II y multímetro.", "Obtén P0335, el rango 0,4–1,2 V CA y la medición de 0,08 V CA.", "La señal medida obliga a revisar la conexión CKP antes de intervenir otros sistemas.", "Acciona el encendido y vuelve al puerto OBD-II para cerrar la verificación."],
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
      oa_ae: "OA 6 · AE 3",
      criterio: actionId.includes("verify") ? "3.6" : "3.5",
      habilidad: actionId,
      concepto: "Diagnóstico del sistema de inyección y encendido electrónico",
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
    const ready = ["goggles", "gloves"].every((id) => epp.includes(id)) && ["scanner", "multimeter"].every((id) => tools.includes(id));
    if (step === 2 && ready && stageComplete !== 2) {
      setStageComplete(2);
      showMessage("Etapa completada", "Preparaste una intervención segura y pertinente.", "success");
      record("step_2_complete", "logrado", "epp_y_equipo_pertinente");
    }
  }, [epp, record, showMessage, stageComplete, step, tools]);

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
      record("step_4_complete", "logrado", "conector_ckp_asegurado");
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
    if (id === "ckp_connector") {
      setRepaired(true);
      markProgress();
      showMessage("Decisión verificada", "La señal CKP fuera de rango justifica revisar y asegurar su conexión antes de reemplazar componentes.", "success");
      synthSound("beep");
      record("decision_ckp_connector", "intervencion_correcta", "terminal_reajustado");
      return;
    }

    const attempt = decisionAttempts + 1;
    setDecisionAttempts(attempt);
    setMistakes((value) => value + 1);
    const feedback = attempt === 1
      ? "Esta ruta no explica completamente la señal CKP medida. Revisa la relación entre código, rango esperado y valor real."
      : attempt === 2
        ? "La presión de combustible y la unidad de control no tienen evidencia directa de falla. Concéntrate en el trayecto de la señal de posición."
        : "Antes de reemplazar sistemas, revisa la conexión del sensor CKP: el DTC y los 0,08 V CA indican una señal ausente o degradada.";
    showMessage(attempt === 1 ? "Revisa tu decisión" : attempt === 2 ? "Pista más específica" : "Explicación técnica", feedback, "warning");
    synthSound("warning");
    record(`decision_${id}`, "requiere_revision", `intento_${attempt}`);
  }, [decisionAttempts, markProgress, record, showMessage]);

  const handleInteract = useCallback((id: string) => {
    setPulse((value) => value + 1);
    if (stepRef.current === 1) {
      if (id === "npc") {
        setChecks((current) => ({ ...current, npc: true }));
        markProgress();
        showMessage("Mateo · Técnico", "El motor se detuvo al bajar las revoluciones. Desde entonces gira, pero no enciende.", "info");
        record("talk_npc", "informacion_obtenida", "falla_aparecio_en_marcha");
      }
      if (id === "vehicle") {
        setChecks((current) => ({ ...current, vehicle: true }));
        markProgress();
        showMessage("Inspección inicial", "No hay daños visibles. El arranque acciona y el indicador del motor permanece encendido.", "info");
        record("inspect_vehicle", "informacion_obtenida", "motor_gira_no_enciende");
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
        addEvidence("manual", "Evidencia 1 · Manual de servicio", "Para el CKP inductivo: señal esperada durante arranque entre 0,4 y 1,2 V CA.");
      } else if (id === "obd") {
        addEvidence("dtc", "Evidencia 2 · Scanner OBD-II", "DTC P0335 almacenado: circuito del sensor de posición del cigüeñal, señal ausente.");
      } else if (id === "ckp_sensor") {
        addEvidence("measurement", "Evidencia 3 · Medición", "Señal CKP durante arranque: 0,08 V CA. El valor está fuera del rango del fabricante.");
      }
      return;
    }
    if (stepRef.current === 4) {
      if (["fuel_pump", "ecu", "ckp_connector"].includes(id)) setPendingDecision(id);
      return;
    }
    if (stepRef.current === 5) {
      if (id === "ignition" && !engineRunning) {
        setEngineRunning(true);
        markProgress();
        showMessage("El motor enciende", "La intervención produjo un cambio real. Falta comprobar que el código no reaparezca.", "success");
        synthSound("engine");
        record("engine_start", "motor_operativo", "encendido_estable");
      } else if (id === "obd" && engineRunning) {
        setCompleted(true);
        markProgress();
        showMessage("Misión cumplida", "No hay códigos activos y la señal CKP es estable.", "success");
        synthSound("beep");
        record("verify_final", "mision_cumplida", "sin_dtc_activos");
      }
    }
  }, [addEvidence, engineRunning, markProgress, record, showMessage]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "KeyE" && !event.repeat && nearby && !inspection && !completed && !briefingOpen && !stageComplete && !helpOpen && !objectiveOpen && !pendingDecision) handleInteract(nearby);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [briefingOpen, completed, handleInteract, helpOpen, inspection, nearby, objectiveOpen, pendingDecision, stageComplete]);

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
        showMessage(item.useful ? "Instrumento agregado" : "Espacio ocupado", item.useful ? `${item.name} disponible en tu inventario.` : "Puedes llevarlo, pero no aporta evidencia para este diagnóstico.", item.useful ? "success" : "warning");
        if (!item.useful) {
          setMistakes((value) => value + 1);
          record(`select_${inspection}`, "seleccion_no_pertinente", item.name);
        }
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
    ["dtc", "DTC P0335"],
    ["manual", "Rango 0,4–1,2 V CA"],
    ["measurement", "Medición 0,08 V CA"],
  ];
  const currentInstruction = useMemo(() => {
    if (step === 1) return !checks.vehicle ? "Inspecciona primero el vehículo." : !checks.npc ? "Ahora conversa con Mateo." : "Revisa lo aprendido antes de continuar.";
    if (step === 2) {
      if (!epp.includes("goggles")) return "Equipa tus lentes de seguridad.";
      if (!epp.includes("gloves")) return "Equipa tus guantes de protección.";
      if (!tools.includes("scanner")) return "Selecciona un instrumento para leer el sistema electrónico.";
      if (!tools.includes("multimeter")) return "Selecciona un instrumento para medir la señal.";
      return "Comprueba que tu equipo esté completo.";
    }
    if (step === 3) return evidence.length === 0 ? "Obtén una primera evidencia técnica." : evidence.length < 3 ? "Relaciona el hallazgo y busca otra evidencia." : "Compara las tres evidencias reunidas.";
    if (step === 4) return "Elige la intervención mejor respaldada por las evidencias.";
    if (step === 5) return engineRunning ? "Verifica electrónicamente el resultado." : "Comprueba si el vehículo vuelve a encender.";
    return objectives[0];
  }, [checks.npc, checks.vehicle, engineRunning, epp, evidence.length, step, tools]);

  const currentHow = useMemo(() => {
    if (step <= 2) return stageGuides[step]?.how || "Sigue la indicación visible.";
    if (step === 3) return "Recorre el taller y utiliza los recursos preparados. Tú decides el orden.";
    if (step === 4) return "Acércate a una ruta, selecciónala y confirma tu decisión.";
    return "Aplica la secuencia aprendida y usa Ayuda solo si la necesitas.";
  }, [step]);

  const mentorCopy = step <= 2
    ? ["Te acompaño paso a paso", "La instrucción cambiará cuando completes cada acción."]
    : step === 3
      ? ["Ahora relacionas la evidencia", "Tú eliges el recorrido; puedo darte pistas si las solicitas."]
      : ["Es tu turno de decidir", "La ayuda sigue disponible, pero la decisión técnica es tuya."];

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
        <div className="profile-switch">
          <button type="button" className="profile active"><UserRound size={22} /><span>Estudiante</span></button>
          <button type="button" className="profile"><UsersRound size={22} /><span>Docente</span></button>
        </div>
      </aside>

      <section className="game-stage">
        <WorkshopScene
          active={missionStarted && !completed && !inspection && !briefingOpen && !stageComplete && !helpOpen && !objectiveOpen && !pendingDecision}
          currentStep={step}
          helpLevel={helpLevel}
          engineRunning={engineRunning}
          actionPulse={pulse}
          resetToken={resetToken}
          onNearbyChange={setNearby}
        />

        <header className="module-strip">
          <div className="module-icon"><Settings size={25} /></div>
          <div><span>MÓDULO 05</span><strong>Mantenimiento de sistemas eléctricos y electrónicos</strong></div>
          <div className="module-course">Mecánica Automotriz · 3° Medio TP</div>
        </header>

        {!missionStarted ? (
          <section className="mission-card" aria-labelledby="mission-title">
            <div className="mission-card-top">
              <div className="target-disc"><Target size={31} /></div>
              <div><span>TU MISIÓN</span><h1 id="mission-title">Señal perdida</h1></div>
            </div>
            <p>El motor gira, pero el vehículo no enciende. Investiga la causa, realiza una intervención segura y déjalo operativo.</p>
            <div className="mission-meta">
              <span><Clock3 size={18} /> Tiempo orientativo: 6 minutos</span>
              <span><CircleGauge size={18} /> El tiempo orienta; no provoca fracaso</span>
              <span><ShieldCheck size={18} /> OA 6 · AE 3 · Criterios 3.5 y 3.6</span>
            </div>
            <button className="start-button" type="button" onClick={startMission}>
              <Play size={22} fill="currentColor" /> COMENZAR MISIÓN <ChevronRight size={24} />
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

        {missionStarted && nearby && !inspection && !completed && !briefingOpen && !stageComplete && !helpOpen && !objectiveOpen && !pendingDecision && (
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
          <div><Target size={17} /><span>MISIÓN</span><strong>Restablecer el encendido</strong></div>
          <div><Map size={17} /><span>PROGRESO</span><strong>{step}/5 · {step * 20}% · {stepNames[step]}</strong></div>
          <div><Microscope size={17} /><span>EVIDENCIAS</span><strong>{evidence.length}/3</strong></div>
          <div><Clock3 size={17} /><span>TIEMPO</span><strong>{formatTime(elapsed)}</strong></div>
        </div>

        {missionStarted && briefingOpen && (
          <div className="modal-backdrop pedagogical-backdrop">
            <section className="guide-dialog" role="dialog" aria-modal="true" aria-labelledby="guide-title">
              <div className="guide-kicker"><span>{stageGuides[step].mode}</span><strong>ETAPA {step} DE 5</strong></div>
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

        {objectiveOpen && (
          <div className="modal-backdrop pedagogical-backdrop">
            <section className="guide-dialog compact-dialog" role="dialog" aria-modal="true" aria-labelledby="objective-title">
              <button type="button" className="dialog-close" onClick={() => setObjectiveOpen(false)} aria-label="Cerrar"><X size={18} /></button>
              <div className="item-icon"><Target size={30} /></div>
              <span className="dialog-eyebrow">OBJETIVO DE LA MISIÓN</span>
              <h2 id="objective-title">Restablecer el encendido</h2>
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
              <p>Antes de confirmar, comprueba que esta decisión explique simultáneamente el DTC P0335, el rango esperado y la medición de 0,08 V CA.</p>
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
                <p><b>Decisiones correctas:</b> reuniste evidencia antes de intervenir y verificaste el resultado.</p>
                <p><b>Aspectos que necesitaste revisar:</b> {mistakes || hintsUsed ? `${mistakes} decisiones revisadas y ${hintsUsed} pistas solicitadas.` : "completaste el procedimiento sin correcciones ni pistas."}</p>
                <p><b>Lo que aprendiste:</b> un DTC orienta, pero la decisión se fundamenta comparando manual, medición y condición real.</p>
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

        {missionStarted && <div className="desktop-controls"><Footprints size={15} /> WASD mover · Shift caminar rápido · arrastrar para mirar · E interactuar <MousePointer2 size={15} /></div>}
      </section>
    </main>
  );
}
