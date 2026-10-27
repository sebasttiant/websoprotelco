"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Building2,
  Cable,
  CircleCheck,
  Headset,
  Play,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { Container } from "@/components/ui/container";

interface FlowStep {
  id: string;
  label: string;
  detail: string;
  hint: string;
  ctaLabel: string;
  ctaHref: string;
  icon: LucideIcon;
}

const STEPS: readonly FlowStep[] = [
  {
    id: "need",
    label: "Proyecto",
    detail: "Identificamos qué red necesitás: acceso, campus, FTTx o backbone.",
    hint: "Alcance y entorno",
    ctaLabel: "Ver catálogo",
    ctaHref: "/productos",
    icon: Building2,
  },
  {
    id: "advice",
    label: "Asesoría",
    detail: "Un técnico te orienta sobre compatibilidad, pérdida y el equipo correcto.",
    hint: "Antes de comprar",
    ctaLabel: "Hablar con un asesor",
    ctaHref: "/contacto",
    icon: Headset,
  },
  {
    id: "gear",
    label: "Equipos",
    detail: "Fusionadoras, cortadoras, OTDR, conversores y kits con stock nacional.",
    hint: "Catálogo B2B",
    ctaLabel: "Ver equipos",
    ctaHref: "/productos",
    icon: Wrench,
  },
  {
    id: "field",
    label: "Campo",
    detail: "Empalme, medición y puesta en marcha con el kit adecuado para obra.",
    hint: "Instalación",
    ctaLabel: "Cotizar kit",
    ctaHref: "/contacto",
    icon: Cable,
  },
  {
    id: "link",
    label: "Enlace OK",
    detail: "Red operativa con soporte postventa y reposición cuando lo necesites.",
    hint: "Resultado",
    ctaLabel: "Pedir cotización",
    ctaHref: "/contacto",
    icon: CircleCheck,
  },
] as const;

const RUN_MS = 850;

export function FiberFlowPanel() {
  const [active, setActive] = useState(0);
  const [running, setRunning] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);

  const step = STEPS[active];
  const StepIcon = step.icon;
  const progress = ((active + 1) / STEPS.length) * 100;

  useEffect(() => {
    if (!running) return;

    if (active >= STEPS.length - 1) {
      const done = window.setTimeout(() => setRunning(false), RUN_MS);
      return () => window.clearTimeout(done);
    }

    const timer = window.setTimeout(() => {
      setActive((current) => Math.min(current + 1, STEPS.length - 1));
      setPulseKey((key) => key + 1);
    }, RUN_MS);

    return () => window.clearTimeout(timer);
  }, [running, active]);

  function selectStep(index: number) {
    setRunning(false);
    setActive(index);
    setPulseKey((key) => key + 1);
  }

  function startRun() {
    setActive(0);
    setPulseKey((key) => key + 1);
    setRunning(true);
  }

  return (
    <section className="border-b border-brand-line bg-white py-14 sm:py-16" aria-labelledby="fiber-flow-title">
      <Container>
        <div className="mb-8 max-w-2xl">
          <p className="mb-2 text-[0.65rem] font-black uppercase tracking-widest text-brand-blue">Del pedido al enlace</p>
          <h2 id="fiber-flow-title" className="text-balance text-2xl font-black tracking-tight text-brand-navy sm:text-3xl">
            Así acompañamos tu proyecto de fibra
          </h2>
          <p className="mt-3 text-sm font-medium leading-6 text-brand-muted sm:text-base sm:leading-7">
            Tocá cada etapa o dale a Ejecutar: verás el recorrido completo hasta dejar el enlace operativo.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-brand-blue/30 bg-white">
          <div className="flex flex-wrap items-center gap-3 border-b border-brand-blue/20 px-4 py-3 sm:px-5">
            <p className="hidden min-w-0 flex-1 truncate font-mono text-xs text-brand-muted sm:block">
              necesidad → asesoría → equipos → campo → enlace
            </p>
            <div className="ml-auto flex items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[0.6rem] font-black uppercase tracking-widest ${
                  running ? "bg-brand-blue/10 text-brand-blue" : "bg-brand-ice text-brand-muted"
                }`}
              >
                {running ? "Ejecutando" : "Listo"}
              </span>
              <button
                type="button"
                onClick={startRun}
                disabled={running}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-fiber px-3.5 py-2 text-[0.65rem] font-black uppercase tracking-widest text-brand-navy transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-55"
              >
                <Play aria-hidden="true" className="size-3.5 fill-current" />
                Ejecutar
              </button>
            </div>
          </div>

          <div className="h-1 bg-brand-ice" aria-hidden="true">
            <div
              className="h-full bg-brand-fiber transition-[width] duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="space-y-8 p-5 sm:p-6 lg:p-7">
            <ol className="flex flex-col gap-0 md:flex-row md:items-start md:justify-between">
              {STEPS.map((item, index) => {
                const Icon = item.icon;
                const isActive = index === active;
                const isDone = index < active;
                const isLast = index === STEPS.length - 1;

                return (
                  <li
                    key={item.id}
                    className="relative flex flex-col md:min-w-0 md:flex-1 md:flex-row md:items-start"
                  >
                    <button
                      type="button"
                      onClick={() => selectStep(index)}
                      aria-current={isActive ? "step" : undefined}
                      className={`group relative z-10 flex w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition md:mx-auto md:max-w-[8.5rem] md:flex-col md:items-center md:gap-2.5 md:border-0 md:bg-transparent md:px-1 md:py-0 md:text-center ${
                        isActive
                          ? "border-brand-blue bg-brand-ice md:bg-transparent"
                          : "border-brand-line bg-white hover:border-brand-blue/40 md:border-0"
                      }`}
                    >
                      <span
                        className={`relative grid size-10 shrink-0 place-items-center rounded-lg border transition md:size-12 ${
                          isActive
                            ? "border-brand-blue bg-brand-navy text-white"
                            : isDone
                              ? "border-brand-blue/40 bg-brand-blue text-white"
                              : "border-brand-line bg-brand-ice text-brand-muted group-hover:border-brand-blue/40 group-hover:text-brand-navy"
                        }`}
                      >
                        <Icon aria-hidden="true" className="size-4 md:size-5" />
                        {isActive ? (
                          <span
                            key={pulseKey}
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 rounded-[inherit] border border-brand-blue/50 motion-safe:animate-[fiber-ring_0.9s_ease-out_1]"
                          />
                        ) : null}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-black text-brand-navy">{item.label}</span>
                        <span className="mt-0.5 block text-[0.65rem] font-bold uppercase tracking-wider text-brand-muted md:mt-1 md:text-[0.6rem]">
                          {item.hint}
                        </span>
                      </span>
                      <span
                        className={`ml-auto size-2 shrink-0 rounded-full md:hidden ${
                          isActive ? "bg-brand-fiber" : "bg-brand-line"
                        }`}
                        aria-hidden="true"
                      />
                    </button>

                    {!isLast ? (
                      <div
                        className="relative mx-[1.2rem] h-4 w-px shrink-0 overflow-hidden bg-brand-line md:hidden"
                        aria-hidden="true"
                      >
                        <span
                          className={`absolute inset-x-0 top-0 w-full transition-all duration-500 ${
                            isDone || (running && isActive) ? "h-full bg-brand-fiber" : "h-0"
                          }`}
                        />
                      </div>
                    ) : null}

                    {!isLast ? (
                      <div
                        className="relative mt-6 hidden h-px min-w-[1.5rem] flex-1 overflow-hidden bg-brand-line md:block"
                        aria-hidden="true"
                      >
                        <span
                          className={`absolute inset-y-0 left-0 h-full transition-all duration-500 ease-out ${
                            isDone || (running && isActive) ? "w-full bg-brand-fiber" : "w-0"
                          }`}
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ol>

            <div
              key={step.id}
              className="rounded-2xl border border-brand-blue/25 bg-brand-ice/60 p-5 motion-safe:animate-[fade-up_0.45s_ease-out] sm:p-6"
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-brand-blue text-white">
                      <StepIcon aria-hidden="true" className="size-5" />
                    </span>
                    <div>
                      <p className="text-[0.65rem] font-black uppercase tracking-widest text-brand-blue">
                        Paso {active + 1} / {STEPS.length}
                      </p>
                      <h3 className="text-lg font-black text-brand-navy">{step.label}</h3>
                    </div>
                  </div>
                  <p className="max-w-xl text-sm font-medium leading-6 text-brand-muted">{step.detail}</p>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-stretch lg:flex-row">
                  <Link
                    href={step.ctaHref}
                    className="inline-flex items-center justify-center rounded-full bg-brand-blue px-5 py-2.5 text-[0.65rem] font-black uppercase tracking-widest text-white transition hover:bg-brand-primary"
                  >
                    {step.ctaLabel}
                  </Link>
                  <Link
                    href="/productos"
                    className="inline-flex items-center justify-center rounded-full border border-brand-blue/30 bg-white px-5 py-2.5 text-[0.65rem] font-black uppercase tracking-widest text-brand-navy transition hover:border-brand-blue hover:text-brand-blue"
                  >
                    Explorar catálogo
                  </Link>
                </div>
              </div>
            </div>

            <aside className="rounded-xl border border-brand-blue/20 bg-white px-4 py-3 text-sm font-medium leading-6 text-brand-muted">
              Cada flujo se arma con el equipo correcto para tu obra — no con el más caro del catálogo.
            </aside>
          </div>
        </div>
      </Container>
    </section>
  );
}
