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
    1: ["", "Observa nuevamente el vehículo y a las personas del taller.", "Recorre la zona de herramientas y revisa cada objeto.", "Piensa qué información necesitas antes de intervenir.", "Relaciona el código, el valor esperado y tu medición.", "Comprueba el resultado con el mismo instrumento de diagnóstico."],
    2: ["", "Hay dos fuentes iniciales de información: el técnico y el vehículo.", "Necesitas protección personal y dos instrumentos que entreguen evidencia electrónica.", "Busca un código, una especificación del fabricante y una medición real.", "La evidencia apunta a una señal de posición ausente.", "Arranca el motor y verifica que el código no vuelva a aparecer."],
    3: ["", "La bahía de diagnóstico queda resaltada temporalmente.", "La zona de herramientas queda resaltada temporalmente.", "Revisa la oficina técnica y ambos puntos de diagnóstico del vehículo.", "Acércate al frente del motor: hay tres rutas físicas de intervención.", "Acércate al puesto del conductor y luego al puerto OBD-II."],
    4: ["", "Inspecciona el vehículo y conversa con Mateo para completar el contexto.", "Equípate con lentes y guantes; selecciona scanner y multímetro.", "Lee el DTC, consulta el valor del manual y mide la señal CKP.", "Asegura el conector del sensor que entrega la señal fuera de rango.", "Enciende el motor y vuelve a escanear para cerrar el diagnóstico."],
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
      const nextLevel = idle >= 125 ? 4 : idle >= 95 ? 3 : idle >= 65 ? 2 : idle >= 35 ? 1 : 0;
      if (nextLevel > helpLevelRef.current) {
        setHelpLevel(nextLevel);
        showMessage(`Mentor TP · Ayuda ${nextLevel}/4`, mentorHint(nextLevel, stepRef.current), "info");
        record(`mentor_help_${nextLevel}`, "apoyo_entregado", `paso_${stepRef.current}`);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [completed, record, showMessage, step]);

  useEffect(() => {
    if (step === 1 && checks.npc && checks.vehicle) {
      setStep(2);
      markProgress();
      showMessage("Paso 1 completado", "Ya comprendes la situación. Selecciona lo necesario para diagnosticarla.", "success");
      record("step_1_complete", "logrado", "contexto_completo");
    }
  }, [checks, markProgress, record, showMessage, step]);

  useEffect(() => {
    const ready = ["goggles", "gloves"].every((id) => epp.includes(id)) && ["scanner", "multimeter"].every((id) => tools.includes(id));
    if (step === 2 && ready) {
      setStep(3);
      markProgress();
      showMessage("Equipo preparado", "Busca evidencias. Puedes elegir el orden de investigación.", "success");
      record("step_2_complete", "logrado", "epp_y_equipo_pertinente");
    }
  }, [epp, markProgress, record, showMessage, step, tools]);

  useEffect(() => {
    if (step === 3 && evidence.length === 3) {
      setStep(4);
      markProgress();
      showMessage("Tres evidencias relacionadas", "Decide qué componente debes intervenir y acércate físicamente.", "success");
      record("step_3_complete", "logrado", evidence.join(","));
    }
  }, [evidence, markProgress, record, showMessage, step]);

  useEffect(() => {
    if (step === 4 && repaired) {
      setStep(5);
      markProgress();
      showMessage("Intervención realizada", "Comprueba si el motor arranca y verifica el sistema antes de cerrar.", "success");
      record("step_4_complete", "logrado", "conector_ckp_asegurado");
    }
  }, [markProgress, record, repaired, showMessage, step]);

  const startMission = () => {
    startedAtRef.current = Date.now();
    lastProgressRef.current = Date.now();
    setStep(1);
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
      if (id === "fuel_pump") {
        setMistakes((value) => value + 1);
        showMessage("Consecuencia", "La presión de combustible permanece estable. Esta intervención no explica la señal ausente.", "warning");
        synthSound("warning");
        record("decision_fuel_pump", "sin_informacion_util", "presion_estable");
      } else if (id === "ecu") {
        setMistakes((value) => value + 1);
        showMessage("Intervención bloqueada", "No existe evidencia suficiente para intervenir la unidad de control. Revisa tus hallazgos.", "warning");
        synthSound("warning");
        record("decision_ecu", "bloqueada_por_seguridad", "sin_evidencia_ecu");
      } else if (id === "ckp_connector") {
        setRepaired(true);
        markProgress();
        showMessage("Conector CKP asegurado", "El terminal estaba parcialmente liberado. Limpiaste, ajustaste y verificaste su fijación.", "success");
        synthSound("beep");
        record("decision_ckp_connector", "intervencion_correcta", "terminal_reajustado");
      }
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
      if (event.code === "KeyE" && !event.repeat && nearby && !inspection && !completed) handleInteract(nearby);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [completed, handleInteract, inspection, nearby]);

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
    setHelpLevel(next);
    showMessage(`Mentor TP · Ayuda ${next}/4`, mentorHint(next, step), "info");
    record(`mentor_help_${next}`, "apoyo_solicitado", `paso_${step}`);
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
    Autonomía: Math.max(40, 100 - helpLevel * 15),
  }), [engineRunning, epp.length, evidence.length, helpLevel, mistakes, repaired]);

  const missionStarted = step > 0;
  const evidenceLabels = [
    ["dtc", "DTC P0335"],
    ["manual", "Rango 0,4–1,2 V CA"],
    ["measurement", "Medición 0,08 V CA"],
  ];

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
          active={missionStarted && !completed && !inspection}
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
              <button type="button" className="hint-button" onClick={requestHint} aria-label="Solicitar ayuda del Mentor TP"><Lightbulb size={17} /> Pista</button>
            </div>
            <strong>{stepNames[step]}</strong>
            <p>{engineRunning && step === 5 ? "El motor está operativo. Vuelve al puerto OBD-II y comprueba que el código no reaparezca." : objectives[step]}</p>
            <div className="step-pips" aria-label={`Progreso: paso ${step} de 5`}>
              {[1, 2, 3, 4, 5].map((value) => <span key={value} className={value < step ? "done" : value === step ? "current" : ""}>{value < step ? <Check size={12} /> : value}</span>)}
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

        {missionStarted && nearby && !inspection && !completed && (
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
          <div><span>Mentor TP</span><strong>{missionStarted ? "No estás solo en el taller" : "Bienvenido al equipo"}</strong><p>{missionStarted ? "Te orientaré si dejas de progresar, sin resolver la misión por ti." : "Revisa la misión y comienza cuando estés listo."}</p></div>
        </section>

        <div className="status-ribbon">
          <div><Target size={17} /><span>MISIÓN</span><strong>Restablecer el encendido</strong></div>
          <div><Map size={17} /><span>PASO</span><strong>{step}/5 · {stepNames[step]}</strong></div>
          <div><Microscope size={17} /><span>EVIDENCIAS</span><strong>{evidence.length}/3</strong></div>
          <div><Clock3 size={17} /><span>TIEMPO</span><strong>{formatTime(elapsed)}</strong></div>
        </div>

        {inspection && (
          <div className="modal-backdrop" role="presentation">
            <section className="item-dialog" role="dialog" aria-modal="true" aria-labelledby="item-title">
              <button type="button" className="dialog-close" onClick={() => setInspection(null)} aria-label="Cerrar"><X size={18} /></button>
              <div className="item-icon">{items[inspection].kind === "epp" ? <ShieldCheck size={31} /> : <Wrench size={31} />}</div>
              <span>{items[inspection].kind === "epp" ? "EQUIPO DE PROTECCIÓN" : "HERRAMIENTA"}</span>
              <h2 id="item-title">{items[inspection].name}</h2>
              <p>{items[inspection].description}</p>
              <strong>¿Lo necesitas para esta misión?</strong>
              <div className="dialog-actions">
                <button type="button" className="secondary-action" onClick={() => chooseItem(false)}>Dejar</button>
                <button type="button" className="primary-action" onClick={() => chooseItem(true)}>Agregar al equipo</button>
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
              <label className="reflection-field">¿Qué evidencia fue clave para tomar tu decisión?
                <textarea value={reflection} onChange={(event) => setReflection(event.target.value)} placeholder="Escribe una reflexión breve..." />
              </label>
              <div className="completion-meta"><Clock3 size={16} /> Tiempo: {formatTime(elapsed)} <span /> <Gauge size={16} /> Ayuda máxima: {helpLevel}/4</div>
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
