---
name: bob-el-auditor-y-constructor
description: >-
  Metodología estricta de dos fases para ingeniería de software de máxima calidad: 
  Fase 1: Auditoría defensiva atómica paso a paso (sin apresurarse, analizando cuellos de botella, deadlocks, pérdida de datos y calidad de producción). 
  Fase 2: Construcción y refactorización incremental punto por punto resolviendo cada deficiencia encontrada sin atajos.
---

# 👷 Skill: Bob el Auditor y Constructor

Esta skill define el protocolo obligatorio de desarrollo e ingeniería defensiva para el proyecto. 
**Regla de oro:** Nunca producir código simplista ni hacer refactorizaciones globales aceleradas en bloque. La calidad industrial se logra dividiendo en etapas atómicas, auditando primero y construyendo punto por punto.

---

## 🧭 Flujo de Trabajo en 2 Fases

```
┌─────────────────────────────────────────────────────────────┐
│ FASE 1: AUDITORÍA ATÓMICA ("Bob el Auditor")                │
│ • Analiza UN solo paso/módulo a la vez (no todo junto).    │
│ • Detecta cuellos de botella, deadlocks, límites de SO.    │
│ • Evalúa pérdida de datos, degradación y casos borde.       │
│ • Entrega el informe de auditoría desglosado con puntos.    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ FASE 2: CONSTRUCCIÓN INCREMENTAL ("Bob el Constructor")     │
│ • Toma los puntos detectados en la auditoría.              │
│ • Resuelve CADA punto de forma secuencial y detallada.      │
│ • Valida la resiliencia y añade observabilidad / logs.      │
│ • Verifica que no queden cabos sueltos antes del paso sig. │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔍 Reglas de la Fase 1: Auditoría
1. **Paso a Paso Obligatorio:** Si una etapa tiene 4 componentes (`Paso 1`, `Paso 2`, `Paso 3`, `Paso 4`), auditar ÚNICAMENTE el `Paso N` antes de pasar al siguiente.
2. **Matriz de Vulnerabilidades:** Cada auditoría debe chequear:
   - **Estabilidad del SO y Procesos:** Deadlocks por buffers (`PIPE`), leaks de memoria, procesos zombies, timeouts.
   - **Calidad de Señal / Datos:** Frecuencias de corte, compresión, pérdida de fidelidad, normalización EBU R128.
   - **Resiliencia ante Fallos:** Archivos corruptos, cortes abruptos de batería, excepciones no controladas.
   - **Escalabilidad:** Capacidad de procesar archivos de 1 a 3 horas sin degradación.

---

## 🔨 Reglas de la Fase 2: Construcción Punto por Punto
1. **Nunca programar en bloque apresurado:** Resolver las deficiencias una a una con arquitectura limpia, tipado estricto, presets configurables y manejo exhaustivo de excepciones.
2. **Sin Placeholders ni 'TODOs' cosméticos:** Cada función debe implementarse completamente con grado de ingeniería de producción.
3. **Validación:** Confirmar la solución de cada punto antes de avanzar al siguiente componente de la arquitectura.
